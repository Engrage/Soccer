/**
 * GoalSeer prediction engine.
 *
 * Core model: bivariate Poisson with a Dixon-Coles low-score correction.
 * Inputs are team attack / defence multipliers relative to league average,
 * plus a short-term form factor. Every market is derived from the same
 * scoreline matrix so the numbers stay internally consistent.
 */

export const MAX_GOALS = 8;

const FACTORIALS: number[] = [1, 1];
for (let i = 2; i <= MAX_GOALS + 1; i += 1) {
  FACTORIALS[i] = FACTORIALS[i - 1] * i;
}

export function poissonPmf(lambda: number, k: number): number {
  const capped = Math.max(lambda, 0.0001);
  return (Math.exp(-capped) * capped ** k) / FACTORIALS[k];
}

/** Dixon-Coles tau correction for 0-0, 1-0, 0-1 and 1-1 scorelines. */
function tau(home: number, away: number, lambdaHome: number, lambdaAway: number, rho: number): number {
  if (home === 0 && away === 0) return 1 - lambdaHome * lambdaAway * rho;
  if (home === 0 && away === 1) return 1 + lambdaHome * rho;
  if (home === 1 && away === 0) return 1 + lambdaAway * rho;
  if (home === 1 && away === 1) return 1 - rho;
  return 1;
}

export function scoreMatrix(
  lambdaHome: number,
  lambdaAway: number,
  rho = -0.06,
): number[][] {
  const grid: number[][] = [];
  let total = 0;
  for (let h = 0; h <= MAX_GOALS; h += 1) {
    grid[h] = [];
    for (let a = 0; a <= MAX_GOALS; a += 1) {
      const raw =
        poissonPmf(lambdaHome, h) *
        poissonPmf(lambdaAway, a) *
        tau(h, a, lambdaHome, lambdaAway, rho);
      const safe = Math.max(raw, 0);
      grid[h][a] = safe;
      total += safe;
    }
  }
  for (let h = 0; h <= MAX_GOALS; h += 1) {
    for (let a = 0; a <= MAX_GOALS; a += 1) {
      grid[h][a] /= total;
    }
  }
  return grid;
}

function independentGrid(lambdaHome: number, lambdaAway: number): number[][] {
  const grid: number[][] = [];
  let total = 0;
  for (let h = 0; h <= MAX_GOALS; h += 1) {
    grid[h] = [];
    for (let a = 0; a <= MAX_GOALS; a += 1) {
      const raw = poissonPmf(lambdaHome, h) * poissonPmf(lambdaAway, a);
      grid[h][a] = raw;
      total += raw;
    }
  }
  for (let h = 0; h <= MAX_GOALS; h += 1) {
    for (let a = 0; a <= MAX_GOALS; a += 1) grid[h][a] /= total;
  }
  return grid;
}

export const HTFT_KEYS = [
  "HH",
  "HD",
  "HA",
  "DH",
  "DD",
  "DA",
  "AH",
  "AD",
  "AA",
] as const;

export type HtftKey = (typeof HTFT_KEYS)[number];

export const HTFT_LABELS: Record<HtftKey, string> = {
  HH: "Home / Home",
  HD: "Home / Draw",
  HA: "Home / Away",
  DH: "Draw / Home",
  DD: "Draw / Draw",
  DA: "Draw / Away",
  AH: "Away / Home",
  AD: "Away / Draw",
  AA: "Away / Away",
};

export const MARKET_LABELS: Record<string, string> = {
  home: "Home win",
  draw: "Draw",
  away: "Away win",
  "over-1.5": "Over 1.5 goals",
  "over-2.5": "Over 2.5 goals",
  "over-3.5": "Over 3.5 goals",
  "under-2.5": "Under 2.5 goals",
  "under-3.5": "Under 3.5 goals",
  "btts-yes": "Both teams to score",
  "btts-no": "Both teams to score - No",
  "double-1x": "Double chance 1X",
  "double-12": "Double chance 12",
  "double-x2": "Double chance X2",
  "home-cs": "Home clean sheet",
  "away-cs": "Away clean sheet",
};

export type EngineInput = {
  homeAttack: number;
  homeDefense: number;
  homeForm: number;
  awayAttack: number;
  awayDefense: number;
  awayForm: number;
  leagueAverageGoals: number;
  homeAdvantage?: number;
  seed?: number;
  /** Real bookmaker decimal prices for the 1X2 market, when available. */
  bookOdds?: { home?: number | null; draw?: number | null; away?: number | null };
};

export type MarketCandidate = {
  key: string;
  label: string;
  probability: number;
  odds: number;
  edge: number;
};

