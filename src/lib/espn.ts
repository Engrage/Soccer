/**
 * Live football data client (ESPN public sports API — no key required).
 *
 * Everything on the site is modelled from these real fixtures, real results,
 * real standings and real bookmaker prices.
 */

const BASE = "https://site.api.espn.com/apis/site/v2/sports/soccer";

export type LeagueCode = {
  code: string;
  slug: string;
  name: string;
  country: string;
  flag: string;
  tier: number;
  accent: string;
};

export const LEAGUE_CODES: LeagueCode[] = [
  { code: "eng.1", slug: "premier-league", name: "England Premier League", country: "England", flag: "🏴", tier: 1, accent: "#38bdf8" },
  { code: "esp.1", slug: "laliga", name: "Spain LaLiga", country: "Spain", flag: "🇪🇸", tier: 1, accent: "#f97316" },
  { code: "ger.1", slug: "bundesliga", name: "Germany Bundesliga", country: "Germany", flag: "🇩🇪", tier: 1, accent: "#ef4444" },
  { code: "ita.1", slug: "serie-a", name: "Italy Serie A", country: "Italy", flag: "🇮🇹", tier: 1, accent: "#22d3ee" },
  { code: "fra.1", slug: "ligue-1", name: "France Ligue 1", country: "France", flag: "🇫🇷", tier: 1, accent: "#6366f1" },
  { code: "eng.2", slug: "championship", name: "England Championship", country: "England", flag: "🏴", tier: 2, accent: "#818cf8" },
  { code: "ned.1", slug: "eredivisie", name: "Netherlands Eredivisie", country: "Netherlands", flag: "🇳🇱", tier: 1, accent: "#f59e0b" },
  { code: "por.1", slug: "liga-portugal", name: "Portugal Primeira Liga", country: "Portugal", flag: "🇵🇹", tier: 1, accent: "#10b981" },
  { code: "bel.1", slug: "jupiler-pro-league", name: "Belgium Pro League", country: "Belgium", flag: "🇧🇪", tier: 1, accent: "#facc15" },
  { code: "sco.1", slug: "premiership", name: "Scotland Premiership", country: "Scotland", flag: "🏴", tier: 1, accent: "#0ea5e9" },
  { code: "tur.1", slug: "super-lig", name: "Turkey Super Lig", country: "Turkey", flag: "🇹🇷", tier: 1, accent: "#fb7185" },
  { code: "bra.1", slug: "brasileirao", name: "Brazil Serie A", country: "Brazil", flag: "🇧🇷", tier: 1, accent: "#4ade80" },
  { code: "arg.1", slug: "liga-profesional", name: "Argentina Liga Profesional", country: "Argentina", flag: "🇦🇷", tier: 1, accent: "#60a5fa" },
  { code: "usa.1", slug: "mls", name: "USA MLS", country: "United States", flag: "🇺🇸", tier: 1, accent: "#a78bfa" },
  { code: "mex.1", slug: "liga-mx", name: "Mexico Liga MX", country: "Mexico", flag: "🇲🇽", tier: 1, accent: "#34d399" },
  { code: "jpn.1", slug: "j-league", name: "Japan J1 League", country: "Japan", flag: "🇯🇵", tier: 1, accent: "#f472b6" },
  { code: "uefa.champions", slug: "champions-league", name: "UEFA Champions League", country: "Europe", flag: "🏆", tier: 1, accent: "#e879f9" },
  { code: "uefa.europa", slug: "europa-league", name: "UEFA Europa League", country: "Europe", flag: "🏅", tier: 1, accent: "#fb923c" },
];

const FLAGS: Record<string, string> = {
  "uefa.champions": "🏆",
  "uefa.europa": "🏅",
};

export type EspnCompetitor = {
  id: string;
  name: string;
  shortName: string;
  abbreviation: string;
  score: string;
  homeAway: "home" | "away";
  record?: string;
};

export type EspnFixture = {
  eventId: string;
  leagueCode: string;
  date: string;
  status: "scheduled" | "live" | "finished";
  statusDetail: string;
  home: EspnCompetitor;
  away: EspnCompetitor;
  homeGoals: number | null;
  awayGoals: number | null;
  htHomeGoals: number | null;
  htAwayGoals: number | null;
  venue: string;
  roundName: string;
  broadcast: string | null;
  odds: {
    provider: string;
    home: number | null;
    draw: number | null;
    away: number | null;
    overUnder: number | null;
  } | null;
};

export type EspnTeamStats = {
  id: string;
  rank: number;
  name: string;
  abbreviation: string;
  gamesPlayed: number;
  goalsFor: number;
  goalsAgainst: number;
  points: number;
  wins: number;
  ties: number;
  losses: number;
  record: string;
};

type CacheEntry<T> = { value: T; expires: number };

const globalCache = globalThis as typeof globalThis & {
  __espnCache?: Map<string, CacheEntry<unknown>>;
  __espnOffline?: boolean;
};

