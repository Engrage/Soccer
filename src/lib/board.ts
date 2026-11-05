import { addDays, dateFromKey, dayKeyFrom, formatDayNumber, isValidDayKey, shortDayLabel, todayKey } from "@/lib/dates";
import { LEAGUES } from "@/lib/data";
import { getAllLeagues, getMatchesForDay, summarise, type BoardSummary, type MatchView } from "@/lib/queries";

export const PAGE_SIZE = 24;

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
] as const;

export type SearchParamsInput = Record<string, string | string[] | undefined>;

export type BoardParams = {
  date: string;
  league: string;
  market: string;
  q: string;
  sort: string;
  minConfidence: number;
  page: number;
  rankMarket?: string;
};

export type DayOption = { key: string; label: string; sub: string; count: number };

export type BoardGroup = { league: (typeof LEAGUES)[number]; matches: MatchView[] };

export type BoardData = {
  rows: MatchView[];
  allRows: MatchView[];
  summary: BoardSummary;
  filteredCount: number;
  pageCount: number;
  days: DayOption[];
  leagues: typeof LEAGUES;
  groups: BoardGroup[];
  topPicks: MatchView[];
};

function first(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

export function parseBoardParams(input: SearchParamsInput, defaults?: Partial<BoardParams>): BoardParams {
  const rawDate = first(input.date) ?? defaults?.date ?? todayKey();
  const date = isValidDayKey(rawDate) ? rawDate : todayKey();
  const league = first(input.league) ?? defaults?.league ?? "all";
  const market = first(input.market) ?? defaults?.market ?? "all";
  const sort = first(input.sort) ?? defaults?.sort ?? "kickoff";
  const q = (first(input.q) ?? "").trim();
  const minConfidence = Number(first(input.minConfidence) ?? 0) || 0;
  const page = Math.max(1, Number(first(input.page) ?? 1) || 1);
  return {
    date,
    league: LEAGUES.some((item) => item.slug === league) ? league : "all",
    market: market === "all" || MARKET_OPTIONS.some((option) => option.value === market) ? market : "all",
    q,
    sort: ["kickoff", "confidence", "value", "probability", "goals"].includes(sort) ? sort : "kickoff",
    minConfidence: Math.max(0, Math.min(95, minConfidence)),
    page,
    rankMarket: defaults?.rankMarket,
  };
}

function marketProbability(match: MatchView, market: string): number {
  const prediction = match.prediction;
  if (!prediction) return 0;
  switch (market) {
    case "home": return prediction.probHome;
    case "draw": return prediction.probDraw;
    case "away": return prediction.probAway;
    case "over-2.5": return prediction.probOver25;
    case "under-2.5": return 1 - prediction.probOver25;
    case "over-3.5": return prediction.probOver35;
    case "btts-yes": return prediction.probBtts;
    case "btts-no": return 1 - prediction.probBtts;
    case "double-1x": return prediction.probHome + prediction.probDraw;
    case "double-12": return prediction.probHome + prediction.probAway;
    case "double-x2": return prediction.probDraw + prediction.probAway;
    default: return prediction.tipProbability;
  }
}

function simulatedDayCount(dateKey: string): number {
  let total = 0;
  for (const league of LEAGUES) {
    const seed = Array.from(`${dateKey}:${league.slug}`).reduce((sum, char) => sum + char.charCodeAt(0), 0);
    total += 2 + (seed % 3);
  }
  return total;
}

export async function loadBoard(params: BoardParams): Promise<BoardData> {
  const [leagues, matches] = await Promise.all([getAllLeagues(), getMatchesForDay(params.date)]);
  const summary = summarise(params.date, matches);
  const query = params.q.toLowerCase();
  const filtered = matches.filter((match) => {
    if (!match.prediction) return false;
    if (params.league !== "all" && match.league.slug !== params.league) return false;
    if (params.market !== "all") {
      if (params.market === "value") {
        if (match.prediction.valueEdge <= 0.04) return false;
      } else if (match.prediction.tipMarket !== params.market) {
        return false;
      }
    }
    if (match.prediction.confidence < params.minConfidence) return false;
    if (query) {
      const haystack = `${match.home.name} ${match.away.name} ${match.league.name} ${match.league.country}`.toLowerCase();
      if (!haystack.includes(query)) return false;
    }
    return true;
  });

  filtered.sort((a, b) => {
    const pa = a.prediction!;
    const pb = b.prediction!;
    switch (params.sort) {
      case "confidence": return pb.confidence - pa.confidence;
      case "value": return pb.valueEdge - pa.valueEdge;
      case "probability": {
        if (params.rankMarket) return marketProbability(b, params.rankMarket) - marketProbability(a, params.rankMarket);
        return pb.tipProbability - pa.tipProbability;
      }
      case "goals": return (pb.expectedHome + pb.expectedAway) - (pa.expectedHome + pa.expectedAway);
      default: return a.kickoff.localeCompare(b.kickoff);
    }
  });

  const pageCount = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const page = Math.min(params.page, pageCount);
  const rows = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);
  const groups: BoardGroup[] = [];
  for (const match of rows) {
    const group = groups.find((item) => item.league.id === match.league.id);
    if (group) group.matches.push(match);
    else groups.push({ league: match.league, matches: [match] });
  }

  const topPicks = [...filtered].sort((a, b) => (b.prediction?.confidence ?? 0) - (a.prediction?.confidence ?? 0)).slice(0, 3);
  const today = todayKey();
  const days: DayOption[] = Array.from({ length: 7 }, (_, index) => {
    const date = dateFromKey(params.date);
    const day = dayKeyFrom(addDays(date, index - 1));
    const count = day === params.date ? matches.length : simulatedDayCount(day);
    return {
      key: day,
      label: shortDayLabel(day),
      sub: day === today ? "Today" : formatDayNumber(day),
      count,
    };
  });

  return {
    rows,
    allRows: filtered,
    summary,
    filteredCount: filtered.length,
    pageCount,
    days,
    leagues,
    groups,
    topPicks,
  };
}
