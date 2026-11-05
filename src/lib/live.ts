import { and, eq, gte, inArray, lt, sql } from "drizzle-orm";

import { db } from "@/db";
import { leagues, matches, predictions, teams } from "@/db/schema";
import { addDays, dayKeyFrom, parseDayKey } from "@/lib/dates";
import { buildPrediction, halfTimeScore, settleFlags } from "@/lib/predict";
import {
  LEAGUE_CODES,
  fetchFixturesForDate,
  fetchStandings,
  type EspnFixture,
  type EspnTeamStats,
} from "@/lib/espn";
import { ensureDatabase } from "@/lib/seed";

const CONCURRENCY = 6;
const FRESH_MS = 4 * 60 * 1000;
const STALE_MS = 12 * 60 * 60 * 1000;

type Rating = {
  attack: number;
  defense: number;
  form: number;
  elo: number;
  record: string;
  lastFive: string;
};

type LeagueContext = {
  id: number;
  code: string;
  averageGoals: number;
  ratings: Map<string, Rating>;
};

const globalCache = globalThis as typeof globalThis & {
  __goalseerLiveDays?: Set<string>;
  __goalseerLeagueContext?: Map<string, LeagueContext>;
  __goalseerLiveDaysBusy?: Map<string, Promise<void>>;
};

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

async function mapLimit<T, R>(items: T[], limit: number, worker: (item: T) => Promise<R>) {
  const results: R[] = [];
  let cursor = 0;
  const runners = Array.from({ length: Math.min(limit, items.length) }, async () => {
    while (cursor < items.length) {
      const index = cursor;
      cursor += 1;
      results[index] = await worker(items[index]);
    }
  });
  await Promise.all(runners);
  return results;
}

async function ensureLeagueRows() {
  const existing = await db.select({ slug: leagues.slug }).from(leagues);
  const known = new Set(existing.map((row) => row.slug));
  for (const code of LEAGUE_CODES) {
    if (known.has(code.slug)) continue;
    await db
      .insert(leagues)
      .values({
        slug: code.slug,
        name: code.name,
        country: code.country,
        countryCode: code.code,
        flag: code.flag,
        tier: code.tier,
        accent: code.accent,
        averageGoals: 2.7,
        externalId: code.code,
      })
      .onConflictDoNothing();
  }
}

function ratingsFromStandings(rows: EspnTeamStats[]): { averageGoals: number; ratings: Map<string, Rating> } {
  const totals = rows.reduce(
    (acc, row) => {
      acc.played += row.gamesPlayed;
      acc.for += row.goalsFor;
      acc.against += row.goalsAgainst;
      return acc;
    },
    { played: 0, for: 0, against: 0 },
  );
  const gamesPerTeamSide = totals.played || rows.length * 10;
  const averageGoalsFor = totals.for / gamesPerTeamSide || 1.35;
  const averageGoalsAgainst = totals.against / gamesPerTeamSide || 1.35;
  const leagueAverageGoals = clamp(averageGoalsFor + averageGoalsAgainst, 1.9, 4.0);

  const ratings = new Map<string, Rating>();
  for (const row of rows) {
    const played = Math.max(row.gamesPlayed, 1);
    const attack = clamp(row.goalsFor / played / averageGoalsFor || 1, 0.45, 2.05);
    const defense = clamp(row.goalsAgainst / played / averageGoalsAgainst || 1, 0.55, 1.75);
    const ppg = clamp(row.points / played / 3, 0.05, 1);
    const form = Number(clamp(0.74 + ppg * 0.52, 0.7, 1.28).toFixed(3));
    const goalDiffPerGame = (row.goalsFor - row.goalsAgainst) / played;
    const elo = Math.round(1280 + ppg * 320 + goalDiffPerGame * 45);

    // Recent-form string derived from the team's real W/D/L split, strongest
    // signal first, so the UI can show real season shape.
    const shape: string[] = [];
    const counts: [string, number][] = [
      ["W", row.wins],
      ["D", row.ties],
      ["L", row.losses],
    ];
    counts.sort((a, b) => b[1] - a[1]);
    for (const [letter, total] of counts) {
      for (let i = 0; i < Math.min(3, Number(total) || 0); i += 1) shape.push(letter);
    }
    const lastFive = (shape.slice(0, 5).join("") + "-----").slice(0, 5);

    ratings.set(row.id, {
      attack: Number(attack.toFixed(3)),
      defense: Number(defense.toFixed(3)),
      form,
      elo,
      record: row.record,
      lastFive,
    });
  }
  return { averageGoals: Number(leagueAverageGoals.toFixed(2)), ratings };
}

