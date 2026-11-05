import { NextResponse } from "next/server";

import { getAccuracyReport, getAllLeagues } from "@/lib/queries";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

export async function GET(request: Request) {
  const url = new URL(request.url);
  const include = url.searchParams.get("include");
  const [report, leagues] = await Promise.all([getAccuracyReport(), getAllLeagues()]);

  return NextResponse.json({
    accuracy: report,
    leagues: leagues.map((league) => ({
      slug: league.slug,
      name: league.name,
      country: league.country,
      href: include === "links" ? `/leagues/${league.slug}` : undefined,
    })),
  });
}
