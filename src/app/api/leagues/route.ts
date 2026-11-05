import { NextResponse } from "next/server";

import { getAllLeagues, getMatchesForDay, summarise } from "@/lib/queries";
import { addDays, dayKeyFrom, todayKey } from "@/lib/dates";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

export async function GET(request: Request) {
  const url = new URL(request.url);
  const date = url.searchParams.get("date") ?? todayKey();
  const withSummary = url.searchParams.get("summary") === "true";

  const [leagues, dayMatches, nextDayMatches] = await Promise.all([
    getAllLeagues(),
    getMatchesForDay(date),
    getMatchesForDay(dayKeyFrom(addDays(new Date(date), 1))),
  ]);

  return NextResponse.json({
    date,
    leagues: leagues.map((league) => ({
      slug: league.slug,
      name: league.name,
      country: league.country,
      flag: league.flag,
      fixtures: dayMatches.filter((match) => match.league.id === league.id).length,
    })),
    summary: withSummary ? summarise(date, dayMatches) : undefined,
    nextDayFixtureCount: nextDayMatches.length,
  });
}