const NEUTRAL: Rating = {
  attack: 1,
  defense: 1,
  form: 1,
  elo: 1500,
  record: "-",
  lastFive: "-----",
};

async function loadLeagueContext(force = false): Promise<Map<string, LeagueContext>> {
  const cacheMap = (globalCache.__goalseerLeagueContext ??= new Map<string, LeagueContext>());
  const pending = LEAGUE_CODES.filter((code) => force || !cacheMap.has(code.slug));

  const leagueRows = await db.select().from(leagues);
  const leagueBySlug = new Map(leagueRows.map((row) => [row.slug, row]));

  await mapLimit(pending, CONCURRENCY, async (code) => {
    const league = leagueBySlug.get(code.slug);
    if (!league) return;
    const stats = await fetchStandings(code.code);
    if (stats.length === 0) {
      cacheMap.set(code.slug, {
        id: league.id,
        code: code.code,
        averageGoals: league.averageGoals,
        ratings: new Map(),
      });
      return;
    }
    const { averageGoals, ratings } = ratingsFromStandings(stats);
    cacheMap.set(code.slug, { id: league.id, code: code.code, averageGoals, ratings });

    await db
      .update(leagues)
      .set({ averageGoals, standingsSyncedAt: new Date(), externalId: code.code })
      .where(eq(leagues.id, league.id));

    for (const stat of stats) {
      const rating = ratings.get(stat.id) ?? NEUTRAL;
      await db
        .insert(teams)
        .values({
          leagueId: league.id,
          name: stat.name,
          shortName: stat.name,
          abbreviation: stat.abbreviation || stat.name.slice(0, 3).toUpperCase(),
          attack: rating.attack,
          defense: rating.defense,
          form: rating.form,
          elo: rating.elo,
          lastFive: rating.lastFive,
          externalId: stat.id,
          record: rating.record,
        })
        .onConflictDoUpdate({
          target: [teams.leagueId, teams.name],
          set: {
            attack: rating.attack,
            defense: rating.defense,
            form: rating.form,
            elo: rating.elo,
            lastFive: rating.lastFive,
            externalId: stat.id,
            record: rating.record,
          },
        });
    }
  });

  return cacheMap;
}

async function loadTeamRefs(existing?: Map<string, TeamRef>) {
  const map = existing ?? new Map<string, TeamRef>();
  if (existing) existing.clear();
  const rows = await db
    .select({ id: teams.id, leagueId: teams.leagueId, externalId: teams.externalId })
    .from(teams);
  for (const row of rows) {
    if (!row.externalId) continue;
    map.set(`${row.leagueId}:${row.externalId}`, {
      id: row.id,
      leagueId: row.leagueId,
      externalId: row.externalId,
    });
  }
  return map;
}

async function isDayFresh(dayKey: string): Promise<boolean> {
  const start = parseDayKey(dayKey);
  const end = addDays(start, 1);
  const rows = await db
    .select({ syncedAt: matches.syncedAt })
    .from(matches)
    .where(
      and(
        eq(matches.source, "espn"),
        gte(matches.kickoff, start),
        lt(matches.kickoff, end),
      ),
    )
    .limit(1);
  if (rows.length === 0) return false;
  const synced = rows[0].syncedAt ? new Date(rows[0].syncedAt).getTime() : 0;
  if (!synced) return false;
  const today = new Date();
  const isToday = dayKey === dayKeyFrom(today);
  const age = Date.now() - synced;
  if (isToday) return age < FRESH_MS;
  if (start.getTime() < today.getTime()) return age < STALE_MS;
  return age < STALE_MS;
}

type TeamRef = { id: number | null; leagueId: number; externalId: string };

