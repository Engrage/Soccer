import { and, gte, lt, sql } from "drizzle-orm";

import { db } from "@/db";
import { leagues, matches, predictions, teams } from "@/db/schema";
import { hashString, venueFor } from "@/lib/seed-data";
import { buildPrediction, halfTimeScore, sampleScore, settleFlags } from "@/lib/predict";
import { addDays, dayKeyFrom, parseDayKey } from "@/lib/dates";
import { LEAGUE_SEEDS, abbreviationFor } from "@/lib/seed-data";

const DDL = [
  `CREATE TABLE IF NOT EXISTS "leagues" (
    "id" serial PRIMARY KEY,
    "slug" text NOT NULL,
    "name" text NOT NULL,
    "country" text NOT NULL,
    "country_code" text NOT NULL,
    "flag" text NOT NULL,
    "tier" integer NOT NULL DEFAULT 1,
    "accent" text NOT NULL DEFAULT '#38bdf8',
    "average_goals" real NOT NULL DEFAULT 2.7,
    "external_id" text,
    "standings_synced_at" timestamptz
  )`,
  `CREATE UNIQUE INDEX IF NOT EXISTS "leagues_slug_key" ON "leagues" ("slug")`,
  `CREATE TABLE IF NOT EXISTS "teams" (
    "id" serial PRIMARY KEY,
    "league_id" integer NOT NULL,
    "name" text NOT NULL,
    "short_name" text NOT NULL,
    "abbreviation" text NOT NULL,
    "attack" real NOT NULL,
    "defense" real NOT NULL,
    "form" real NOT NULL DEFAULT 1,
    "elo" real NOT NULL DEFAULT 1500,
    "last_five" text NOT NULL DEFAULT '-----',
    "external_id" text,
    "record" text
  )`,
  `CREATE UNIQUE INDEX IF NOT EXISTS "teams_name_league_key" ON "teams" ("league_id","name")`,
  `CREATE INDEX IF NOT EXISTS "teams_league_idx" ON "teams" ("league_id")`,
  `CREATE TABLE IF NOT EXISTS "matches" (
    "id" serial PRIMARY KEY,
    "external_key" text NOT NULL,
    "league_id" integer NOT NULL,
    "home_team_id" integer NOT NULL,
    "away_team_id" integer NOT NULL,
    "kickoff" timestamptz NOT NULL,
    "status" text NOT NULL DEFAULT 'scheduled',
    "home_goals" integer,
    "away_goals" integer,
    "ht_home_goals" integer,
    "ht_away_goals" integer,
    "round_name" text NOT NULL,
    "venue" text NOT NULL,
    "source" text NOT NULL DEFAULT 'demo',
    "broadcast" text,
    "synced_at" timestamptz
  )`,
  `CREATE UNIQUE INDEX IF NOT EXISTS "matches_external_key_key" ON "matches" ("external_key")`,
  `CREATE INDEX IF NOT EXISTS "matches_kickoff_idx" ON "matches" ("kickoff")`,
  `CREATE INDEX IF NOT EXISTS "matches_league_idx" ON "matches" ("league_id")`,
  `CREATE TABLE IF NOT EXISTS "predictions" (
    "id" serial PRIMARY KEY,
    "match_id" integer NOT NULL,
    "expected_home" real NOT NULL,
    "expected_away" real NOT NULL,
    "score_home" integer NOT NULL,
    "score_away" integer NOT NULL,
    "prob_home" real NOT NULL,
    "prob_draw" real NOT NULL,
    "prob_away" real NOT NULL,
    "prob_over15" real NOT NULL,
    "prob_over25" real NOT NULL,
    "prob_over35" real NOT NULL,
    "prob_btts" real NOT NULL,
    "prob_home_clean_sheet" real NOT NULL,
    "prob_away_clean_sheet" real NOT NULL,
    "top_scores" jsonb NOT NULL,
    "htft" jsonb NOT NULL,
    "double_chance" jsonb NOT NULL,
    "tip" text NOT NULL,
    "tip_label" text NOT NULL,
    "tip_probability" real NOT NULL,
    "alt_tip" text NOT NULL,
    "alt_tip_label" text NOT NULL,
    "alt_tip_probability" real NOT NULL,
    "confidence" real NOT NULL,
    "odds_home" real NOT NULL,
    "odds_draw" real NOT NULL,
    "odds_away" real NOT NULL,
    "value_edge" real NOT NULL,
    "hit_outcome" boolean,
    "hit_over25" boolean,
    "hit_btts" boolean,
    "hit_correct_score" boolean,
    "hit_htft" boolean,
    "created_at" timestamptz NOT NULL DEFAULT now()
  )`,
  `CREATE UNIQUE INDEX IF NOT EXISTS "predictions_match_key" ON "predictions" ("match_id")`,
  `CREATE INDEX IF NOT EXISTS "predictions_tip_idx" ON "predictions" ("tip")`,
];

