import type { Metadata } from "next";

import { PredictionBoard } from "@/components/prediction-board";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "HT/FT predictions",
  description:
    "Half-time / full-time outcome probabilities derived from split-half expected goals modelling.",
};

export default async function HtFtPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const resolved = await searchParams;
  return (
    <PredictionBoard
      searchParams={resolved}
      focus="ht-ft"
      eyebrow="Half / full time"
      title="HT / FT predictions"
      description="Roughly 44% of goals are scored before the break, so the model splits each team's expected goals across the two halves and rebuilds the nine half-time / full-time outcomes. Double chance and draw-half scenarios are included where the model leans that way."
      defaults={{ sort: "kickoff" }}
    />
  );
}