export type PredictionModel = {
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
  probUnder25: number;
  probBtts: number;
  probHomeCleanSheet: number;
  probAwayCleanSheet: number;
  topScores: { score: string; probability: number }[];
  htft: { outcome: HtftKey; label: string; probability: number }[];
  doubleChance: { outcome: "1X" | "12" | "X2"; probability: number }[];
  candidates: MarketCandidate[];
  tip: { key: string; label: string; probability: number; odds: number; edge: number };
  altTip: { key: string; label: string; probability: number; odds: number; edge: number };
  confidence: number;
  oddsHome: number;
  oddsDraw: number;
  oddsAway: number;
  valueEdge: number;
  grid: number[][];
};

function mulberry32(seed: number) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

function round(value: number, digits = 4) {
  const factor = 10 ** digits;
  return Math.round(value * factor) / factor;
}

/**
 * Converts a market-implied probability into a decimal price that includes a
 * bookmaker overround. Implied probabilities deliberately deviate from the
 * model probability — that gap is where value (or the lack of it) comes from.
 */
function price(implied: number, overround: number) {
  const fair = 1 / clamp(implied, 0.02, 0.98);
  return round(fair / (1 + overround), 2);
}

export function buildPrediction(input: EngineInput): PredictionModel {
  const homeAdvantage = input.homeAdvantage ?? 1.14;
  const base = input.leagueAverageGoals / 2;

  const homeAttackForm = clamp(input.homeAttack * (0.82 + input.homeForm * 0.18), 0.45, 2.1);
  const awayAttackForm = clamp(input.awayAttack * (0.82 + input.awayForm * 0.18), 0.45, 2.1);

  const expectedHome = clamp(
    base * homeAdvantage * homeAttackForm * input.awayDefense,
    0.22,
    4.6,
  );
  const expectedAway = clamp(
    base * (2 - homeAdvantage) * awayAttackForm * input.homeDefense,
    0.18,
    4.4,
  );

  const grid = scoreMatrix(expectedHome, expectedAway);

  let probHome = 0;
  let probDraw = 0;
  let probAway = 0;
  let probOver15 = 0;
  let probOver25 = 0;
  let probOver35 = 0;
  let probBtts = 0;
  let homeCleanSheet = 0;
  let awayCleanSheet = 0;

  for (let h = 0; h <= MAX_GOALS; h += 1) {
    for (let a = 0; a <= MAX_GOALS; a += 1) {
      const p = grid[h][a];
      if (h > a) probHome += p;
      else if (h === a) probDraw += p;
      else probAway += p;

      const totalGoals = h + a;
      if (totalGoals > 1.5) probOver15 += p;
      if (totalGoals > 2.5) probOver25 += p;
      if (totalGoals > 3.5) probOver35 += p;
      if (h > 0 && a > 0) probBtts += p;
      if (a === 0) homeCleanSheet += p;
      if (h === 0) awayCleanSheet += p;
    }
  }

  const scorelines: { score: string; probability: number }[] = [];
  for (let h = 0; h <= MAX_GOALS; h += 1) {
    for (let a = 0; a <= MAX_GOALS; a += 1) {
      if (h <= 5 && a <= 5) {
        scorelines.push({ score: `${h}-${a}`, probability: grid[h][a] });
      }
    }
  }
  scorelines.sort((x, y) => y.probability - x.probability);
  const topScores = scorelines.slice(0, 6).map((line) => ({
    score: line.score,
    probability: round(line.probability),
  }));

  const best = scorelines[0];
  const scoreHome = Number(best.score.split("-")[0]);
  const scoreAway = Number(best.score.split("-")[1]);

  // Half-time / full-time via independent half grids (44% of scoring in H1).
  const firstHalf = independentGrid(expectedHome * 0.44, expectedAway * 0.44);
  const secondHalf = independentGrid(expectedHome * 0.56, expectedAway * 0.56);
  const htftTotals: Record<HtftKey, number> = {
    HH: 0,
    HD: 0,
    HA: 0,
    DH: 0,
    DD: 0,
    DA: 0,
    AH: 0,
    AD: 0,
    AA: 0,
  };
  for (let hi = 0; hi <= 5; hi += 1) {
    for (let ai = 0; ai <= 5; ai += 1) {
      const htResult = hi > ai ? "H" : hi === ai ? "D" : "A";
      for (let fj = hi; fj <= 8; fj += 1) {
        for (let fa = ai; fa <= 8; fa += 1) {
          const ftResult = fj > fa ? "H" : fj === fa ? "D" : "A";
          const key = `${htResult}${ftResult}` as HtftKey;
          if (htftTotals[key] === undefined) continue;
          htftTotals[key] += firstHalf[hi][ai] * secondHalf[fj - hi][fa - ai];
        }
      }
    }
  }
  const htft = HTFT_KEYS.map((key) => ({
    outcome: key,
    label: HTFT_LABELS[key],
    probability: round(htftTotals[key]),
  })).sort((a, b) => b.probability - a.probability);

  const doubleChance = [
    { outcome: "1X" as const, probability: round(probHome + probDraw) },
    { outcome: "12" as const, probability: round(probHome + probAway) },
    { outcome: "X2" as const, probability: round(probDraw + probAway) },
  ].sort((a, b) => b.probability - a.probability);

  const marketRandom = mulberry32((Math.abs(Math.floor(input.seed ?? 7)) % 100003) + 17);
  /** Relative gap between what the market implies and what the model believes. */
  const skew = () => 1 + (marketRandom() - 0.5) * 0.26;

  const impliedRawHome = clamp(probHome * skew(), 0.03, 0.96);
  const impliedRawDraw = clamp(probDraw * skew(), 0.03, 0.96);
  const impliedRawAway = clamp(probAway * skew(), 0.03, 0.96);
  const impliedSum = impliedRawHome + impliedRawDraw + impliedRawAway;

  // Real bookmaker prices win over the synthetic market whenever we have them.
  const oddsHome =
    input.bookOdds?.home && input.bookOdds.home > 1.01
      ? input.bookOdds.home
      : price(impliedRawHome / impliedSum, 0.055);
  const oddsDraw =
    input.bookOdds?.draw && input.bookOdds.draw > 1.01
      ? input.bookOdds.draw
      : price(impliedRawDraw / impliedSum, 0.055);
  const oddsAway =
    input.bookOdds?.away && input.bookOdds.away > 1.01
      ? input.bookOdds.away
      : price(impliedRawAway / impliedSum, 0.055);

  const marketPrice = (probability: number, overround = 0.06) =>
    price(clamp(probability * skew(), 0.03, 0.97), overround);

  const candidates: MarketCandidate[] = [
    { key: "home", label: "Home win", probability: probHome, odds: oddsHome },
    { key: "draw", label: "Draw", probability: probDraw, odds: oddsDraw },
    { key: "away", label: "Away win", probability: probAway, odds: oddsAway },
    { key: "over-2.5", label: "Over 2.5 goals", probability: probOver25, odds: marketPrice(probOver25) },
    { key: "under-2.5", label: "Under 2.5 goals", probability: 1 - probOver25, odds: marketPrice(1 - probOver25) },
    { key: "over-1.5", label: "Over 1.5 goals", probability: probOver15, odds: marketPrice(probOver15, 0.05) },
    { key: "over-3.5", label: "Over 3.5 goals", probability: probOver35, odds: marketPrice(probOver35, 0.07) },
    { key: "btts-yes", label: "Both teams to score", probability: probBtts, odds: marketPrice(probBtts) },
    { key: "btts-no", label: "BTTS - No", probability: 1 - probBtts, odds: marketPrice(1 - probBtts) },
    {
      key: `double-${doubleChance[0].outcome.toLowerCase()}`,
      label: `Double chance ${doubleChance[0].outcome}`,
      probability: doubleChance[0].probability,
      odds: marketPrice(doubleChance[0].probability, 0.05),
    },
    {
      key: `double-${doubleChance[1].outcome.toLowerCase()}`,
      label: `Double chance ${doubleChance[1].outcome}`,
      probability: doubleChance[1].probability,
      odds: marketPrice(doubleChance[1].probability, 0.05),
    },
  ].map((candidate) => ({
    ...candidate,
    probability: round(candidate.probability),
    edge: round(candidate.probability * candidate.odds - 1),
  }));

  const ranked = [...candidates]
    .filter((candidate) => candidate.probability >= 0.42)
    .sort(
      (a, b) =>
        b.edge + 0.35 * (b.probability - 0.5) - (a.edge + 0.35 * (a.probability - 0.5)) ||
        b.probability - a.probability,
    );

  const primaryPool = ranked.filter((candidate) => candidate.probability >= 0.5);
  const tip =
    primaryPool.length > 0
      ? primaryPool[0]
      : ranked[0] ?? candidates.reduce((bestOne, c) => (c.probability > bestOne.probability ? c : bestOne));

  const altTip =
    [...ranked]
      .filter((candidate) => candidate.key !== tip.key && candidate.probability >= 0.45)
      .sort((a, b) => b.probability - a.probability)[0] ??
    candidates.reduce((bestOne, c) => (c.probability > bestOne.probability ? c : bestOne));

  const oneXTwo = [probHome, probDraw, probAway].sort((a, b) => b - a);
  const lead = oneXTwo[0] - oneXTwo[1];
  const strongestMarket = Math.max(
    tip.probability,
    probOver25,
    1 - probOver25,
    probBtts,
    1 - probBtts,
  );
  const confidence = Math.round(
    clamp(
      100 * (0.58 * strongestMarket + 0.28 * clamp(lead * 2.6, 0, 1) + 0.14 * clamp(tip.probability, 0, 1)),
      38,
      94,
    ),
  );

  return {
    expectedHome: round(expectedHome, 2),
    expectedAway: round(expectedAway, 2),
    scoreHome,
    scoreAway,
    probHome: round(probHome),
    probDraw: round(probDraw),
    probAway: round(probAway),
    probOver15: round(probOver15),
    probOver25: round(probOver25),
    probOver35: round(probOver35),
    probUnder25: round(1 - probOver25),
    probBtts: round(probBtts),
    probHomeCleanSheet: round(homeCleanSheet),
    probAwayCleanSheet: round(awayCleanSheet),
    topScores,
    htft,
    doubleChance,
    candidates,
    tip: {
      key: tip.key,
      label: tip.label,
      probability: tip.probability,
      odds: tip.odds,
      edge: tip.edge,
    },
    altTip: {
      key: altTip.key,
      label: altTip.label,
      probability: altTip.probability,
      odds: altTip.odds,
      edge: altTip.edge,
    },
    confidence,
    oddsHome,
    oddsDraw,
    oddsAway,
    valueEdge: tip.edge,
    grid,
  };
}

