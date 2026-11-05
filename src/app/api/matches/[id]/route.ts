import { NextResponse } from "next/server";

import { getMatchById, getMatchesForDay } from "@/lib/queries";
import { dayKeyFrom } from "@/lib/dates";
import { scoreMatrix } from "@/lib/predict";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const numericId = Number(id);
  if (!Number.isFinite(numericId)) {
    return NextResponse.json({ error: "invalid id" }, { status: 400 });
  }

  const match = await getMatchById(numericId);
  if (!match || !match.prediction) {
    return NextResponse.json({ error: "match not found" }, { status: 404 });
  }

  const prediction = match.prediction;
  const grid = scoreMatrix(prediction.expectedHome, prediction.expectedAway);
  const dayKey = dayKeyFrom(new Date(match.kickoff));
  const related = (await getMatchesForDay(dayKey))
    .filter((row) => row.league.id === match.league.id && row.id !== match.id)
    .slice(0, 6)
    .map((row) => ({
      id: row.id,
      home: row.home.name,
      away: row.away.name,
      kickoff: row.kickoff,
      tip: row.prediction?.tipLabel ?? null,
      confidence: row.prediction?.confidence ?? null,
    }));

  return NextResponse.json({
    match: {
      id: match.id,
      kickoff: match.kickoff,
      status: match.status,
      round: match.roundName,
      venue: match.venue,
      league: match.league,
      home: match.home,
      away: match.away,
      score: [match.homeGoals, match.awayGoals],
      halfTime: [match.htHomeGoals, match.htAwayGoals],
    },
    prediction,
    scoreMatrix: grid.map((row) => row.slice(0, 7)),
    related,
  });
}