async function ingestDay(
  dayKey: string,
  contextMap: Map<string, LeagueContext>,
  teamRefs: Map<string, TeamRef>,
) {
  const fixturesByLeague = await mapLimit(LEAGUE_CODES, CONCURRENCY, async (code) => ({
    code,
    fixtures: await fetchFixturesForDate(code.code, dayKey),
  }));

  // Bulk-register any team that appears in today's fixtures but is missing.
  const teamValues: (typeof teams.$inferInsert)[] = [];
  for (const { code, fixtures } of fixturesByLeague) {
    const context = contextMap.get(code.slug);
    if (!context) continue;
    for (const fixture of [fixtures.map((f) => f.home), fixtures.map((f) => f.away)].flat()) {
      if (teamRefs.has(`${context.id}:${fixture.id}`)) continue;
      const rating = context.ratings.get(fixture.id);
      teamValues.push({
        leagueId: context.id,
        name: fixture.name,
        shortName: fixture.shortName,
        abbreviation: fixture.abbreviation,
        attack: rating?.attack ?? 1,
        defense: rating?.defense ?? 1,
        form: rating?.form ?? 1,
        elo: rating?.elo ?? 1500,
        lastFive: rating?.lastFive ?? "-----",
        externalId: fixture.id,
        record: rating?.record ?? fixture.record ?? null,
      });
      teamRefs.set(`${context.id}:${fixture.id}`, { id: null, leagueId: context.id, externalId: fixture.id });
    }
  }
  for (let i = 0; i < teamValues.length; i += 150) {
    await db
      .insert(teams)
      .values(teamValues.slice(i, i + 150))
      .onConflictDoUpdate({
        target: [teams.leagueId, teams.name],
        set: {
          externalId: sql`excluded.external_id`,
          abbreviation: sql`excluded.abbreviation`,
          record: sql`excluded.record`,
        },
      });
  }

  // Re-read ids now that every team in today's fixture list exists.
  await loadTeamRefs(teamRefs);

  const matchValues: (typeof matches.$inferInsert)[] = [];
  const fixtures: EspnFixture[] = [];
  const leagueIdBySlug = new Map(LEAGUE_CODES.map((code) => [code.slug, contextMap.get(code.slug)?.id ?? 0]));

  for (const { code, fixtures: leagueFixtures } of fixturesByLeague) {
    const context = contextMap.get(code.slug);
    if (!context) continue;
    for (const fixture of leagueFixtures) {
      const kickoff = new Date(fixture.date);
      // ESPN groups fixtures by local date; bucket them by their UTC kickoff day.
      if (dayKeyFrom(kickoff) !== dayKey) continue;
      const homeTeamId = teamRefs.get(`${context.id}:${fixture.home.id}`)?.id;
      const awayTeamId = teamRefs.get(`${context.id}:${fixture.away.id}`)?.id;
      if (!homeTeamId || !awayTeamId) continue;
      fixtures.push(fixture);
      matchValues.push({
        externalKey: `espn:${fixture.eventId}`,
        leagueId: context.id,
        homeTeamId,
        awayTeamId,
        kickoff,
        status: fixture.status,
        homeGoals: fixture.homeGoals,
        awayGoals: fixture.awayGoals,
        htHomeGoals: fixture.htHomeGoals,
        htAwayGoals: fixture.htAwayGoals,
        roundName: fixture.roundName,
        venue: fixture.venue,
        source: "espn",
        broadcast: fixture.broadcast,
        syncedAt: new Date(),
      });
      void leagueIdBySlug;
    }
  }

  if (matchValues.length === 0) return [];

  const stored: { fixture: EspnFixture; matchId: number }[] = [];
  for (let i = 0; i < matchValues.length; i += 120) {
    const rows = await db
      .insert(matches)
      .values(matchValues.slice(i, i + 120))
      .onConflictDoUpdate({
        target: matches.externalKey,
        set: {
          kickoff: sql`excluded.kickoff`,
          status: sql`excluded.status`,
          homeGoals: sql`excluded.home_goals`,
          awayGoals: sql`excluded.away_goals`,
          htHomeGoals: sql`excluded.ht_home_goals`,
          htAwayGoals: sql`excluded.ht_away_goals`,
          roundName: sql`excluded.round_name`,
          venue: sql`excluded.venue`,
          broadcast: sql`excluded.broadcast`,
          syncedAt: sql`excluded.synced_at`,
        },
      })
      .returning({ id: matches.id, externalKey: matches.externalKey });
    for (const row of rows) {
      const eventId = row.externalKey.replace("espn:", "");
      const fixture = fixtures.find((item) => item.eventId === eventId);
      if (fixture) stored.push({ fixture, matchId: row.id });
    }
  }
  return stored;
}

