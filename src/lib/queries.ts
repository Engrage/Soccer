import { and, asc, desc, eq, gte, isNotNull, lt, sql, type SQL } from "drizzle-orm";
import { alias } from "drizzle-orm/pg-core";

import { db } from "@/db";
import { leagues, matches, predictions, teams } from "@/db/schema";
import type { DoubleChanceLine, HtftLine, ScoreLine } from "@/db/schema";
import { addDays, dayKeyFrom, parseDayKey } from "@/lib/dates";
import { ensureDays } from "@/lib/seed";
import { ensureLeagueCatalog, ensureLiveDays } from "@/lib/live";
import { isLiveDataBlocked } from "@/lib/espn";

const homeTeams = alias(teams, "home_team");
const awayTeams = alias(teams, "away_team");

export type TeamView = {
  id: number;
  name: string;
  shortName: string;
  abbreviation: string;
  attack: number;
  defense: number;
  form: number;
  elo: number;
  lastFive: string;
  record: string | null;
};

export type LeagueView = {
  id: number;
  slug: string;
  externalId: string | null;
  averageGoals: number;
  name: string;
  country: string;
  flag: string;
  accent: string;
  tier: number;
};

export type PredictionView = {
  expectedHome: number;
  expectedAway: number;
  scoreHome: number;
  scoreAway: number;
  probHome: number;
  probDraw: number;
  probAway: number;
  probOver15: number;
  probOver25: number;
  probOver35: number;
  probBtts: number;
  probHomeCleanSheet: number;
  probAwayCleanSheet: number;
  topScores: ScoreLine[];
  htft: HtftLine[];
  doubleChance: DoubleChanceLine[];
  tip: string;
  tipLabel: string;
  tipProbability: number;
  altTip: string;
  altTipLabel: string;
  altTipProbability: number;
  confidence: number;
  oddsHome: number;
  oddsDraw: number;
  oddsAway: number;
  valueEdge: number;
  hitOutcome: boolean | null;
  hitOver25: boolean | null;
  hitBtts: boolean | null;
  hitCorrectScore: boolean | null;
  hitHtft: boolean | null;
};

export type MatchView = {
  id: number;
  kickoff: string;
  status: string;
  homeGoals: number | null;
  awayGoals: number | null;
  htHomeGoals: number | null;
  htAwayGoals: number | null;
  roundName: string;
  venue: string;
  source: string;
  broadcast: string | null;
  syncedAt: string | null;
  league: LeagueView;
  home: TeamView;
  away: TeamView;
  prediction: PredictionView | null;
};

