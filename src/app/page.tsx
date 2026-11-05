import type { Metadata } from "next";

import { PredictionBoard } from "@/components/prediction-board";
import { todayKey } from "@/lib/dates";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Football predictions today",
  description:
    "Updated football predictions for today and the next matchday: result probabilities, over/under, BTTS, correct score, HT/FT and value edges across 14 leagues.",
};

export default async function HomePage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const resolved = await searchParams;
  return (
    <PredictionBoard
      searchParams={{ ...resolved, date: (resolved.date as string) ?? todayKey() }}
      focus="all"
      eyebrow="Updated daily · 14 leagues"
      title="Football predictions & model probabilities"
      description="Every fixture is scored by a bivariate Poisson engine with a Dixon-Coles low-score correction. Team attack and defence multipliers, home advantage and rolling form are combined into one scoreline matrix — match result, totals, BTTS, correct score, HT/FT and double chance all come from the same numbers."
      defaults={{ sort: "kickoff" }}
    />
  );
}