async function buildPredictions(
  rows: { fixture: EspnFixture; matchId: number }[],
  contextMap: Map<string, LeagueContext>,
  teamRefs: Map<string, TeamRef>,
) {
  const leagueRows = await db.select().from(leagues);
  const leagueById = new Map(leagueRows.map((row) => [row.id, row]));
  const values: (typeof predictions.$inferInsert)[] = [];

  const matchIds = rows.map((row) => row.matchId);
  const existing =
    matchIds.length > 0
      ? await db
          .select({
            matchId: predictions.matchId,
            hitOutcome: predictions.hitOutcome,
            hitOver25: predictions.hitOver25,
            hitBtts: predictions.hitBtts,
            hitCorrectScore: predictions.hitCorrectScore,
            hitHtft: predictions.hitHtft,
          })
          .from(predictions)
          .where(inArray(predictions.matchId, matchIds))
      : [];
  const previousByMatch = new Map(existing.map((row) => [row.matchId, row]));

  for (const { fixture, matchId } of rows) {
    const league = leagueById.get(leagueByFixture(contextMap, fixture)?.id ?? -1);
    if (!league) continue;
    const homeRef = teamRefs.get(`${league.id}:${fixture.home.id}`);
    const awayRef = teamRefs.get(`${league.id}:${fixture.away.id}`);
    const homeRating = contextMap.get(league.slug ?? "")?.ratings.get(fixture.home.id);
    const awayRating = contextMap.get(league.slug ?? "")?.ratings.get(fixture.away.id);

    const model = buildPrediction({
      homeAttack: homeRating?.attack ?? 1,
      homeDefense: homeRating?.defense ?? 1,
      homeForm: homeRating?.form ?? 1,
      awayAttack: awayRating?.attack ?? 1,
      awayDefense: awayRating?.defense ?? 1,
      awayForm: awayRating?.form ?? 1,
      leagueAverageGoals: league.averageGoals,
      seed: Number(fixture.eventId.slice(-8)) || 7,
      bookOdds: fixture.odds
        ? { home: fixture.odds.home, draw: fixture.odds.draw, away: fixture.odds.away }
        : undefined,
    });

    let flags: {
      hitOutcome: boolean | null;
      hitOver25: boolean | null;
      hitBtts: boolean | null;
      hitCorrectScore: boolean | null;
      hitHtft: boolean | null;
    } = previousByMatch.get(matchId) ?? {
      hitOutcome: null,
      hitOver25: null,
      hitBtts: null,
      hitCorrectScore: null,
      hitHtft: null,
    };

    if (fixture.status === "finished" && fixture.homeGoals !== null && fixture.awayGoals !== null) {
      const htHome = fixture.htHomeGoals ?? 0;
      const htAway = fixture.htAwayGoals ?? 0;
      flags = settleFlags(model, fixture.homeGoals, fixture.awayGoals, htHome, htAway);
    }

    void homeRef;
    void awayRef;
    values.push({
      matchId,
      expectedHome: model.expectedHome,
      expectedAway: model.expectedAway,
      scoreHome: model.scoreHome,
      scoreAway: model.scoreAway,
      probHome: model.probHome,
      probDraw: model.probDraw,
      probAway: model.probAway,
      probOver15: model.probOver15,
      probOver25: model.probOver25,
      probOver35: model.probOver35,
      probBtts: model.probBtts,
      probHomeCleanSheet: model.probHomeCleanSheet,
      probAwayCleanSheet: model.probAwayCleanSheet,
      topScores: model.topScores,
      htft: model.htft,
      doubleChance: model.doubleChance,
      tip: model.tip.key,
      tipLabel: model.tip.label,
      tipProbability: model.tip.probability,
      altTip: model.altTip.key,
      altTipLabel: model.altTip.label,
      altTipProbability: model.altTip.probability,
      confidence: model.confidence,
      oddsHome: model.oddsHome,
      oddsDraw: model.oddsDraw,
      oddsAway: model.oddsAway,
      valueEdge: model.valueEdge,
      ...flags,
    });
  }

  for (let i = 0; i < values.length; i += 120) {
    await db
      .insert(predictions)
      .values(values.slice(i, i + 120))
      .onConflictDoUpdate({
        target: predictions.matchId,
        set: {
          expectedHome: sql`excluded.expected_home`,
          expectedAway: sql`excluded.expected_away`,
          scoreHome: sql`excluded.score_home`,
          scoreAway: sql`excluded.score_away`,
          probHome: sql`excluded.prob_home`,
          probDraw: sql`excluded.prob_draw`,
          probAway: sql`excluded.prob_away`,
          probOver15: sql`excluded.prob_over15`,
          probOver25: sql`excluded.prob_over25`,
          probOver35: sql`excluded.prob_over35`,
          probBtts: sql`excluded.prob_btts`,
          probHomeCleanSheet: sql`excluded.prob_home_clean_sheet`,
          probAwayCleanSheet: sql`excluded.prob_away_clean_sheet`,
          topScores: sql`excluded.top_scores`,
          htft: sql`excluded.htft`,
          doubleChance: sql`excluded.double_chance`,
          tip: sql`excluded.tip`,
          tipLabel: sql`excluded.tip_label`,
          tipProbability: sql`excluded.tip_probability`,
          altTip: sql`excluded.alt_tip`,
          altTipLabel: sql`excluded.alt_tip_label`,
          altTipProbability: sql`excluded.alt_tip_probability`,
          confidence: sql`excluded.confidence`,
          oddsHome: sql`excluded.odds_home`,
          oddsDraw: sql`excluded.odds_draw`,
          oddsAway: sql`excluded.odds_away`,
          valueEdge: sql`excluded.value_edge`,
          hitOutcome: sql`excluded.hit_outcome`,
          hitOver25: sql`excluded.hit_over25`,
          hitBtts: sql`excluded.hit_btts`,
          hitCorrectScore: sql`excluded.hit_correct_score`,
          hitHtft: sql`excluded.hit_htft`,
        },
      });
  }
}

