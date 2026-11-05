import type { Metadata } from "next";

import { PredictionBoard } from "@/components/prediction-board";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

export const metadata: Metadata = {
  title: "Value bets & positive edge picks",
  description:
    "Fixtures where the model probability beats the implied probability of the price, ranked by expected value.",
};

export default async function ValueBetsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const resolved = await searchParams;
  return (
    <PredictionBoard
      searchParams={resolved}
      focus="value"
      eyebrow="Expected value"
      title="Value bets & positive edge"
      description="A bet only has value when model probability × decimal price exceeds 1.00. The engine prices every market from its own probabilities, applies a bookmaker overround and then ranks the fixtures where the residual edge is largest — these are the selections the model thinks the market has mispriced."
      defaults={{ sort: "value", market: "value" }}
    />
  );
}
