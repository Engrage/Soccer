import { cache } from "react";

import { addDays, dateFromKey, dayKeyFrom, isValidDayKey, todayKey } from "@/lib/dates";
import { baseTeamsForLeague, findBaseTeamByName, hashNumber, LEAGUES, type League, type Team } from "@/lib/data";
import { fetchScoreboard, fetchStandings, type EspnFixture, type StandingRow } from "@/lib/espn";
import { predict, type Prediction } from "@/lib/predict";

export type MatchStatus = "scheduled" | "live" | "finished";

export type MatchView = {
  id: number;
  kickoff: string;
  status: MatchStatus;
  league: League;
  home: Team;
  away: Team;
  homeGoals: number | null;
  awayGoals: number | null;
  htHomeGoals: number | null;
  htAwayGoals: number | null;
  roundName: string;
  venue: string | null;
  broadcast: string | null;
  source: "espn" | "sim";
  syncedAt: string | null;
  prediction: Prediction | null;
};

export type BoardSummary = {
  date: string;
  totalMatches: number;
  averageConfidence: number;
  valuePicks: number;
  liveMatches: number;
  finishedMatches: number;
};

export type AccuracyReport = {
  dataSource: "live" | "sim";
  sampleSize: number;
  hitRate: number;
  brierScore: number;
  overRate: number;
  correctScoreRate: number;
  byMarket: { market: string; label: string; hitRate: number }[];
  trend: { day: string; hitRate: number; sampleSize: number }[];
  byLeague: {
    slug: string;
    name: string;
    flag: string;
    sampleSize: number;
    hitRate: number;
    overRate: number;
    correctScoreRate: number;
  }[];
  byTip: { tip: string; label: string; hitRate: number; sampleSize: number }[];
};

const HOME_ADVANTAGE = 1.16;
const dayCache = new Map<string, Promise<MatchView[]>>();

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

function makeId(dateKey: string, leagueId: number, index: number): number {
  return Number(`${dateKey.replaceAll("-", "")}${String(leagueId).padStart(2, "0")}${String(index).padStart(2, "0")}`);
}

function seededRandom(seed: number): () => number {
  let state = seed >>> 0;
  return () => {
    state = (state * 1664525 + 1013904223) >>> 0;
    return state / 4294967296;
  };
}

function samplePoisson(lambda: number, random: () => number): number {
  const limit = Math.exp(-lambda);
  let k = 0;
  let p = 1;
  do {
    k += 1;
    p *= random();
  } while (p > limit && k < 12);
  return k - 1;
}

function expectedGoals(league: League, home: Team, away: Team): { expectedHome: number; expectedAway: number } {
  const baseline = league.averageGoals / 2;
  return {
    expectedHome: clamp(baseline * home.attack * away.defense * HOME_ADVANTAGE * home.form, 0.2, 4.2),
    expectedAway: clamp(baseline * away.attack * home.defense * away.form, 0.2, 4.2),
  };
}

function ratingFromStanding(league: League, standing: StandingRow, fallback?: Team): Team {
  const games = Math.max(standing.gamesPlayed, 1);
  const baseline = league.averageGoals / 2;
  const attack = clamp(standing.goalsFor / games / baseline, 0.55, 1.75);
  const defense = clamp(standing.goalsAgainst / games / baseline, 0.55, 1.75);
  const pointsPerGame = standing.points / games;
  const form = clamp(0.86 + pointsPerGame * 0.08, 0.86, 1.14);
  const lastFive = fallback?.lastFive ?? ["W", "D", "W", "D", "L"];
  return {
    id: fallback?.id ?? hashNumber(`${league.id}:${standing.name}`),
    leagueId: league.id,
    name: standing.name,
    abbreviation: standing.abbreviation,
    attack,
    defense,
    elo: Math.round(1450 + pointsPerGame * 120 + (standing.goalsFor - standing.goalsAgainst) * 2),
    form,
    lastFive,
    record: `${standing.wins}-${standing.ties}-${standing.losses}`,
  };
}

