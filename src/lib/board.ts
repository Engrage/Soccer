import { and, gte, lt, sql } from "drizzle-orm";

import { db } from "@/db";
import { matches } from "@/db/schema";
import {
  addDays,
  dayKeyFrom,
  formatDayNumber,
  isValidDayKey,
  parseDayKey,
  relativeLabel,
  shortDayLabel,
  todayKey,
  weekdayLabel,
} from "@/lib/dates";
import {
  getAllLeagues,
  getMatchesForDay,
  summarise,
  type DaySummary,
  type LeagueView,
  type MatchView,
} from "@/lib/queries";
import { ensureDays } from "@/lib/seed";

export const MARKET_OPTIONS = [
  { value: "home", label: "Home win" },
  { value: "draw", label: "Draw" },
  { value: "away", label: "Away win" },
  { value: "over-2.5", label: "Over 2.5 goals" },
  { value: "under-2.5", label: "Under 2.5 goals" },
  { value: "over-3.5", label: "Over 3.5 goals" },
  { value: "btts-yes", label: "Both teams to score" },
  { value: "btts-no", label: "BTTS - No" },
  { value: "double-1x", label: "Double chance 1X" },
  { value: "double-12", label: "Double chance 12" },
  { value: "double-x2", label: "Double chance X2" },
  { value: "value", label: "Positive value edge" },
];

export const PAGE_SIZE = 36;

export type BoardParams = {
  date: string;
  league: string;
  market: string;
  q: string;
  sort: string;
  minConfidence: number;
  rankMarket: string;
  page: number;
};

export type SearchParamsInput = Record<string, string | string[] | undefined>;

function first(value: string | string[] | undefined): string | undefined {
  if (Array.isArray(value)) return value[0];
  return value;
}

export function parseBoardParams(
  searchParams: SearchParamsInput,
  defaults: Partial<BoardParams> = {},
): BoardParams {
  const dateRaw = first(searchParams.date);
  const fallbackDate = defaults.date ?? todayKey();
  const minConfRaw = Number(first(searchParams.minConfidence) ?? 0);
  const pageRaw = Number(first(searchParams.page) ?? 1);
  return {
    page: Number.isFinite(pageRaw) && pageRaw > 0 ? Math.floor(pageRaw) : 1,
    date: isValidDayKey(dateRaw) ? dateRaw : fallbackDate,
    league: first(searchParams.league) ?? defaults.league ?? "all",
    market: first(searchParams.market) ?? defaults.market ?? "all",
    q: (first(searchParams.q) ?? "").trim(),
    sort: first(searchParams.sort) ?? defaults.sort ?? "kickoff",
    minConfidence: Number.isFinite(minConfRaw) ? Math.min(95, Math.max(0, minConfRaw)) : 0,
    rankMarket: first(searchParams.rank) ?? defaults.rankMarket ?? "all",
  };
}

export type BoardResult = {
  params: BoardParams;
  days: { key: string; label: string; sub: string; count: number }[];
  leagues: LeagueView[];
  /** Paginated slice rendered by the board. */
  rows: MatchView[];
  /** Full filtered set (used by the JSON API). */
  allRows: MatchView[];
  filteredCount: number;
  pageCount: number;
  groups: { league: LeagueView; matches: MatchView[] }[];
  summary: DaySummary;
  topPicks: MatchView[];
};

const DAYS_BACK = 2;
const DAYS_FORWARD = 4;

export function dayWindow(): string[] {
  const today = parseDayKey(todayKey());
  const keys: string[] = [];
  for (let offset = -DAYS_BACK; offset <= DAYS_FORWARD; offset += 1) {
    keys.push(dayKeyFrom(addDays(today, offset)));
  }
  return keys;
}

function marketMatches(match: MatchView, market: string): boolean {
  if (market === "all") return true;
  const prediction = match.prediction;
  if (!prediction) return false;
  if (market === "value") return prediction.valueEdge > 0.04;
  return prediction.tip === market || prediction.altTip === market;
}