const cache = (globalCache.__espnCache ??= new Map<string, CacheEntry<unknown>>());

export function isLiveDataBlocked(): boolean {
  return Boolean(globalCache.__espnOffline);
}

async function getJson<T>(url: string, ttlMs: number): Promise<T | null> {
  const cached = cache.get(url) as CacheEntry<T> | undefined;
  if (cached && cached.expires > Date.now()) return cached.value;
  try {
    const response = await fetch(url, {
      headers: { accept: "application/json", "accept-encoding": "gzip" },
      cache: "no-store",
      signal: AbortSignal.timeout(9000),
    });
    if (!response.ok) return null;
    const data = (await response.json()) as T;
    cache.set(url, { value: data, expires: Date.now() + ttlMs });
    globalCache.__espnOffline = false;
    return data;
  } catch {
    if (!cached) globalCache.__espnOffline = true;
    return cached?.value ?? null;
  }
}

type RawEvent = {
  id: string;
  date: string;
  status?: { type?: { state?: string; completed?: boolean; shortDetail?: string } };
  season?: { type?: string };
  competitions?: {
    venue?: { fullName?: string };
    status?: { type?: { state?: string; completed?: boolean; shortDetail?: string } };
    notes?: { headline?: string }[];
    broadcasts?: { names?: string[] }[];
    details?: {
      type?: { text?: string; id?: string };
      clock?: { displayValue?: string; value?: number };
      team?: { id?: string };
      scoringPlay?: boolean;
      scoreValue?: number;
    }[];
    competitors?: {
      homeAway?: string;
      score?: string;
      team?: { id?: string; displayName?: string; shortDisplayName?: string; abbreviation?: string };
      records?: { summary?: string }[];
    }[];
    odds?: {
      provider?: { name?: string };
      homeTeamOdds?: { moneyLine?: number };
      awayTeamOdds?: { moneyLine?: number };
      drawOdds?: { moneyLine?: number };
      overUnder?: number;
    }[];
  }[];
};

type RawScoreboard = {
  events?: RawEvent[];
};

function eventList(data: RawScoreboard | null): RawEvent[] {
  return Array.isArray(data?.events) ? data.events : [];
}

/** Half-time score recovered from real scoring plays where available. */
function halfTimeFromDetails(
  details: { type?: { id?: string; text?: string }; clock?: { displayValue?: string }; team?: { id?: string }; scoringPlay?: boolean; scoreValue?: number }[] | undefined,
  homeId: string,
  awayId: string,
): { home: number | null; away: number | null } {
  if (!details || details.length === 0) return { home: null, away: null };
  let home = 0;
  let away = 0;
  let seen = 0;
  for (const detail of details) {
    const isGoal =
      detail.scoringPlay === true ||
      detail.type?.id === "70" ||
      (detail.type?.text ?? "").toLowerCase().includes("goal");
    if (!isGoal) continue;
    const clock = detail.clock?.displayValue ?? "";
    const minute = Number(clock.replace("'", "").split(":")[0]);
    const teamId = detail.team?.id;
    const value = Math.max(1, Number(detail.scoreValue ?? 1));
    seen += 1;
    if (!Number.isFinite(minute)) continue;
    if (minute > 45) continue;
    if (teamId === homeId) home += value;
    else if (teamId === awayId) away += value;
  }
  if (seen === 0) return { home: null, away: null };
  return { home, away };
}

function americanToDecimal(line: number | undefined | null): number | null {
  if (line === undefined || line === null || line === 0) return null;
  const value = Number(line);
  if (!Number.isFinite(value)) return null;
  return value > 0 ? Number((1 + value / 100).toFixed(2)) : Number((1 + 100 / Math.abs(value)).toFixed(2));
}

function parseStatus(raw: RawEvent | undefined): "scheduled" | "live" | "finished" {
  const type = raw?.status?.type ?? raw?.competitions?.[0]?.status?.type;
  if (!type) return "scheduled";
  if (type.state === "post" || type.completed) return "finished";
  if (type.state === "in") return "live";
  return "scheduled";
}

