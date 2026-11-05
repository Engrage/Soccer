export const MAX_GOALS = 8;

function factorial(n: number): number {
  let out = 1;
  for (let i = 2; i <= n; i += 1) out *= i;
  return out;
}

function poisson(lambda: number, goals: number): number {
  return (Math.exp(-lambda) * lambda ** goals) / factorial(goals);
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

/**
 * Independent Poisson scoreline grid with a Dixon-Coles low-score correction.
 * rho is negative in football: 0-0 and 1-1 happen slightly more often than
 * pure independence predicts, while 1-0 / 0-1 happen slightly less often.
 */
export function scoreMatrix(lambdaHome: number, lambdaAway: number): number[][] {
  const home = clamp(lambdaHome, 0.05, 4.5);
  const away = clamp(lambdaAway, 0.05, 4.5);
  const rho = -0.08;
  const grid: number[][] = [];
  let total = 0;

  for (let h = 0; h <= MAX_GOALS; h += 1) {
    const row: number[] = [];
    for (let a = 0; a <= MAX_GOALS; a += 1) {
      let p = poisson(home, h) * poisson(away, a);
      if (h === 0 && a === 0) p *= 1 - home * away * rho;
      else if (h === 0 && a === 1) p *= 1 + home * rho;
      else if (h === 1 && a === 0) p *= 1 + away * rho;
      else if (h === 1 && a === 1) p *= 1 - rho;
      p = Math.max(0, p);
      row.push(p);
      total += p;
    }
    grid.push(row);
  }

  return grid.map((row) => row.map((p) => p / total));
}

export type ScoreLine = { score: string; probability: number };
export type HtFtLine = { outcome: string; label: string; probability: number };
export type DoubleChanceLine = { outcome: string; probability: number };

export type Prediction = {
  expectedHome: number;
  expectedAway: number;
  probHome: number;
  probDraw: number;
  probAway: number;
  oddsHome: number;
  oddsDraw: number;
  oddsAway: number;
  probOver15: number;
  probOver25: number;
  probOver35: number;
  probBtts: number;
  probHomeCleanSheet: number;
  probAwayCleanSheet: number;
  scoreHome: number;
  scoreAway: number;
  topScores: ScoreLine[];
  htft: HtFtLine[];
  doubleChance: DoubleChanceLine[];
  tipLabel: string;
  tipProbability: number;
  tipMarket: string;
  tipOdds: number;
  altTipLabel: string;
  altTipProbability: number;
  confidence: number;
  valueEdge: number;
  hitOutcome: boolean | null;
  hitOver25: boolean | null;
  hitCorrectScore: boolean | null;
  hitBtts: boolean | null;
  hitHtft: boolean | null;
};

function resultOf(home: number, away: number): "H" | "D" | "A" {
  if (home > away) return "H";
  if (home === away) return "D";
  return "A";
}

function htftMatrix(lambdaHome: number, lambdaAway: number): HtFtLine[] {
  const firstHome = lambdaHome * 0.44;
  const firstAway = lambdaAway * 0.44;
  const secondHome = lambdaHome * 0.56;
  const secondAway = lambdaAway * 0.56;
  const ht = scoreMatrix(firstHome, firstAway);
  const sh = scoreMatrix(secondHome, secondAway);
  const combos = new Map<string, number>();

  for (let hh = 0; hh <= MAX_GOALS; hh += 1) {
    for (let ha = 0; ha <= MAX_GOALS; ha += 1) {
      const pht = ht[hh][ha];
      if (pht < 1e-7) continue;
      const htResult = resultOf(hh, ha);
      for (let shh = 0; shh <= MAX_GOALS; shh += 1) {
        for (let sha = 0; sha <= MAX_GOALS; sha += 1) {
          const psh = sh[shh][sha];
          if (psh < 1e-7) continue;
          const ftResult = resultOf(hh + shh, ha + sha);
          const key = `${htResult}/${ftResult}`;
          combos.set(key, (combos.get(key) ?? 0) + pht * psh);
        }
      }
    }
  }

  const labels: Record<string, string> = {
    "H/H": "Home / Home",
    "H/D": "Home / Draw",
    "H/A": "Home / Away",
    "D/H": "Draw / Home",
    "D/D": "Draw / Draw",
    "D/A": "Draw / Away",
    "A/H": "Away / Home",
    "A/D": "Away / Draw",
    "A/A": "Away / Away",
  };

  return [...combos.entries()]
    .map(([outcome, probability]) => ({
      outcome,
      label: labels[outcome] ?? outcome,
      probability,
    }))
    .sort((a, b) => b.probability - a.probability);
}

function makeOdds(probability: number, bias: number, overround = 1.06): number {
  const fair = 1 / Math.max(probability, 0.01);
  return Number(clamp((fair / overround) * bias, 1.01, 51).toFixed(2));
}

export type PredictInput = {
  expectedHome: number;
  expectedAway: number;
  seed: number;
  oddsHome?: number;
  oddsDraw?: number;
  oddsAway?: number;
  finalHome?: number | null;
  finalAway?: number | null;
  htHome?: number | null;
  htAway?: number | null;
};

function rng(seed: number): () => number {
  let state = seed >>> 0;
  return () => {
    state = (state * 1664525 + 1013904223) >>> 0;
    return state / 4294967296;
  };
}

export function predict(input: PredictInput): Prediction {
  const expectedHome = clamp(input.expectedHome, 0.15, 4.2);
  const expectedAway = clamp(input.expectedAway, 0.15, 4.2);
  const grid = scoreMatrix(expectedHome, expectedAway);
  const random = rng(input.seed);

  let probHome = 0;
  let probDraw = 0;
  let probAway = 0;
  let probOver15 = 0;
  let probOver25 = 0;
  let probOver35 = 0;
  let probBtts = 0;
  let probHomeCleanSheet = 0;
  let probAwayCleanSheet = 0;
  let scoreHome = 0;
  let scoreAway = 0;
  let bestScore = -1;
  const scores: ScoreLine[] = [];

  for (let h = 0; h <= MAX_GOALS; h += 1) {
    for (let a = 0; a <= MAX_GOALS; a += 1) {
      const p = grid[h][a];
      const total = h + a;
      if (h > a) probHome += p;
      else if (h === a) probDraw += p;
      else probAway += p;
      if (total > 1.5) probOver15 += p;
      if (total > 2.5) probOver25 += p;
      if (total > 3.5) probOver35 += p;
      if (h > 0 && a > 0) probBtts += p;
      if (a === 0) probHomeCleanSheet += p;
      if (h === 0) probAwayCleanSheet += p;
      scores.push({ score: `${h}-${a}`, probability: p });
      if (p > bestScore) {
        bestScore = p;
        scoreHome = h;
        scoreAway = a;
      }
    }
  }

  scores.sort((a, b) => b.probability - a.probability);
  const htft = htftMatrix(expectedHome, expectedAway);
  const doubleChance: DoubleChanceLine[] = [
    { outcome: "1X", probability: probHome + probDraw },
    { outcome: "12", probability: probHome + probAway },
    { outcome: "X2", probability: probDraw + probAway },
  ].sort((a, b) => b.probability - a.probability);

  const bias = () => 0.9 + random() * 0.26;
  const oddsHome = input.oddsHome ?? makeOdds(probHome, bias());
  const oddsDraw = input.oddsDraw ?? makeOdds(probDraw, bias());
  const oddsAway = input.oddsAway ?? makeOdds(probAway, bias());

  const markets = [
    { key: "home", label: "Home win", probability: probHome, odds: oddsHome },
    { key: "draw", label: "Draw", probability: probDraw, odds: oddsDraw },
    { key: "away", label: "Away win", probability: probAway, odds: oddsAway },
    { key: "over-2.5", label: "Over 2.5 goals", probability: probOver25, odds: makeOdds(probOver25, bias()) },
    { key: "under-2.5", label: "Under 2.5 goals", probability: 1 - probOver25, odds: makeOdds(1 - probOver25, bias()) },
    { key: "btts-yes", label: "Both teams to score", probability: probBtts, odds: makeOdds(probBtts, bias()) },
    { key: "btts-no", label: "BTTS - No", probability: 1 - probBtts, odds: makeOdds(1 - probBtts, bias()) },
    { key: "double-1x", label: "Double chance 1X", probability: doubleChance.find((d) => d.outcome === "1X")!.probability, odds: makeOdds(doubleChance.find((d) => d.outcome === "1X")!.probability, bias(), 1.04) },
    { key: "double-12", label: "Double chance 12", probability: doubleChance.find((d) => d.outcome === "12")!.probability, odds: makeOdds(doubleChance.find((d) => d.outcome === "12")!.probability, bias(), 1.04) },
    { key: "double-x2", label: "Double chance X2", probability: doubleChance.find((d) => d.outcome === "X2")!.probability, odds: makeOdds(doubleChance.find((d) => d.outcome === "X2")!.probability, bias(), 1.04) },
  ].map((market) => {
    const edge = market.probability * market.odds - 1;
    const score = market.probability * 0.62 + Math.max(edge, 0) * 0.38 + (market.probability > 0.62 ? 0.04 : 0);
    return { ...market, edge, score };
  });

  markets.sort((a, b) => b.score - a.score);
  const tip = markets[0];
  const alt = markets[1];
  const confidence = Math.round(
    clamp(100 * (0.68 * tip.probability + 0.32 * (1 / (1 + Math.exp(-tip.edge * 6)))), 32, 95),
  );

  const finished =
    input.finalHome !== null &&
    input.finalHome !== undefined &&
    input.finalAway !== null &&
    input.finalAway !== undefined;

  let hitOutcome: boolean | null = null;
  let hitOver25: boolean | null = null;
  let hitCorrectScore: boolean | null = null;
  let hitBtts: boolean | null = null;
  let hitHtft: boolean | null = null;

  if (finished) {
    const fh = input.finalHome as number;
    const fa = input.finalAway as number;
    const actualResult = resultOf(fh, fa);
    const tipResult =
      tip.key === "home" ? "H" : tip.key === "draw" ? "D" : tip.key === "away" ? "A" : null;
    if (tipResult) hitOutcome = tipResult === actualResult;
    else if (tip.key === "over-2.5") hitOutcome = fh + fa > 2.5;
    else if (tip.key === "under-2.5") hitOutcome = fh + fa < 2.5;
    else if (tip.key === "btts-yes") hitOutcome = fh > 0 && fa > 0;
    else if (tip.key === "btts-no") hitOutcome = !(fh > 0 && fa > 0);
    else if (tip.key === "double-1x") hitOutcome = actualResult !== "A";
    else if (tip.key === "double-12") hitOutcome = actualResult !== "D";
    else if (tip.key === "double-x2") hitOutcome = actualResult !== "H";

    hitOver25 = fh + fa > 2.5;
    hitCorrectScore = fh === scoreHome && fa === scoreAway;
    hitBtts = fh > 0 && fa > 0;
    if (input.htHome !== null && input.htHome !== undefined && input.htAway !== null && input.htAway !== undefined) {
      const actualHtft = `${resultOf(input.htHome, input.htAway)}/${actualResult}`;
      hitHtft = htft[0]?.outcome === actualHtft;
    }
  }

  return {
    expectedHome,
    expectedAway,
    probHome,
    probDraw,
    probAway,
    oddsHome,
    oddsDraw,
    oddsAway,
    probOver15,
    probOver25,
    probOver35,
    probBtts,
    probHomeCleanSheet,
    probAwayCleanSheet,
    scoreHome,
    scoreAway,
    topScores: scores.slice(0, 6),
    htft,
    doubleChance,
    tipLabel: tip.label,
    tipProbability: tip.probability,
    tipMarket: tip.key,
    tipOdds: tip.odds,
    altTipLabel: alt.label,
    altTipProbability: alt.probability,
    confidence,
    valueEdge: tip.edge,
    hitOutcome,
    hitOver25,
    hitCorrectScore,
    hitBtts,
    hitHtft,
  };
}