type GlobalCache = typeof globalThis & {
  __goalseerBootstrap?: Promise<void>;
  __goalseerSeededDays?: Set<string>;
};

const globalCache = globalThis as GlobalCache;

function rng(seed: number) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function attackFromRating(rating: number, noise: number) {
  const base = 0.62 + (rating / 100) * 1.15;
  return Number((base * (0.92 + noise * 0.16)).toFixed(3));
}

function defenseFromRating(rating: number, noise: number) {
  const base = 1.42 - (rating / 100) * 0.72;
  return Number((base * (1.08 - noise * 0.16)).toFixed(3));
}

async function chunkedInsert<T extends Record<string, unknown>>(
  insert: (rows: T[]) => Promise<unknown>,
  rows: T[],
  size = 200,
) {
  for (let i = 0; i < rows.length; i += size) {
    await insert(rows.slice(i, i + size));
  }
}

async function seedReferenceData() {
  const existing = await db.select({ id: leagues.id }).from(leagues).limit(1);
  if (existing.length > 0) return;

  for (const seed of LEAGUE_SEED_REF) {
    const [league] = await db
      .insert(leagues)
      .values({
        slug: seed.slug,
        name: seed.name,
        country: seed.country,
        countryCode: seed.countryCode,
        flag: seed.flag,
        tier: seed.tier,
        accent: seed.accent,
        averageGoals: seed.averageGoals,
      })
      .onConflictDoNothing()
      .returning({ id: leagues.id });

    if (!league) continue;

    const raw = seed.teams.map(([name, rating]) => {
      const noise = rng(hashString(`${seed.slug}:${name}`))();
      const formNoise = rng(hashString(`form:${name}`))();
      return {
        name,
        rating,
        noise,
        formNoise,
        attack: attackFromRating(rating, noise),
        defense: defenseFromRating(rating, 1 - noise),
        form: Number((0.78 + formNoise * 0.46).toFixed(3)),
      };
    });

    // Normalise so the league-average attack and defence multipliers are 1.0,
    // which keeps simulated goal totals anchored to the league goal environment.
    const attackMean = raw.reduce((sum, team) => sum + team.attack, 0) / raw.length;
    const defenseMean = raw.reduce((sum, team) => sum + team.defense, 0) / raw.length;

    const teamRows = raw.map((team) => {
      const name = team.name;
      const rating = team.rating;
      const formNoise = team.formNoise;
      const attack = Number((team.attack / attackMean).toFixed(3));
      const defense = Number((team.defense / defenseMean).toFixed(3));
      const form = team.form;
      const lastFive = Array.from({ length: 5 }, (_, index) => {
        const roll = rng(hashString(`last:${name}:${index}`))();
        const strength = rating / 100 * form;
        if (roll < 0.28 + strength * 0.35) return "W";
        if (roll < 0.55 + strength * 0.2) return "D";
        return "L";
      }).join("");
      return {
        leagueId: league.id,
        name,
        shortName: name,
        abbreviation: abbreviationRef(name),
        attack,
        defense,
        form,
        elo: Math.round(1250 + rating * 3.4 + formNoise * 40),
        lastFive,
      };
    });

    await chunkedInsert((rows) => db.insert(teams).values(rows).onConflictDoNothing(), teamRows);
  }
}

