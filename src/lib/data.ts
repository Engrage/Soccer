export type League = {
  id: number;
  slug: string;
  name: string;
  country: string;
  flag: string;
  tier: number;
  accent: string;
  externalId: string;
  averageGoals: number;
};

export type Team = {
  id: number;
  leagueId: number;
  name: string;
  abbreviation: string;
  attack: number;
  defense: number;
  elo: number;
  form: number;
  lastFive: string[];
  record?: string;
};

export const LEAGUES: League[] = [
  { id: 1, slug: "premier-league", name: "Premier League", country: "England", flag: "🏴", tier: 1, accent: "#16d6a0", externalId: "eng.1", averageGoals: 2.8 },
  { id: 2, slug: "la-liga", name: "La Liga", country: "Spain", flag: "🇪", tier: 1, accent: "#fbbf24", externalId: "esp.1", averageGoals: 2.6 },
  { id: 3, slug: "bundesliga", name: "Bundesliga", country: "Germany", flag: "🇩🇪", tier: 1, accent: "#fb7185", externalId: "ger.1", averageGoals: 3.1 },
  { id: 4, slug: "serie-a", name: "Serie A", country: "Italy", flag: "🇮🇹", tier: 1, accent: "#38bdf8", externalId: "ita.1", averageGoals: 2.6 },
  { id: 5, slug: "ligue-1", name: "Ligue 1", country: "France", flag: "🇫🇷", tier: 1, accent: "#818cf8", externalId: "fra.1", averageGoals: 2.7 },
  { id: 6, slug: "eredivisie", name: "Eredivisie", country: "Netherlands", flag: "🇳🇱", tier: 1, accent: "#f97316", externalId: "ned.1", averageGoals: 3.0 },
  { id: 7, slug: "primeira-liga", name: "Primeira Liga", country: "Portugal", flag: "🇵🇹", tier: 1, accent: "#22c55e", externalId: "por.1", averageGoals: 2.6 },
  { id: 8, slug: "championship", name: "Championship", country: "England", flag: "🏴", tier: 2, accent: "#a3e635", externalId: "eng.2", averageGoals: 2.6 },
  { id: 9, slug: "mls", name: "MLS", country: "USA", flag: "🇺🇸", tier: 1, accent: "#e879f9", externalId: "usa.1", averageGoals: 2.9 },
  { id: 10, slug: "brasileirao", name: "Brasileirão", country: "Brazil", flag: "🇧", tier: 1, accent: "#facc15", externalId: "bra.1", averageGoals: 2.4 },
  { id: 11, slug: "liga-profesional", name: "Liga Profesional", country: "Argentina", flag: "🇦🇷", tier: 1, accent: "#7dd3fc", externalId: "arg.1", averageGoals: 2.4 },
  { id: 12, slug: "liga-mx", name: "Liga MX", country: "Mexico", flag: "🇲🇽", tier: 1, accent: "#f472b6", externalId: "mex.1", averageGoals: 2.6 },
  { id: 13, slug: "scottish-premiership", name: "Scottish Premiership", country: "Scotland", flag: "🏴", tier: 1, accent: "#c084fc", externalId: "sco.1", averageGoals: 2.8 },
  { id: 14, slug: "belgian-pro-league", name: "Belgian Pro League", country: "Belgium", flag: "🇧🇪", tier: 1, accent: "#fde047", externalId: "bel.1", averageGoals: 2.8 },
];