function teamForEspn(league: League, name: string, abbreviation: string, standings: StandingRow[]): Team {
  const standing = standings.find((row) => row.name.toLowerCase() === name.toLowerCase());
  const fallback = findBaseTeamByName(league.id, name);
  if (standing) return ratingFromStanding(league, standing, fallback);
  if (fallback) return { ...fallback, name, abbreviation };
  const seed = hashNumber(`${league.id}:${name}`);
  const random = seededRandom(seed);
  const lastFive = Array.from({ length: 5 }, () => {
    const roll = random();
    return roll < 0.45 ? "W" : roll < 0.72 ? "D" : "L";
  });
  return {
    id: seed,
    leagueId: league.id,
    name,
    abbreviation,
    attack: 1,
    defense: 1,
    elo: 1500,
    form: 1,
    lastFive,
  };
}

function statusForKickoff(kickoff: Date, now: Date): MatchStatus {
  const diff = now.getTime() - kickoff.getTime();
  if (diff < 0) return "scheduled";
  if (diff < 115 * 60 * 1000) return "live";
  return "finished";
}

function simulateLeagueDay(league: League, dateKey: string, now: Date): MatchView[] {
  const teams = baseTeamsForLeague(league.id);
  if (teams.length < 2) return [];
  const seed = hashNumber(`${dateKey}:${league.slug}`);
  const random = seededRandom(seed);
  const count = 2 + Math.floor(random() * 3);
  const shuffled = [...teams];
  for (let i = shuffled.length - 1; i > 0; i -= 1) {
    const j = Math.floor(random() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }
  const hours = [12, 14, 16, 18, 20];
  const matches: MatchView[] = [];
  for (let index = 0; index < count && index * 2 + 1 < shuffled.length; index += 1) {
    const home = shuffled[index * 2];
    const away = shuffled[index * 2 + 1];
    const kickoff = dateFromKey(dateKey);
    kickoff.setUTCHours(hours[index % hours.length], index % 2 === 0 ? 0 : 30, 0, 0);
    const status = statusForKickoff(kickoff, now);
    const { expectedHome, expectedAway } = expectedGoals(league, home, away);
    const matchSeed = hashNumber(`${dateKey}:${league.id}:${home.id}:${away.id}`);
    const scoreRandom = seededRandom(matchSeed);
    let homeGoals: number | null = null;
    let awayGoals: number | null = null;
    let htHomeGoals: number | null = null;
    let htAwayGoals: number | null = null;
    if (status !== "scheduled") {
      const scale = status === "live" ? 0.62 : 1;
      homeGoals = samplePoisson(expectedHome * scale, scoreRandom);
      awayGoals = samplePoisson(expectedAway * scale, scoreRandom);
      htHomeGoals = samplePoisson(expectedHome * 0.44 * scale, scoreRandom);
      htAwayGoals = samplePoisson(expectedAway * 0.44 * scale, scoreRandom);
      if (htHomeGoals > homeGoals) htHomeGoals = homeGoals;
      if (htAwayGoals > awayGoals) htAwayGoals = awayGoals;
    }
    const prediction = predict({
      expectedHome,
      expectedAway,
      seed: matchSeed,
      finalHome: status === "finished" ? homeGoals : null,
      finalAway: status === "finished" ? awayGoals : null,
      htHome: status === "finished" ? htHomeGoals : null,
      htAway: status === "finished" ? htAwayGoals : null,
    });
    matches.push({
      id: makeId(dateKey, league.id, index),
      kickoff: kickoff.toISOString(),
      status,
      league,
      home,
      away,
      homeGoals,
      awayGoals,
      htHomeGoals,
      htAwayGoals,
      roundName: "Model fixture",
      venue: null,
      broadcast: null,
      source: "sim",
      syncedAt: null,
      prediction,
    });
  }
  return matches;
}

async function fetchLeagueDay(league: League, dateKey: string, now: Date): Promise<{ matches: MatchView[]; source: "espn" | "sim" }> {
  const [fixtures, standings] = await Promise.all([
    fetchScoreboard(league.externalId, dateKey),
    fetchStandings(league.externalId),
  ]);
  if (!fixtures.length) return { matches: simulateLeagueDay(league, dateKey, now), source: "sim" };
  const syncedAt = now.toISOString();
  const matches = fixtures.map((fixture: EspnFixture, index) => {
    const home = teamForEspn(league, fixture.home.name, fixture.home.abbreviation, standings);
    const away = teamForEspn(league, fixture.away.name, fixture.away.abbreviation, standings);
    const { expectedHome, expectedAway } = expectedGoals(league, home, away);
    const seed = hashNumber(`${fixture.id}:${home.name}:${away.name}`);
    const prediction = predict({
      expectedHome,
      expectedAway,
      seed,
      finalHome: fixture.status === "finished" ? fixture.home.score : null,
      finalAway: fixture.status === "finished" ? fixture.away.score : null,
    });
    return {
      id: makeId(dateKey, league.id, index),
      kickoff: fixture.kickoff,
      status: fixture.status,
      league,
      home,
      away,
      homeGoals: fixture.home.score,
      awayGoals: fixture.away.score,
      htHomeGoals: null,
      htAwayGoals: null,
      roundName: fixture.roundName,
      venue: fixture.venue,
      broadcast: fixture.broadcast,
      source: "espn",
      syncedAt,
      prediction,
    } satisfies MatchView;
  });
  return { matches, source: "espn" };
}

export const getAllLeagues = cache(async (): Promise<League[]> => LEAGUES);

export const getLeagueBySlug = cache(async (slug: string): Promise<League | null> => {
  return LEAGUES.find((league) => league.slug === slug) ?? null;
});

export const getTeamsForLeague = cache(async (leagueId: number): Promise<Team[]> => {
  const league = LEAGUES.find((item) => item.id === leagueId);
  if (!league) return [];
  const standings = await fetchStandings(league.externalId);
  const base = baseTeamsForLeague(league.id);
  if (!standings.length) return base;
  return standings.map((standing) => ratingFromStanding(league, standing, findBaseTeamByName(league.id, standing.name)));
});

export async function getMatchesForDay(dateKey: string): Promise<MatchView[]> {
  const key = isValidDayKey(dateKey) ? dateKey : todayKey();
  const cached = dayCache.get(key);
  if (cached) return cached;
  const promise = (async () => {
    const now = new Date();
    const results = await Promise.all(LEAGUES.map((league) => fetchLeagueDay(league, key, now)));
    const liveSource = results.some((result) => result.source === "espn");
    const matches = results
      .flatMap((result) => result.matches)
      .sort((a, b) => a.kickoff.localeCompare(b.kickoff) || a.league.id - b.league.id);
    if (!liveSource) return matches;
    return matches.map((match) => (match.source === "sim" ? { ...match, source: "sim" as const } : match));
  })();
  dayCache.set(key, promise);
  promise.catch(() => dayCache.delete(key));
  return promise;
}

export async function getMatchById(id: number): Promise<MatchView | null> {
  const raw = String(id);
  if (!/^\d{12}$/.test(raw)) return null;
  const dateKey = `${raw.slice(0, 4)}-${raw.slice(4, 6)}-${raw.slice(6, 8)}`;
  if (!isValidDayKey(dateKey)) return null;
  const matches = await getMatchesForDay(dateKey);
  return matches.find((match) => match.id === id) ?? null;
}

export function summarise(date: string, matches: MatchView[]): BoardSummary {
  const totalMatches = matches.length;
  const confidence = totalMatches
    ? matches.reduce((sum, match) => sum + (match.prediction?.confidence ?? 0), 0) / totalMatches
    : 0;
  return {
    date,
    totalMatches,
    averageConfidence: confidence,
    valuePicks: matches.filter((match) => (match.prediction?.valueEdge ?? 0) > 0.04).length,
    liveMatches: matches.filter((match) => match.status === "live").length,
    finishedMatches: matches.filter((match) => match.status === "finished").length,
  };
}

function buildArchive(now = new Date()): MatchView[] {
  const archive: MatchView[] = [];
  for (let offset = 1; offset <= 12; offset += 1) {
    const day = dayKeyFrom(addDays(now, -offset));
    for (const league of LEAGUES) {
      archive.push(...simulateLeagueDay(league, day, now).map((match) => ({ ...match, status: "finished" as const })));
    }
  }
  return archive.filter((match) => match.prediction);
}

export const getAccuracyReport = cache(async (): Promise<AccuracyReport> => {
  const archive = buildArchive();
  const sampleSize = archive.length;
  const rate = (predicate: (match: MatchView) => boolean | null) => {
    const rows = archive.filter((match) => predicate(match) !== null);
    if (!rows.length) return 0;
    return rows.filter((match) => predicate(match) === true).length / rows.length;
  };
  const hitRate = rate((match) => match.prediction?.hitOutcome ?? null);
  const overRate = rate((match) => match.prediction?.hitOver25 ?? null);
  const correctScoreRate = rate((match) => match.prediction?.hitCorrectScore ?? null);
  const brierScore = sampleSize
    ? archive.reduce((sum, match) => {
        const prediction = match.prediction;
        if (!prediction || match.homeGoals === null || match.awayGoals === null) return sum;
        const actual = match.homeGoals > match.awayGoals ? 0 : match.homeGoals === match.awayGoals ? 1 : 2;
        const probs = [prediction.probHome, prediction.probDraw, prediction.probAway];
        return sum + probs.reduce((inner, probability, index) => inner + (probability - (index === actual ? 1 : 0)) ** 2, 0);
      }, 0) / sampleSize
    : 0;

  const byMarket = [
    { market: "primary", label: "Primary tip", hitRate },
    { market: "result", label: "Match result (1X2)", hitRate: rate((match) => {
      const prediction = match.prediction;
      if (!prediction || match.homeGoals === null || match.awayGoals === null) return null;
      const actual = match.homeGoals > match.awayGoals ? "H" : match.homeGoals === match.awayGoals ? "D" : "A";
      const pick = prediction.probHome >= prediction.probDraw && prediction.probHome >= prediction.probAway ? "H" : prediction.probDraw >= prediction.probAway ? "D" : "A";
      return actual === pick;
    }) },
    { market: "totals", label: "Over/under 2.5", hitRate: overRate },
    { market: "btts", label: "Both teams to score", hitRate: rate((match) => match.prediction?.hitBtts ?? null) },
    { market: "correct-score", label: "Correct score", hitRate: correctScoreRate },
    { market: "ht-ft", label: "Half-time / full-time", hitRate: rate((match) => match.prediction?.hitHtft ?? null) },
  ];

  const trend = Array.from({ length: 7 }, (_, index) => {
    const day = dayKeyFrom(addDays(new Date(), -(7 - index)));
    const rows = archive.filter((match) => match.kickoff.slice(0, 10) === day);
    const hits = rows.filter((match) => match.prediction?.hitOutcome === true).length;
    return { day, hitRate: rows.length ? hits / rows.length : 0, sampleSize: rows.length };
  });

  const byLeague = LEAGUES.map((league) => {
    const rows = archive.filter((match) => match.league.id === league.id);
    const hits = rows.filter((match) => match.prediction?.hitOutcome === true).length;
    const overs = rows.filter((match) => match.prediction?.hitOver25 === true).length;
    const scores = rows.filter((match) => match.prediction?.hitCorrectScore === true).length;
    return {
      slug: league.slug,
      name: league.name,
      flag: league.flag,
      sampleSize: rows.length,
      hitRate: rows.length ? hits / rows.length : 0,
      overRate: rows.length ? overs / rows.length : 0,
      correctScoreRate: rows.length ? scores / rows.length : 0,
    };
  }).sort((a, b) => b.hitRate - a.hitRate);

  const tipMap = new Map<string, { tip: string; label: string; hits: number; sampleSize: number }>();
  for (const match of archive) {
    const prediction = match.prediction;
    if (!prediction) continue;
    const current = tipMap.get(prediction.tipMarket) ?? { tip: prediction.tipMarket, label: prediction.tipLabel, hits: 0, sampleSize: 0 };
    current.sampleSize += 1;
    if (prediction.hitOutcome) current.hits += 1;
    tipMap.set(prediction.tipMarket, current);
  }
  const byTip = [...tipMap.values()]
    .map((row) => ({ tip: row.tip, label: row.label, hitRate: row.sampleSize ? row.hits / row.sampleSize : 0, sampleSize: row.sampleSize }))
    .sort((a, b) => b.sampleSize - a.sampleSize);

  return {
    dataSource: "sim",
    sampleSize,
    hitRate,
    brierScore,
    overRate,
    correctScoreRate,
    byMarket,
    trend,
    byLeague,
    byTip,
  };
});

export async function getRecentSettled(limit = 6): Promise<MatchView[]> {
  const now = new Date();
  const days = [dayKeyFrom(addDays(now, -1)), dayKeyFrom(now)];
  const matches = (await Promise.all(days.map((day) => getMatchesForDay(day)))).flat();
  return matches
    .filter((match) => match.status === "finished" && match.prediction)
    .sort((a, b) => b.kickoff.localeCompare(a.kickoff))
    .slice(0, limit);
}