export async function fetchFixturesForDate(leagueCode: string, dateKey: string): Promise<EspnFixture[]> {
  const compact = dateKey.replace(/-/g, "");
  const data = await getJson<RawScoreboard>(
    `${BASE}/${leagueCode}/scoreboard?dates=${compact}&lang=en&region=gb`,
    5 * 60 * 1000,
  );
  const events = eventList(data);

  const fixtures: EspnFixture[] = [];
  for (const event of events) {
    const competition = event.competitions?.[0];
    if (!competition) continue;
    const home = competition.competitors?.find((c) => c.homeAway === "home");
    const away = competition.competitors?.find((c) => c.homeAway === "away");
    if (!home?.team?.id || !away?.team?.id) continue;

    const status = parseStatus(event);
    const oddsRaw = competition.odds?.[0];
    const round =
      competition.notes?.[0]?.headline ??
      event.season?.type ??
      `${leagueCode} fixture`;

    fixtures.push({
      eventId: event.id,
      leagueCode,
      date: event.date,
      status,
      statusDetail:
        event.status?.type?.shortDetail ??
        competition.status?.type?.shortDetail ??
        "",
      home: {
        id: home.team.id,
        name: home.team.displayName ?? "Home",
        shortName: home.team.shortDisplayName ?? home.team.displayName ?? "Home",
        abbreviation: home.team.abbreviation ?? (home.team.displayName ?? "H").slice(0, 3).toUpperCase(),
        score: home.score ?? "0",
        homeAway: "home",
        record: home.records?.[0]?.summary,
      },
      away: {
        id: away.team.id,
        name: away.team.displayName ?? "Away",
        shortName: away.team.shortDisplayName ?? away.team.displayName ?? "Away",
        abbreviation: away.team.abbreviation ?? (away.team.displayName ?? "A").slice(0, 3).toUpperCase(),
        score: away.score ?? "0",
        homeAway: "away",
        record: away.records?.[0]?.summary,
      },
      homeGoals: status === "scheduled" ? null : Number(home.score ?? 0) || 0,
      awayGoals: status === "scheduled" ? null : Number(away.score ?? 0) || 0,
      htHomeGoals:
        status === "finished"
          ? halfTimeFromDetails(competition.details, home.team.id, away.team.id).home
          : null,
      htAwayGoals:
        status === "finished"
          ? halfTimeFromDetails(competition.details, home.team.id, away.team.id).away
          : null,
      venue: competition.venue?.fullName ?? "Venue TBC",
      roundName: round,
      broadcast: competition.broadcasts?.[0]?.names?.[0] ?? null,
      odds: oddsRaw
        ? {
            provider: oddsRaw.provider?.name ?? "Bookmaker",
            home: americanToDecimal(oddsRaw.homeTeamOdds?.moneyLine),
            draw: americanToDecimal(oddsRaw.drawOdds?.moneyLine),
            away: americanToDecimal(oddsRaw.awayTeamOdds?.moneyLine),
            overUnder: oddsRaw.overUnder ?? null,
          }
        : null,
    });
  }
  return fixtures;
}

type RawStandings = {
  standings?: {
    entries?: {
      team?: { id?: string; displayName?: string; abbreviation?: string };
      stats?: { name?: string; value?: number; displayValue?: string }[];
    }[];
  };
  children?: {
    standings?: {
      entries?: {
        team?: { id?: string; displayName?: string; abbreviation?: string };
        stats?: { name?: string; value?: number; displayValue?: string }[];
      }[];
    };
  }[];
};

function extractStandings(data: RawStandings | null): EspnTeamStats[] {
  const entries = data?.children?.[0]?.standings?.entries ?? data?.standings?.entries ?? [];
  const teams: EspnTeamStats[] = [];
  for (const entry of entries) {
    if (!entry.team?.id) continue;
    const stat = (name: string) => Number(entry.stats?.find((s) => s.name === name)?.value ?? 0) || 0;
    const wins = stat("wins");
    const ties = stat("ties");
    const losses = stat("losses");
    const gamesPlayed = stat("gamesPlayed") || wins + ties + losses;
    teams.push({
      id: entry.team.id,
      rank: stat("rank") || 0,
      name: entry.team.displayName ?? "Team",
      abbreviation: entry.team.abbreviation ?? "TBD",
      gamesPlayed,
      goalsFor: stat("pointsFor"),
      goalsAgainst: stat("pointsAgainst"),
      points: stat("points"),
      wins,
      ties,
      losses,
      record: `${wins}-${ties}-${losses}`,
    });
  }
  return teams;
}

/**
 * Standings live on the v2 path and need a season parameter. Autumn leagues
 * ("2026-27") use the start year, calendar-year leagues use the current year,
 * so both candidates are tried before giving up.
 */
export async function fetchStandings(leagueCode: string): Promise<EspnTeamStats[]> {
  const now = new Date();
  const year = now.getUTCFullYear();
  const month = now.getUTCMonth() + 1;
  const autumn = month >= 7 ? year : year - 1;

  const candidates = [
    `https://site.api.espn.com/apis/v2/sports/soccer/${leagueCode}/standings?season=${autumn}&lang=en&region=gb`,
    `https://site.api.espn.com/apis/v2/sports/soccer/${leagueCode}/standings?season=${year}&lang=en&region=gb`,
    `https://site.api.espn.com/apis/site/v2/sports/soccer/${leagueCode}/standings?season=${autumn}&lang=en&region=gb`,
  ];

  for (const url of candidates) {
    const data = await getJson<RawStandings>(url, 6 * 60 * 60 * 1000);
    const teams = extractStandings(data);
    if (teams.length > 0) return teams;
  }
  return [];
}

export function leagueFlag(code: string): string {
  return FLAGS[code] ?? "";
}