const baseSelection = {
  matchId: matches.id,
  kickoff: matches.kickoff,
  status: matches.status,
  homeGoals: matches.homeGoals,
  awayGoals: matches.awayGoals,
  htHomeGoals: matches.htHomeGoals,
  htAwayGoals: matches.htAwayGoals,
  roundName: matches.roundName,
  venue: matches.venue,
  matchSource: matches.source,
  matchBroadcast: matches.broadcast,
  matchSyncedAt: matches.syncedAt,
  leagueId: leagues.id,
  leagueSlug: leagues.slug,
  leagueExternalId: leagues.externalId,
  leagueAverageGoals: leagues.averageGoals,
  leagueName: leagues.name,
  leagueCountry: leagues.country,
  leagueFlag: leagues.flag,
  leagueAccent: leagues.accent,
  leagueTier: leagues.tier,
  homeId: homeTeams.id,
  homeName: homeTeams.name,
  homeShort: homeTeams.shortName,
  homeAbbr: homeTeams.abbreviation,
  homeAttack: homeTeams.attack,
  homeDefense: homeTeams.defense,
  homeForm: homeTeams.form,
  homeElo: homeTeams.elo,
  homeLastFive: homeTeams.lastFive,
  homeRecord: homeTeams.record,
  awayId: awayTeams.id,
  awayName: awayTeams.name,
  awayShort: awayTeams.shortName,
  awayAbbr: awayTeams.abbreviation,
  awayAttack: awayTeams.attack,
  awayDefense: awayTeams.defense,
  awayForm: awayTeams.form,
  awayElo: awayTeams.elo,
  awayLastFive: awayTeams.lastFive,
  awayRecord: awayTeams.record,
  predId: predictions.id,
  predExpectedHome: predictions.expectedHome,
  predExpectedAway: predictions.expectedAway,
  predScoreHome: predictions.scoreHome,
  predScoreAway: predictions.scoreAway,
  predProbHome: predictions.probHome,
  predProbDraw: predictions.probDraw,
  predProbAway: predictions.probAway,
  predProbOver15: predictions.probOver15,
  predProbOver25: predictions.probOver25,
  predProbOver35: predictions.probOver35,
  predProbBtts: predictions.probBtts,
  predProbHomeCs: predictions.probHomeCleanSheet,
  predProbAwayCs: predictions.probAwayCleanSheet,
  predTopScores: predictions.topScores,
  predHtft: predictions.htft,
  predDouble: predictions.doubleChance,
  predTip: predictions.tip,
  predTipLabel: predictions.tipLabel,
  predTipProbability: predictions.tipProbability,
  predAltTip: predictions.altTip,
  predAltTipLabel: predictions.altTipLabel,
  predAltTipProbability: predictions.altTipProbability,
  predConfidence: predictions.confidence,
  predOddsHome: predictions.oddsHome,
  predOddsDraw: predictions.oddsDraw,
  predOddsAway: predictions.oddsAway,
  predValueEdge: predictions.valueEdge,
  predHitOutcome: predictions.hitOutcome,
  predHitOver25: predictions.hitOver25,
  predHitBtts: predictions.hitBtts,
  predHitCorrectScore: predictions.hitCorrectScore,
  predHitHtft: predictions.hitHtft,
};

type BaseRow = {
  [K in keyof typeof baseSelection]: unknown;
};

