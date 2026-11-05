import type { Metadata } from "next";

import { PredictionBoard } from "@/components/prediction-board";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

export const metadata: Metadata = {
  title: "Over/under goals predictions",
  description:
    "Over 1.5, 2.5 and 3.5 goal predictions generated from expected-goals modelling, sorted by the strongest totals edge.",
};

export default async function OverUnderPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const resolved = await searchParams;
  return (
    <PredictionBoard
      searchParams={resolved}
      focus="over-under"
      eyebrow="Totals market"
      title="Over / under goals predictions"
      description="Totals are read straight off the scoreline matrix: the model sums the probability of every scoreline above or below each goal line. Cards are ranked by over 2.5 conviction, with the under price and total expected goals shown alongside so you can see where the value actually sits."
      defaults={{ sort: "probability", rankMarket: "over-2.5" }}
    />
  );
}