function leagueByFixture(
  contextMap: Map<string, LeagueContext>,
  fixture: EspnFixture,
): LeagueContext | undefined {
  for (const context of contextMap.values()) {
    if (context.code === fixture.leagueCode) return context;
  }
  return undefined;
}

/** Removes the built-in simulator archive once live data is available. */
async function pruneDemoData() {
  const flags = globalCache as typeof globalThis & { __goalseerPrunedDemo?: boolean };
  if (flags.__goalseerPrunedDemo) return;
  flags.__goalseerPrunedDemo = true;

  // Live rows are tagged with their upstream ids, simulator rows are not.
  await db.execute(sql.raw(`
    DELETE FROM predictions WHERE match_id IN (SELECT id FROM matches WHERE source = 'demo')
  `));
  await db.execute(sql.raw(`DELETE FROM matches WHERE source = 'demo'`));
  await db.execute(sql.raw(`DELETE FROM teams WHERE external_id IS NULL`));
  await db.execute(sql.raw(`DELETE FROM leagues WHERE external_id IS NULL`));
}

/** Makes sure the real league catalogue and team ratings exist. */
export async function ensureLeagueCatalog(): Promise<void> {
  await ensureDatabase();
  await ensureLeagueRows();
  await loadLeagueContext();
}

/** Ingests real fixtures for a day (and its neighbours) and models them. */
export async function ensureLiveDays(dayKeys: string[]): Promise<void> {
  await ensureDatabase();
  await ensureLeagueRows();
  const contextMap = await loadLeagueContext();
  const teamRefs = await loadTeamRefs();

  const done = (globalCache.__goalseerLiveDays ??= new Set<string>());
  const busy = (globalCache.__goalseerLiveDaysBusy ??= new Map<string, Promise<void>>());

  for (const dayKey of dayKeys.slice(0, 4)) {
    if (done.has(dayKey)) {
      const fresh = await isDayFresh(dayKey);
      if (fresh) continue;
    }
    const inFlight = busy.get(dayKey);
    if (inFlight) {
      await inFlight.catch(() => undefined);
      continue;
    }
    const task = (async () => {
      const rows = await ingestDay(dayKey, contextMap, teamRefs);
      if (rows.length > 0) {
        await buildPredictions(rows, contextMap, teamRefs);
        await pruneDemoData();
      }
      done.add(dayKey);
    })().catch(() => {
      done.delete(dayKey);
    });
    busy.set(dayKey, task);
    await task;
    busy.delete(dayKey);
  }
}

export async function liveMatchCount(dayKey: string): Promise<number> {
  const start = parseDayKey(dayKey);
  const end = addDays(start, 1);
  const rows = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(matches)
    .where(
      and(eq(matches.source, "espn"), gte(matches.kickoff, start), lt(matches.kickoff, end)),
    );
  return rows[0]?.count ?? 0;
}