const TEAM_SEEDS: Record<number, [string, string][]> = {
  1: [["Arsenal", "ARS"], ["Manchester City", "MCI"], ["Liverpool", "LIV"], ["Chelsea", "CHE"], ["Tottenham Hotspur", "TOT"], ["Newcastle United", "NEW"], ["Aston Villa", "AVL"], ["Manchester United", "MUN"], ["Brighton", "BHA"], ["West Ham United", "WHU"], ["Everton", "EVE"], ["Fulham", "FUL"]],
  2: [["Real Madrid", "RMA"], ["Barcelona", "BAR"], ["Atlético Madrid", "ATM"], ["Athletic Club", "ATH"], ["Real Sociedad", "RSO"], ["Villarreal", "VIL"], ["Real Betis", "BET"], ["Sevilla", "SEV"], ["Valencia", "VAL"], ["Girona", "GIR"], ["Celta Vigo", "CEL"], ["Mallorca", "MLL"]],
  3: [["Bayern Munich", "FCB"], ["Bayer Leverkusen", "B04"], ["Borussia Dortmund", "BVB"], ["RB Leipzig", "RBL"], ["VfB Stuttgart", "VFB"], ["Eintracht Frankfurt", "SGE"], ["Freiburg", "SCF"], ["Hoffenheim", "TSG"], ["Wolfsburg", "WOB"], ["Mainz 05", "M05"], ["Borussia Mönchengladbach", "BMG"], ["Union Berlin", "FCU"]],
  4: [["Inter Milan", "INT"], ["AC Milan", "MIL"], ["Juventus", "JUV"], ["Napoli", "NAP"], ["Roma", "ROM"], ["Lazio", "LAZ"], ["Atalanta", "ATA"], ["Fiorentina", "FIO"], ["Bologna", "BOL"], ["Torino", "TOR"], ["Genoa", "GEN"], ["Como", "COM"]],
  5: [["Paris Saint-Germain", "PSG"], ["Marseille", "MAR"], ["Monaco", "MON"], ["Lille", "LIL"], ["Lyon", "LYO"], ["Nice", "NIC"], ["Lens", "RCL"], ["Rennes", "REN"], ["Strasbourg", "STR"], ["Toulouse", "TFC"], ["Nantes", "NAN"], ["Brest", "BRE"]],
  6: [["Ajax", "AJA"], ["PSV Eindhoven", "PSV"], ["Feyenoord", "FEY"], ["AZ Alkmaar", "AZ"], ["FC Twente", "TWE"], ["Utrecht", "UTR"], ["Sparta Rotterdam", "SPA"], ["NEC Nijmegen", "NEC"], ["Heerenveen", "HEE"], ["Groningen", "GRO"], ["Excelsior", "EXC"], ["Fortuna Sittard", "SIT"]],
  7: [["Benfica", "BEN"], ["FC Porto", "POR"], ["Sporting CP", "SCP"], ["Braga", "SCB"], ["Vitória Guimarães", "SCV"], ["Moreirense", "MOR"], ["Famalicão", "FAM"], ["Boavista", "BOA"], ["Estoril", "EST"], ["Rio Ave", "RIO"], ["Arouca", "ARO"], ["Gil Vicente", "GIL"]],
  8: [["Leeds United", "LEE"], ["Burnley", "BUR"], ["Sheffield United", "SHU"], ["Sunderland", "SUN"], ["Middlesbrough", "MID"], ["West Bromwich Albion", "WBA"], ["Coventry City", "COV"], ["Norwich City", "NOR"], ["Watford", "WAT"], ["Bristol City", "BRI"], ["Preston North End", "PNE"], ["Queens Park Rangers", "QPR"]],
  9: [["Inter Miami", "MIA"], ["LAFC", "LAF"], ["LA Galaxy", "LAG"], ["Columbus Crew", "CLB"], ["FC Cincinnati", "CIN"], ["Philadelphia Union", "PHI"], ["Seattle Sounders", "SEA"], ["Portland Timbers", "POR"], ["Atlanta United", "ATL"], ["New York City FC", "NYC"], ["Orlando City", "ORL"], ["Toronto FC", "TOR"]],
  10: [["Flamengo", "FLA"], ["Palmeiras", "PAL"], ["Botafogo", "BOT"], ["São Paulo", "SAO"], ["Corinthians", "COR"], ["Fluminense", "FLU"], ["Atlético Mineiro", "CAM"], ["Grêmio", "GRE"], ["Internacional", "INT"], ["Cruzeiro", "CRU"], ["Bahia", "BAH"], ["Fortaleza", "FOR"]],
  11: [["River Plate", "RIV"], ["Boca Juniors", "BOC"], ["Racing Club", "RAC"], ["Independiente", "IND"], ["San Lorenzo", "SAN"], ["Estudiantes", "EST"], ["Vélez Sarsfield", "VEL"], ["Rosario Central", "ROS"], ["Newell's Old Boys", "NOB"], ["Talleres", "TAL"], ["Lanús", "LAN"], ["Argentinos Juniors", "ARG"]],
  12: [["Club América", "AME"], ["Guadalajara", "GDL"], ["Cruz Azul", "CAZ"], ["Pumas UNAM", "UNAM"], ["Tigres UANL", "UANL"], ["Monterrey", "MTY"], ["Toluca", "TOL"], ["Pachuca", "PAC"], ["León", "LEON"], ["Santos Laguna", "SAN"], ["Atlas", "ATL"], ["Necaxa", "NEC"]],
  13: [["Celtic", "CEL"], ["Rangers", "RAN"], ["Hearts", "HEA"], ["Hibernian", "HIB"], ["Aberdeen", "ABE"], ["Dundee United", "DUN"], ["Kilmarnock", "KIL"], ["Motherwell", "MOT"], ["St Mirren", "STM"], ["Ross County", "ROS"], ["Livingston", "LIV"], ["St Johnstone", "STJ"]],
  14: [["Club Brugge", "CLU"], ["Anderlecht", "AND"], ["Genk", "GNK"], ["Gent", "GNT"], ["Antwerp", "ANT"], ["Standard Liège", "STL"], ["Charleroi", "CHA"], ["Mechelen", "MEC"], ["OH Leuven", "OHL"], ["Westerlo", "WES"], ["Cercle Brugge", "CER"], ["Sint-Truiden", "STV"]],
};

function hashString(value: string): number {
  let hash = 2166136261;
  for (let i = 0; i < value.length; i += 1) {
    hash ^= value.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

function formFromSeed(seed: number): { form: number; lastFive: string[] } {
  const results: string[] = [];
  let state = seed >>> 0;
  for (let i = 0; i < 5; i += 1) {
    state = (state * 1664525 + 1013904223) >>> 0;
    const roll = state / 4294967296;
    results.push(roll < 0.5 ? "W" : roll < 0.76 ? "D" : "L");
  }
  const points = results.reduce((sum, result) => sum + (result === "W" ? 3 : result === "D" ? 1 : 0), 0);
  return { form: 0.9 + (points / 15) * 0.2, lastFive: results };
}

export function baseTeamsForLeague(leagueId: number): Team[] {
  const seeds = TEAM_SEEDS[leagueId] ?? [];
  return seeds.map(([name, abbreviation], index) => {
    const { form, lastFive } = formFromSeed(hashString(`${leagueId}:${name}`));
    return {
      id: leagueId * 100 + index,
      leagueId,
      name,
      abbreviation,
      attack: Math.max(0.62, 1.34 - index * 0.052),
      defense: Math.min(1.55, 0.8 + index * 0.047),
      elo: 1840 - index * 27,
      form,
      lastFive,
    };
  });
}

export function findBaseTeamByName(leagueId: number, name: string): Team | undefined {
  const normalized = name.toLowerCase();
  return baseTeamsForLeague(leagueId).find(
    (team) =>
      team.name.toLowerCase() === normalized ||
      normalized.includes(team.name.toLowerCase()) ||
      team.name.toLowerCase().includes(normalized),
  );
}

export function hashNumber(value: string): number {
  return hashString(value);
}