function mapRow(row: Record<string, unknown>): MatchView {
  const league: LeagueView = {
    id: Number(row.leagueId),
    slug: String(row.leagueSlug),
    externalId: (row.leagueExternalId as string | null) ?? null,
    averageGoals: Number(row.leagueAverageGoals ?? 2.7),
    name: String(row.leagueName),
    country: String(row.leagueCountry),
    flag: String(row.leagueFlag),
    accent: String(row.leagueAccent),
    tier: Number(row.leagueTier),
  };

  const home: TeamView = {
    id: Number(row.homeId),
    name: String(row.homeName),
    shortName: String(row.homeShort),
    abbreviation: String(row.homeAbbr),
    attack: Number(row.homeAttack),
    defense: Number(row.homeDefense),
    form: Number(row.homeForm),
    elo: Number(row.homeElo),
    lastFive: String(row.homeLastFive),
    record: (row.homeRecord as string | null) ?? null,
  };

  const away: TeamView = {
    id: Number(row.awayId),
    name: String(row.awayName),
    shortName: String(row.awayShort),
    abbreviation: String(row.awayAbbr),
    attack: Number(row.awayAttack),
    defense: Number(row.awayDefense),
    form: Number(row.awayForm),
    elo: Number(row.awayElo),
    lastFive: String(row.awayLastFive),
    record: (row.awayRecord as string | null) ?? null,
  };

  const prediction: PredictionView | null = row.predId
    ? {
        expectedHome: Number(row.predExpectedHome),
        expectedAway: Number(row.predExpectedAway),
        scoreHome: Number(row.predScoreHome),
        scoreAway: Number(row.predScoreAway),
        probHome: Number(row.predProbHome),
        probDraw: Number(row.predProbDraw),
        probAway: Number(row.predProbAway),
        probOver15: Number(row.predProbOver15),
        probOver25: Number(row.predProbOver25),
        probOver35: Number(row.predProbOver35),
        probBtts: Number(row.predProbBtts),
        probHomeCleanSheet: Number(row.predProbHomeCs),
        probAwayCleanSheet: Number(row.predProbAwayCs),
        topScores: (row.predTopScores as ScoreLine[]) ?? [],
        htft: (row.predHtft as HtftLine[]) ?? [],
        doubleChance: (row.predDouble as DoubleChanceLine[]) ?? [],
        tip: String(row.predTip),
        tipLabel: String(row.predTipLabel),
        tipProbability: Number(row.predTipProbability),
        altTip: String(row.predAltTip),
        altTipLabel: String(row.predAltTipLabel),
        altTipProbability: Number(row.predAltTipProbability),
        confidence: Number(row.predConfidence),
        oddsHome: Number(row.predOddsHome),
        oddsDraw: Number(row.predOddsDraw),
        oddsAway: Number(row.predOddsAway),
        valueEdge: Number(row.predValueEdge),
        hitOutcome: (row.predHitOutcome as boolean | null) ?? null,
        hitOver25: (row.predHitOver25 as boolean | null) ?? null,
        hitBtts: (row.predHitBtts as boolean | null) ?? null,
        hitCorrectScore: (row.predHitCorrectScore as boolean | null) ?? null,
        hitHtft: (row.predHitHtft as boolean | null) ?? null,
      }
    : null;

  return {
    id: Number(row.matchId),
    kickoff: new Date(row.kickoff as string).toISOString(),
    status: String(row.status),
    homeGoals: (row.homeGoals as number | null) ?? null,
    awayGoals: (row.awayGoals as number | null) ?? null,
    htHomeGoals: (row.htHomeGoals as number | null) ?? null,
    htAwayGoals: (row.htAwayGoals as number | null) ?? null,
    roundName: String(row.roundName),
    venue: String(row.venue),
    source: String(row.matchSource ?? "demo"),
    broadcast: (row.matchBroadcast as string | null) ?? null,
    syncedAt: row.matchSyncedAt ? new Date(row.matchSyncedAt as string).toISOString() : null,
    league,
    home,
    away,
    prediction,
  };
}

async function selectMatches(where: SQL | undefined) {
  return db
    .select(baseSelection)
    .from(matches)
    .innerJoin(leagues, eq(matches.leagueId, leagues.id))
    .innerJoin(homeTeams, eq(matches.homeTeamId, homeTeams.id))
    .innerJoin(awayTeams, eq(matches.awayTeamId, awayTeams.id))
    .leftJoin(predictions, eq(predictions.matchId, matches.id))
    .where(where);
}

export async function getMatchesForDay(dayKey: string): Promise<MatchView[]> {
  const start = parseDayKey(dayKey);
  const end = addDays(start, 1);
  await ensureLiveDays([
    dayKeyFrom(addDays(start, -1)),
    dayKey,
    dayKeyFrom(end),
  ]);
  let rows = await selectMatches(
    and(
      eq(matches.source, "espn"),
      gte(matches.kickoff, start),
      lt(matches.kickoff, end),
    ),
  );
  if (rows.length === 0 && isLiveDataBlocked()) {
    // Only fall back to the simulator when the live upstream is unreachable.
    await ensureDays([dayKeyFrom(addDays(start, -1)), dayKey, dayKeyFrom(end)]);
    rows = await selectMatches(and(gte(matches.kickoff, start), lt(matches.kickoff, end)));
  }
  return rows
    .map((row) => mapRow(row as unknown as Record<string, unknown>))
    .sort((a, b) => {
      if (a.league.tier !== b.league.tier) return a.league.tier - b.league.tier;
      if (a.league.name !== b.league.name) return a.league.name.localeCompare(b.league.name);
      return a.kickoff.localeCompare(b.kickoff);
    });
}

