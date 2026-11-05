import { NextResponse } from "next/server";

import { loadBoard, parseBoardParams, MARKET_OPTIONS, PAGE_SIZE } from "@/lib/board";

export const dynamic = "force-dynamic";

function lean(row: Awaited<ReturnType<typeof loadBoard>>["rows"][number]) {
  const prediction = row.prediction!;
  return {
    id: row.id,
    kickoff: row.kickoff,
    status: row.status,
    league: row.league.name,
    leagueSlug: row.league.slug,
    home: row.home.name,
    away: row.away.name,
    homeGoals: row.homeGoals,
    awayGoals: row.awayGoals,
    prediction: {
      expectedGoals: [prediction.expectedHome, prediction.expectedAway],
      score: [prediction.scoreHome, prediction.scoreAway],
      probabilities: {
        home: prediction.probHome,
        draw: prediction.probDraw,
        away: prediction.probAway,
      },
      over15: prediction.probOver15,
      over25: prediction.probOver25,
      over35: prediction.probOver35,
      btts: prediction.probBtts,
      topScores: prediction.topScores,
      htft: prediction.htft,
      doubleChance: prediction.doubleChance,
      tip: prediction.tipLabel,
      tipProbability: prediction.tipProbability,
      alternative: prediction.altTipLabel,
      confidence: prediction.confidence,
      odds: [prediction.oddsHome, prediction.oddsDraw, prediction.oddsAway],
      valueEdge: prediction.valueEdge,
    },
  };
}

export async function GET(request: Request) {
  const url = new URL(request.url);
  const raw = Object.fromEntries(url.searchParams.entries());
  const params = parseBoardParams(raw);
  const limit = Math.min(300, Math.max(1, Number(raw.limit ?? 60) || 60));
  const page = Number(raw.page ?? 1) || 1;

  const board = await loadBoard(params);
  const source = page > 1 ? board.rows : board.allRows;
  const slice = page > 1 ? source : source.slice(0, limit);

  return NextResponse.json({
    meta: {
      date: params.date,
      league: params.league,
      market: params.market,
      sort: params.sort,
      minConfidence: params.minConfidence,
      totalMatches: board.summary.totalMatches,
      matched: board.filteredCount,
      returned: slice.length,
      page: params.page,
      pageCount: board.pageCount,
      pageSize: PAGE_SIZE,
      markets: MARKET_OPTIONS,
      days: board.days,
    },
    summary: board.summary,
    predictions: slice.map(lean),
  });
}