function marketProbability(match: MatchView, market: string): number {
  const prediction = match.prediction;
  if (!prediction) return 0;
  switch (market) {
    case "home":
      return prediction.probHome;
    case "draw":
      return prediction.probDraw;
    case "away":
      return prediction.probAway;
    case "over-2.5":
      return prediction.probOver25;
    case "under-2.5":
      return 1 - prediction.probOver25;
    case "over-1.5":
      return prediction.probOver15;
    case "over-3.5":
      return prediction.probOver35;
    case "btts-yes":
      return prediction.probBtts;
    case "btts-no":
      return 1 - prediction.probBtts;
    case "double-1x":
      return prediction.doubleChance.find((line) => line.outcome === "1X")?.probability ?? 0;
    case "double-12":
      return prediction.doubleChance.find((line) => line.outcome === "12")?.probability ?? 0;
    case "double-x2":
      return prediction.doubleChance.find((line) => line.outcome === "X2")?.probability ?? 0;
    default:
      return prediction.tipProbability;
  }
}

export async function loadBoard(params: BoardParams): Promise<BoardResult> {
  const window = dayWindow();
  await ensureDays(window);

  const rangeStart = parseDayKey(window[0]);
  const rangeEnd = addDays(parseDayKey(window[window.length - 1]), 1);

  const countRows = await db
    .select({
      day: sql<string>`to_char(${matches.kickoff}, 'YYYY-MM-DD')`,
      count: sql<number>`count(*)::int`,
    })
    .from(matches)
    .where(and(gte(matches.kickoff, rangeStart), lt(matches.kickoff, rangeEnd)))
    .groupBy(sql`to_char(${matches.kickoff}, 'YYYY-MM-DD')`);

  const counts = new Map(countRows.map((row) => [row.day, row.count]));
  const [leagueList, dayRows] = await Promise.all([getAllLeagues(), getMatchesForDay(params.date)]);

  const needle = params.q.toLowerCase();
  const filtered = dayRows.filter((match) => {
    if (!match.prediction) return false;
    if (params.league !== "all" && match.league.slug !== params.league) return false;
    if (params.minConfidence > 0 && match.prediction.confidence < params.minConfidence) return false;
    if (!marketMatches(match, params.market)) return false;
    if (needle) {
      const haystack = `${match.home.name} ${match.away.name} ${match.league.name} ${match.league.country}`.toLowerCase();
      if (!haystack.includes(needle)) return false;
    }
    return true;
  });

  const sorted = [...filtered].sort((a, b) => {
    switch (params.sort) {
      case "confidence":
        return b.prediction!.confidence - a.prediction!.confidence;
      case "value":
        return b.prediction!.valueEdge - a.prediction!.valueEdge;
      case "probability": {
        const rankMarket = params.rankMarket !== "all" ? params.rankMarket : params.market;
        return (
          marketProbability(b, rankMarket) - marketProbability(a, rankMarket) ||
          b.prediction!.confidence - a.prediction!.confidence
        );
      }
      case "goals":
        return (
          b.prediction!.expectedHome +
          b.prediction!.expectedAway -
          (a.prediction!.expectedHome + a.prediction!.expectedAway)
        );
      default:
        return 0;
    }
  });

  const pageCount = Math.max(1, Math.ceil(sorted.length / PAGE_SIZE));
  const page = Math.min(params.page, pageCount);
  const rows = sorted.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  const groupMap = new Map<number, { league: LeagueView; matches: MatchView[] }>();
  for (const match of rows) {
    const bucket = groupMap.get(match.league.id) ?? { league: match.league, matches: [] };
    bucket.matches.push(match);
    groupMap.set(match.league.id, bucket);
  }
  const groups = [...groupMap.values()];

  return {
    allRows: sorted,
    filteredCount: sorted.length,
    pageCount,
    params: { ...params, page },
    days: window.map((key) => {
      const relative = relativeLabel(key);
      const isRelativeDay = relative !== shortDayLabel(key);
      return {
        key,
        label: formatDayNumber(key),
        sub: isRelativeDay ? relative : weekdayLabel(key),
        count: counts.get(key) ?? 0,
      };
    }),
    leagues: leagueList,
    rows,
    groups,
    summary: summarise(params.date, dayRows),
    topPicks: [...dayRows]
      .filter((match) => match.prediction && match.status !== "finished")
      .sort((a, b) => b.prediction!.confidence - a.prediction!.confidence)
      .slice(0, 3),
  };
}
