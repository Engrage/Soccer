import type { Metadata } from "next";

import { PredictionBoard } from "@/components/prediction-board";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

export const metadata: Metadata = {
  title: "Correct score predictions",
  description:
    "Dixon-Coles adjusted correct score probabilities with the top four scorelines for every fixture.",
};

export default async function CorrectScorePage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const resolved = await searchParams;
  return (
    <PredictionBoard
      searchParams={resolved}
      focus="correct-score"
      eyebrow="Scoreline market"
      title="Correct score predictions"
      description="The Poisson grid gives a probability to every scoreline from 0-0 to 8-8, with a low-score correction applied to 0-0, 1-0, 0-1 and 1-1 where real football deviates most from pure independence. Each card lists the four most likely scorelines plus the model's headline score."
      defaults={{ sort: "probability", rankMarket: "over-2.5" }}
    />
  );
}