const LEAGUE_SEED_REF = LEAGUE_SEEDS;
const abbreviationRef = abbreviationFor;

/** Circle-method round robin: returns pairs of indexes for a given round. */
function roundRobinPairs(count: number, round: number): [number, number][] {
  const n = count % 2 === 0 ? count : count + 1;
  const indexes = Array.from({ length: n }, (_, i) => (i < count ? i : -1));
  const fixed = indexes[0];
  const rotating = indexes.slice(1);
  const r = round % Math.max(1, n - 1);
  const rotated = [...rotating.slice(r), ...rotating.slice(0, r)];
  const order = [fixed, ...rotated];
  const pairs: [number, number][] = [];
  for (let i = 0; i < order.length / 2; i += 1) {
    const a = order[i];
    const b = order[order.length - 1 - i];
    if (a === -1 || b === -1) continue;
    const flip = (round + i) % 2 === 0;
    pairs.push(flip ? [b, a] : [a, b]);
  }
  return pairs;
}

const LEAGUE_KICKOFF_SLOTS: Record<string, number[]> = {
  "premier-league": [12, 14, 15, 17, 19, 20],
  laliga: [12, 14, 16, 17, 19, 21],
  bundesliga: [13, 15, 16, 18, 19],
  "serie-a": [11, 13, 15, 17, 19, 20],
  "ligue-1": [12, 14, 16, 19, 20, 21],
  eredivisie: [12, 14, 16, 18, 19],
  "liga-portugal": [13, 15, 17, 19, 20, 21],
  championship: [11, 12, 14, 15, 17, 19],
  "super-lig": [10, 12, 14, 16, 17, 19],
  premiership: [11, 14, 15, 16, 19],
  "jupiler-pro-league": [11, 14, 16, 18, 19, 20],
  brasileirao: [20, 21, 22, 23],
  mls: [21, 22, 23, 0],
  "liga-profesional": [22, 23, 0, 1],
};