/** Sample a plausible final score from the model (used to settle historic games). */
export function sampleScore(model: PredictionModel, seed: number): { home: number; away: number } {
  const random = mulberry32(seed * 7919 + 104729);
  const target = random();
  let cumulative = 0;
  for (let h = 0; h <= MAX_GOALS; h += 1) {
    for (let a = 0; a <= MAX_GOALS; a += 1) {
      cumulative += model.grid[h][a];
      if (cumulative >= target) return { home: h, away: a };
    }
  }
  return { home: model.scoreHome, away: model.scoreAway };
}

export function halfTimeScore(fullHome: number, fullAway: number, seed: number) {
  const random = mulberry32(seed * 31337 + 71);
  const home = Math.round(fullHome * (0.3 + random() * 0.25));
  const away = Math.round(fullAway * (0.3 + random() * 0.25));
  return {
    home: Math.min(home, fullHome),
    away: Math.min(away, fullAway),
  };
}

export function settleFlags(
  model: PredictionModel,
  homeGoals: number,
  awayGoals: number,
  htHome: number,
  htAway: number,
) {
  const total = homeGoals + awayGoals;
  const result = homeGoals > awayGoals ? "H" : homeGoals === awayGoals ? "D" : "A";
  const htResult = htHome > htAway ? "H" : htHome === htAway ? "D" : "A";

  const outcomeKey = result === "H" ? "home" : result === "D" ? "draw" : "away";
  const totalsKeys = [
    total > 2.5 ? "over-2.5" : "under-2.5",
    total > 1.5 ? "over-1.5" : null,
    total > 3.5 ? "over-3.5" : null,
  ].filter(Boolean) as string[];
  const bttsKey = homeGoals > 0 && awayGoals > 0 ? "btts-yes" : "btts-no";
  const doubleKeys =
    result === "H"
      ? ["double-1x", "double-12"]
      : result === "D"
        ? ["double-1x", "double-x2"]
        : ["double-x2", "double-12"];

  const modelTip = model.tip.key;
  const hit =
    modelTip === outcomeKey ||
    totalsKeys.includes(modelTip) ||
    modelTip === bttsKey ||
    doubleKeys.includes(modelTip);

  const hitHtft =
    model.htft[0].outcome === `${htResult}${result}` ||
    model.htft.slice(0, 3).some((line) => line.outcome === `${htResult}${result}`);

  return {
    hitOutcome: Boolean(hit),
    hitOver25: total > 2.5 ? model.probOver25 >= 0.5 : model.probOver25 < 0.5,
    hitBtts:
      homeGoals > 0 && awayGoals > 0 ? model.probBtts >= 0.5 : model.probBtts < 0.5,
    hitCorrectScore:
      homeGoals === model.scoreHome && awayGoals === model.scoreAway,
    hitHtft,
  };
}