export async function getMatchById(id: number): Promise<MatchView | null> {
  const rows = await selectMatches(eq(matches.id, id));
  if (rows.length === 0) return null;
  return mapRow(rows[0] as unknown as Record<string, unknown>);
}

export async function getLeagueBySlug(slug: string): Promise<LeagueView | null> {
  await ensureLeagueCatalog();
  const rows = await db.select().from(leagues).where(eq(leagues.slug, slug)).limit(1);
  if (rows.length === 0) return null;
  const row = rows[0];
  return {
    id: row.id,
    slug: row.slug,
    externalId: row.externalId ?? null,
    averageGoals: row.averageGoals,
    name: row.name,
    country: row.country,
    flag: row.flag,
    accent: row.accent,
    tier: row.tier,
  };
}

export async function getAllLeagues(): Promise<LeagueView[]> {
  await ensureLeagueCatalog();
  const rows = await db.select().from(leagues).orderBy(asc(leagues.tier), asc(leagues.name));
  return rows.map((row) => ({
    id: row.id,
    slug: row.slug,
    externalId: row.externalId ?? null,
    averageGoals: row.averageGoals,
    name: row.name,
    country: row.country,
    flag: row.flag,
    accent: row.accent,
    tier: row.tier,
  }));
}

export type MarketAccuracy = {
  market: string;
  label: string;
  sampleSize: number;
  hitRate: number;
};

export type LeagueAccuracy = {
  slug: string;
  name: string;
  flag: string;
  accent: string;
  sampleSize: number;
  hitRate: number;
  correctScoreRate: number;
  overRate: number;
};

export type AccuracyReport = {
  dataSource: "live" | "demo";
  sampleSize: number;
  hitRate: number;
  correctScoreRate: number;
  overRate: number;
  bttsRate: number;
  htftRate: number;
  byMarket: MarketAccuracy[];
  byLeague: LeagueAccuracy[];
  byTip: { tip: string; label: string; sampleSize: number; hitRate: number }[];
  trend: { day: string; sampleSize: number; hitRate: number }[];
  brierScore: number;
};