export async function seedDay(dayKey: string): Promise<void> {
  await seedReferenceData();

  const dayStart = parseDayKey(dayKey);
  const dayEnd = addDays(dayStart, 1);
  const now = new Date();

  const existingMatches = await db
    .select({ id: matches.id })
    .from(matches)
    .where(and(gte(matches.kickoff, dayStart), lt(matches.kickoff, dayEnd)))
    .limit(1);
  if (existingMatches.length > 0) return;

  const leagueRows = await db.select().from(leagues).orderBy(leagues.tier, leagues.id);
  if (leagueRows.length === 0) return;

  const teamRows = await db.select().from(teams);
  const teamsByLeague = new Map<number, typeof teamRows>();
  for (const team of teamRows) {
    const bucket = teamsByLeague.get(team.leagueId) ?? [];
    bucket.push(team);
    teamsByLeague.set(team.leagueId, bucket);
  }

  const dayOffset = Math.round(
    (dayStart.getTime() - parseDayKey(dayKeyFrom(new Date())).getTime()) / 86_400_000,
  );

  const matchValues: (typeof matches.$inferInsert)[] = [];

  leagueRows.forEach((league, leagueIndex) => {
    const leagueTeams = (teamsByLeague.get(league.id) ?? []).sort((a, b) => a.id - b.id);
    if (leagueTeams.length < 2) return;

    const totalRounds = leagueTeams.length - 1;
    const round = Math.abs(dayOffset * 7 + leagueIndex * 3) % Math.max(1, totalRounds);
    const pairs = roundRobinPairs(leagueTeams.length, round);
    const slots = LEAGUE_KICKOFF_SLOTS[league.slug] ?? [15, 17, 19];

    pairs.forEach(([homeIndex, awayIndex], pairIndex) => {
      const home = leagueTeams[homeIndex];
      const away = leagueTeams[awayIndex];
      if (!home || !away) return;

      const slot = slots[pairIndex % slots.length];
      const minute = [0, 15, 30, 45][pairIndex % 4];
      const kickoff = new Date(dayStart.getTime());
      kickoff.setUTCHours(slot % 24, minute, 0, 0);
      if (slot < 0) kickoff.setTime(kickoff.getTime() + 86_400_000);

      const externalKey = `${dayKey}:${league.slug}:${home.name}:${away.name}`;
      matchValues.push({
        externalKey,
        leagueId: league.id,
        homeTeamId: home.id,
        awayTeamId: away.id,
        kickoff,
        status: "scheduled",
        homeGoals: null,
        awayGoals: null,
        htHomeGoals: null,
        htAwayGoals: null,
        roundName: `Matchday ${round + 1}`,
        venue: venueFor(home.shortName, hashString(externalKey) % 3),
      });
    });
  });

  if (matchValues.length === 0) return;

  await chunkedInsert(
    (rows) => db.insert(matches).values(rows).onConflictDoNothing(),
    matchValues,
    150,
  );

  const stored = await db
    .select({
      id: matches.id,
      externalKey: matches.externalKey,
      leagueId: matches.leagueId,
      homeTeamId: matches.homeTeamId,
      awayTeamId: matches.awayTeamId,
      kickoff: matches.kickoff,
    })
    .from(matches)
    .where(and(gte(matches.kickoff, dayStart), lt(matches.kickoff, dayEnd)));
  const teamById = new Map(teamRows.map((team) => [team.id, team]));
  const leagueById = new Map(leagueRows.map((league) => [league.id, league]));

  const predictionValues: (typeof predictions.$inferInsert)[] = [];
  const finishedUpdates: {
    matchId: number;
    status: string;
    homeGoals: number;
    awayGoals: number;
    htHomeGoals: number;
    htAwayGoals: number;
  }[] = [];

  for (const meta of stored) {
    const home = teamById.get(meta.homeTeamId);
    const away = teamById.get(meta.awayTeamId);
    const league = leagueById.get(meta.leagueId);
    if (!home || !away || !league) continue;

    const seed = hashString(meta.externalKey);
    const model = buildPrediction({
      homeAttack: home.attack,
      homeDefense: home.defense,
      homeForm: home.form,
      awayAttack: away.attack,
      awayDefense: away.defense,
      awayForm: away.form,
      leagueAverageGoals: league.averageGoals,
      seed,
    });

    const kickoff = new Date(meta.kickoff);
    const elapsedMs = now.getTime() - kickoff.getTime();
    const isPast = elapsedMs > 115 * 60 * 1000;
    const isLive = elapsedMs >= 0 && elapsedMs <= 115 * 60 * 1000;

    let status = "scheduled";
    let homeGoals: number | null = null;
    let awayGoals: number | null = null;
    let htHome: number | null = null;
    let htAway: number | null = null;
    let flags = {
      hitOutcome: null as boolean | null,
      hitOver25: null as boolean | null,
      hitBtts: null as boolean | null,
      hitCorrectScore: null as boolean | null,
      hitHtft: null as boolean | null,
    };

    if (isPast || isLive) {
      const elapsedMinutes = isPast ? 90 : Math.max(0, elapsedMs / 60000);
      const share = Math.min(1, elapsedMinutes / 90);
      const scaleRng = rng(seed + 31);
      const scaledHome = model.expectedHome * share * (0.7 + scaleRng() * 0.6);
      const scaledAway = model.expectedAway * share * (0.7 + scaleRng() * 0.6);
      const liveHome = samplePoisson(scaledHome, rng(seed + 97));
      const liveAway = samplePoisson(scaledAway, rng(seed + 193));
      const ht = halfTimeScore(liveHome, liveAway, seed);
      status = isPast ? "finished" : "live";
      homeGoals = liveHome;
      awayGoals = liveAway;
      htHome = elapsedMinutes >= 45 || isPast ? ht.home : null;
      htAway = elapsedMinutes >= 45 || isPast ? ht.away : null;
    }

    if (status === "finished" && homeGoals !== null && awayGoals !== null) {
      const finalHt = halfTimeScore(homeGoals, awayGoals, seed);
      flags = settleFlags(model, homeGoals, awayGoals, finalHt.home, finalHt.away);
      finishedUpdates.push({
        matchId: meta.id,
        status,
        homeGoals,
        awayGoals,
        htHomeGoals: finalHt.home,
        htAwayGoals: finalHt.away,
      });
    } else if (status === "live" && homeGoals !== null && awayGoals !== null) {
      finishedUpdates.push({
        matchId: meta.id,
        status,
        homeGoals,
        awayGoals,
        htHomeGoals: htHome ?? 0,
        htAwayGoals: htAway ?? 0,
      });
    }

    predictionValues.push({
      matchId: meta.id,
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

  await chunkedInsert(
    (rows) => db.insert(predictions).values(rows).onConflictDoNothing(),
    predictionValues,
    150,
  );

  for (let i = 0; i < finishedUpdates.length; i += 120) {
    const chunk = finishedUpdates.slice(i, i + 120);
    const values = chunk
      .map(
        (update) =>
          `(${update.matchId}, '${update.status}', ${update.homeGoals}, ${update.awayGoals}, ${update.htHomeGoals ?? 0}, ${update.htAwayGoals ?? 0})`,
      )
      .join(", ");
    await db.execute(sql.raw(`
      UPDATE matches AS m SET
        status = v.status,
        home_goals = v.home_goals,
        away_goals = v.away_goals,
        ht_home_goals = v.ht_home_goals,
        ht_away_goals = v.ht_away_goals
      FROM (VALUES ${values}) AS v(id, status, home_goals, away_goals, ht_home_goals, ht_away_goals)
      WHERE m.id = v.id
    `));
  }
}

function samplePoisson(lambda: number, random: () => number): number {
  const l = Math.exp(-Math.max(lambda, 0.0001));
  let k = 0;
  let p = 1;
  do {
    k += 1;
    p *= random();
  } while (p > l && k < 40);
  return k - 1;
}

export async function ensureDatabase(): Promise<void> {
  if (!globalCache.__goalseerBootstrap) {
    globalCache.__goalseerBootstrap = (async () => {
      for (const statement of DDL) {
        await db.execute(sql.raw(statement));
      }
    })().catch((error) => {
      globalCache.__goalseerBootstrap = undefined;
      throw error;
    });
  }
  await globalCache.__goalseerBootstrap;
}

/** Makes sure a day window exists, seeding lazily (max ~7 days per call). */
export async function ensureDays(dayKeys: string[]): Promise<void> {
  await ensureDatabase();
  if (!globalCache.__goalseerSeededDays) {
    globalCache.__goalseerSeededDays = new Set<string>();
  }
  const cache = globalCache.__goalseerSeededDays;
  const pending = dayKeys.slice(0, 9).filter((key) => !cache.has(key));
  for (const key of pending) {
    await seedDay(key);
    cache.add(key);
  }
}

export async function ensureRange(daysBack: number, daysForward: number): Promise<void> {
  const today = parseDayKey(dayKeyFrom(new Date()));
  const keys: string[] = [];
  for (let offset = -daysBack; offset <= daysForward; offset += 1) {
    keys.push(dayKeyFrom(addDays(today, offset)));
  }
  await ensureDays(keys);
}
