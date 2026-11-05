export type StandingRow = {
  id: string;
  name: string;
  abbreviation: string;
  rank: number;
  points: number;
  gamesPlayed: number;
  wins: number;
  ties: number;
  losses: number;
  goalsFor: number;
  goalsAgainst: number;
};

export type EspnFixture = {
  id: string;
  kickoff: string;
  status: "scheduled" | "live" | "finished";
  roundName: string;
  venue: string | null;
  broadcast: string | null;
  home: { name: string; abbreviation: string; score: number | null };
  away: { name: string; abbreviation: string; score: number | null };
};

const ESPN_BASE = "https://site.api.espn.com/apis/site/v2/sports/soccer";
const ESPN_V2 = "https://site.api.espn.com/apis/v2/sports/soccer";

async function fetchJson<T>(url: string, revalidate = 60): Promise<T | null> {
  try {
    const response = await fetch(url, {
      next: { revalidate },
      signal: AbortSignal.timeout(4500),
      headers: { "User-Agent": "GoalSeer/1.0" },
    });
    if (!response.ok) return null;
    return (await response.json()) as T;
  } catch {
    return null;
  }
}

function statValue(stats: Array<{ name?: string; value?: number }> | undefined, name: string): number {
  const stat = stats?.find((item) => item.name === name);
  return typeof stat?.value === "number" ? stat.value : 0;
}

export async function fetchStandings(externalId: string): Promise<StandingRow[]> {
  const data = await fetchJson<any>(`${ESPN_V2}/${externalId}/standings`, 900);
  const entries =
    data?.children?.[0]?.standings?.entries ??
    data?.standings?.entries ??
    [];
  if (!Array.isArray(entries)) return [];
  return entries
    .map((entry: any) => {
      const team = entry?.team;
      if (!team?.displayName) return null;
      return {
        id: String(team.id ?? team.displayName),
        name: String(team.displayName),
        abbreviation: String(team.abbreviation ?? team.displayName.slice(0, 3)).toUpperCase(),
        rank: statValue(entry.stats, "rank"),
        points: statValue(entry.stats, "points"),
        gamesPlayed: statValue(entry.stats, "gamesPlayed"),
        wins: statValue(entry.stats, "wins"),
        ties: statValue(entry.stats, "ties"),
        losses: statValue(entry.stats, "losses"),
        goalsFor: statValue(entry.stats, "pointsFor"),
        goalsAgainst: statValue(entry.stats, "pointsAgainst"),
      } satisfies StandingRow;
    })
    .filter((row: StandingRow | null): row is StandingRow => row !== null);
}

export async function fetchScoreboard(externalId: string, dateKey: string): Promise<EspnFixture[]> {
  const dates = dateKey.replaceAll("-", "");
  const data = await fetchJson<any>(`${ESPN_BASE}/${externalId}/scoreboard?dates=${dates}`, 60);
  const events = data?.events;
  if (!Array.isArray(events)) return [];
  const fixtures: EspnFixture[] = [];
  for (const event of events) {
    const competition = event?.competitions?.[0];
    const competitors = competition?.competitors;
    if (!Array.isArray(competitors)) continue;
    const home = competitors.find((team: any) => team?.homeAway === "home");
    const away = competitors.find((team: any) => team?.homeAway === "away");
    if (!home?.team?.displayName || !away?.team?.displayName) continue;
    const state = event?.status?.type?.state;
    const status = state === "in" ? "live" : state === "post" ? "finished" : "scheduled";
    const score = (value: unknown) => {
      const parsed = Number(value);
      return Number.isFinite(parsed) ? parsed : null;
    };
    fixtures.push({
      id: String(event.id ?? `${home.team.displayName}-${away.team.displayName}`),
      kickoff: String(event.date ?? `${dateKey}T15:00:00Z`),
      status,
      roundName: String(competition?.round?.name ?? competition?.type?.name ?? "Matchday"),
      venue: competition?.venue?.fullName ?? null,
      broadcast: competition?.broadcasts?.[0]?.names?.[0] ?? null,
      home: {
        name: String(home.team.displayName),
        abbreviation: String(home.team.abbreviation ?? home.team.displayName.slice(0, 3)).toUpperCase(),
        score: score(home.score),
      },
      away: {
        name: String(away.team.displayName),
        abbreviation: String(away.team.abbreviation ?? away.team.displayName.slice(0, 3)).toUpperCase(),
        score: score(away.score),
      },
    });
  }
  return fixtures;
}