export async function getAccuracyReport(): Promise<AccuracyReport> {
  const reference = new Date();
  await ensureLiveDays([
    dayKeyFrom(addDays(reference, -3)),
    dayKeyFrom(addDays(reference, -2)),
    dayKeyFrom(addDays(reference, -1)),
    dayKeyFrom(reference),
  ]);

  // Prefer graded real fixtures; fall back to the simulator archive when the
  // live upstream is unreachable.
  const liveProbe = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(predictions)
    .innerJoin(matches, eq(predictions.matchId, matches.id))
    .where(
      and(
        eq(matches.status, "finished"),
        isNotNull(predictions.hitOutcome),
        eq(matches.source, "espn"),
      ),
    );
  const useLive = (liveProbe[0]?.count ?? 0) > 0;
  const sourceFilter = useLive ? [eq(matches.source, "espn")] : [];

  const overall = await db
    .select({
      total: sql<number>`count(*)::int`,
      hits: sql<number>`sum(case when ${predictions.hitOutcome} then 1 else 0 end)::int`,
      csHits: sql<number>`sum(case when ${predictions.hitCorrectScore} then 1 else 0 end)::int`,
      overHits: sql<number>`sum(case when ${predictions.hitOver25} then 1 else 0 end)::int`,
      bttsHits: sql<number>`sum(case when ${predictions.hitBtts} then 1 else 0 end)::int`,
      htftHits: sql<number>`sum(case when ${predictions.hitHtft} then 1 else 0 end)::int`,
      brier: sql<number>`coalesce(avg(
        power(${predictions.probHome} - case when ${matches.homeGoals} > ${matches.awayGoals} then 1 else 0 end, 2) +
        power(${predictions.probDraw} - case when ${matches.homeGoals} = ${matches.awayGoals} then 1 else 0 end, 2) +
        power(${predictions.probAway} - case when ${matches.homeGoals} < ${matches.awayGoals} then 1 else 0 end, 2)
      ), 0)`,
    })
    .from(predictions)
    .innerJoin(matches, eq(predictions.matchId, matches.id))
    .where(
      and(eq(matches.status, "finished"), isNotNull(predictions.hitOutcome), ...sourceFilter),
    );

  const total = overall[0]?.total ?? 0;
  const safe = (value: number | null | undefined) => (total > 0 ? Number(value ?? 0) / total : 0);

  const byTipRows = await db
    .select({
      tip: predictions.tip,
      label: predictions.tipLabel,
      sampleSize: sql<number>`count(*)::int`,
      hits: sql<number>`sum(case when ${predictions.hitOutcome} then 1 else 0 end)::int`,
    })
    .from(predictions)
    .innerJoin(matches, eq(predictions.matchId, matches.id))
    .where(
      and(eq(matches.status, "finished"), isNotNull(predictions.hitOutcome), ...sourceFilter),
    )
    .groupBy(predictions.tip, predictions.tipLabel)
    .orderBy(desc(sql`count(*)`));

  const byLeagueRows = await db
    .select({
      slug: leagues.slug,
      name: leagues.name,
      flag: leagues.flag,
      accent: leagues.accent,
      sampleSize: sql<number>`count(*)::int`,
      hits: sql<number>`sum(case when ${predictions.hitOutcome} then 1 else 0 end)::int`,
      csHits: sql<number>`sum(case when ${predictions.hitCorrectScore} then 1 else 0 end)::int`,
      overHits: sql<number>`sum(case when ${predictions.hitOver25} then 1 else 0 end)::int`,
    })
    .from(predictions)
    .innerJoin(matches, eq(predictions.matchId, matches.id))
    .innerJoin(leagues, eq(matches.leagueId, leagues.id))
    .where(
      and(eq(matches.status, "finished"), isNotNull(predictions.hitOutcome), ...sourceFilter),
    )
    .groupBy(leagues.slug, leagues.name, leagues.flag, leagues.accent)
    .orderBy(desc(sql`count(*)`));

  const trendRows = await db
    .select({
      day: sql<string>`to_char(${matches.kickoff}, 'YYYY-MM-DD')`,
      sampleSize: sql<number>`count(*)::int`,
      hits: sql<number>`sum(case when ${predictions.hitOutcome} then 1 else 0 end)::int`,
    })
    .from(predictions)
    .innerJoin(matches, eq(predictions.matchId, matches.id))
    .where(
      and(eq(matches.status, "finished"), isNotNull(predictions.hitOutcome), ...sourceFilter),
    )
    .groupBy(sql`to_char(${matches.kickoff}, 'YYYY-MM-DD')`)
    .orderBy(asc(sql`to_char(${matches.kickoff}, 'YYYY-MM-DD')`));

  const byMarket: MarketAccuracy[] = [
    { market: "primary", label: "Primary tip", sampleSize: total, hitRate: safe(overall[0]?.hits) },
    { market: "1x2", label: "Match result", sampleSize: total, hitRate: safe(overall[0]?.hits) },
    { market: "over25", label: "Over / under 2.5", sampleSize: total, hitRate: safe(overall[0]?.overHits) },
    { market: "btts", label: "Both teams to score", sampleSize: total, hitRate: safe(overall[0]?.bttsHits) },
    { market: "correct", label: "Exact scoreline", sampleSize: total, hitRate: safe(overall[0]?.csHits) },
    { market: "htft", label: "HT / FT", sampleSize: total, hitRate: safe(overall[0]?.htftHits) },
  ];

  return {
    dataSource: useLive ? "live" : "demo",
    sampleSize: total,
    hitRate: safe(overall[0]?.hits),
    correctScoreRate: safe(overall[0]?.csHits),
    overRate: safe(overall[0]?.overHits),
    bttsRate: safe(overall[0]?.bttsHits),
    htftRate: safe(overall[0]?.htftHits),
    brierScore: Number(overall[0]?.brier ?? 0),
    byMarket,
    byLeague: byLeagueRows.map((row) => ({
      slug: row.slug,
      name: row.name,
      flag: row.flag,
      accent: row.accent,
      sampleSize: row.sampleSize,
      hitRate: row.sampleSize ? row.hits / row.sampleSize : 0,
      correctScoreRate: row.sampleSize ? row.csHits / row.sampleSize : 0,
      overRate: row.sampleSize ? row.overHits / row.sampleSize : 0,
    })),
    byTip: byTipRows.map((row) => ({
      tip: row.tip,
      label: row.label,
      sampleSize: row.sampleSize,
      hitRate: row.sampleSize ? row.hits / row.sampleSize : 0,
    })),
    trend: trendRows.map((row) => ({
      day: row.day,
      sampleSize: row.sampleSize,
      hitRate: row.sampleSize ? row.hits / row.sampleSize : 0,
    })),
  };
}

export async function getRecentSettled(limit = 12): Promise<MatchView[]> {
  const rows = await db
    .select(baseSelection)
    .from(matches)
    .innerJoin(leagues, eq(matches.leagueId, leagues.id))
    .innerJoin(homeTeams, eq(matches.homeTeamId, homeTeams.id))
    .innerJoin(awayTeams, eq(matches.awayTeamId, awayTeams.id))
    .leftJoin(predictions, eq(predictions.matchId, matches.id))
    .where(and(eq(matches.status, "finished"), isNotNull(predictions.hitOutcome)))
    .orderBy(desc(matches.kickoff))
    .limit(limit);
  const mapped = rows.map((row) => mapRow(row as unknown as Record<string, unknown>));
  if (mapped.some((row) => row.source === "espn")) {
    return mapped.filter((row) => row.source === "espn");
  }
  return mapped;
}

export async function getTeamsForLeague(leagueId: number): Promise<TeamView[]> {
  const rows = await db
    .select()
    .from(teams)
    .where(eq(teams.leagueId, leagueId))
    .orderBy(desc(teams.elo));
  return rows.map((row) => ({
    id: row.id,
    name: row.name,
    shortName: row.shortName,
    abbreviation: row.abbreviation,
    attack: row.attack,
    defense: row.defense,
    form: row.form,
    elo: row.elo,
    lastFive: row.lastFive,
    record: row.record ?? null,
  }));
}

export type DaySummary = {
  dayKey: string;
  totalMatches: number;
  liveMatches: number;
  finishedMatches: number;
  averageConfidence: number;
  topConfidence: number;
  valuePicks: number;
  overRate: number;
  bttsRate: number;
};

export function summarise(dayKey: string, rows: MatchView[]): DaySummary {
  const withPredictions = rows.filter((row) => row.prediction);
  const confidenceValues = withPredictions.map((row) => row.prediction!.confidence);
  return {
    dayKey,
    totalMatches: rows.length,
    liveMatches: rows.filter((row) => row.status === "live").length,
    finishedMatches: rows.filter((row) => row.status === "finished").length,
    averageConfidence: confidenceValues.length
      ? confidenceValues.reduce((sum, value) => sum + value, 0) / confidenceValues.length
      : 0,
    topConfidence: confidenceValues.length ? Math.max(...confidenceValues) : 0,
    valuePicks: withPredictions.filter((row) => row.prediction!.valueEdge > 0.04).length,
    overRate: withPredictions.length
      ? withPredictions.filter((row) => row.prediction!.probOver25 >= 0.5).length / withPredictions.length
      : 0,
    bttsRate: withPredictions.length
      ? withPredictions.filter((row) => row.prediction!.probBtts >= 0.5).length / withPredictions.length
      : 0,
  };
}
