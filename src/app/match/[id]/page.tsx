import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import { MatchCard } from "@/components/match-card";
import { ConfidenceRing, FormPips, Meter, ProbabilityBar, StatTile, TeamBadge } from "@/components/ui";
import { formatKickoff, longDayLabel, dayKeyFrom, formatDayNumber } from "@/lib/dates";
import { scoreMatrix, MAX_GOALS } from "@/lib/predict";
import { getMatchById, getMatchesForDay } from "@/lib/queries";

export const dynamic = "force-dynamic";

const pct = (value: number) => `${(value * 100).toFixed(1)}%`;

function priceOf(probability: number, overround = 1.06) {
  return Number((1 / Math.max(probability, 0.01) / overround).toFixed(2));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>;
}): Promise<Metadata> {
  const { id } = await params;
  const match = await getMatchById(Number(id));
  if (!match) return { title: "Match not found" };
  return {
    title: `${match.home.name} vs ${match.away.name} prediction`,
    description: `Model prediction for ${match.home.name} vs ${match.away.name}: ${(match.prediction?.probHome ?? 0) * 100}% home win, ${(match.prediction?.probDraw ?? 0) * 100}% draw, ${(match.prediction?.probAway ?? 0) * 100}% away win with over/under, BTTS, correct score and HT/FT probabilities.`,
  };
}

export default async function MatchPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const numericId = Number(id);
  if (!Number.isFinite(numericId)) notFound();

  const match = await getMatchById(numericId);
  if (!match || !match.prediction) notFound();

  const prediction = match.prediction;
  const kickoff = new Date(match.kickoff);
  const grid = scoreMatrix(prediction.expectedHome, prediction.expectedAway);
  const totalXg = prediction.expectedHome + prediction.expectedAway;

  const dayKey = dayKeyFrom(kickoff);
  const leagueMatches = (await getMatchesForDay(dayKey))
    .filter((row) => row.league.id === match.league.id && row.id !== match.id)
    .slice(0, 3);

  const markets = [
    { group: "Result", label: `${match.home.name} to win`, probability: prediction.probHome, odds: prediction.oddsHome },
    { group: "Result", label: "Draw", probability: prediction.probDraw, odds: prediction.oddsDraw },
    { group: "Result", label: `${match.away.name} to win`, probability: prediction.probAway, odds: prediction.oddsAway },
    ...prediction.doubleChance.map((line) => ({
      group: "Double chance",
      label: line.outcome,
      probability: line.probability,
      odds: priceOf(line.probability, 1.05),
    })),
    { group: "Totals", label: "Over 1.5 goals", probability: prediction.probOver15, odds: priceOf(prediction.probOver15) },
    { group: "Totals", label: "Over 2.5 goals", probability: prediction.probOver25, odds: priceOf(prediction.probOver25) },
    { group: "Totals", label: "Under 2.5 goals", probability: 1 - prediction.probOver25, odds: priceOf(1 - prediction.probOver25) },
    { group: "Totals", label: "Over 3.5 goals", probability: prediction.probOver35, odds: priceOf(prediction.probOver35) },
    { group: "Goals", label: "Both teams to score", probability: prediction.probBtts, odds: priceOf(prediction.probBtts) },
    { group: "Goals", label: "BTTS - No", probability: 1 - prediction.probBtts, odds: priceOf(1 - prediction.probBtts) },
    { group: "Clean sheet", label: `${match.home.name} clean sheet`, probability: prediction.probHomeCleanSheet, odds: priceOf(prediction.probHomeCleanSheet, 1.08) },
    { group: "Clean sheet", label: `${match.away.name} clean sheet`, probability: prediction.probAwayCleanSheet, odds: priceOf(prediction.probAwayCleanSheet, 1.08) },
    ...prediction.htft.slice(0, 4).map((line) => ({
      group: "HT / FT",
      label: `${line.outcome} (${line.label})`,
      probability: line.probability,
      odds: priceOf(line.probability, 1.09),
    })),
  ];

  const hitBadge = (hit: boolean | null) =>
    hit === null ? (
      <span className="chip">pending</span>
    ) : hit ? (
      <span className="chip-accent">hit</span>
    ) : (
      <span className="chip border-rose-400/30 bg-rose-400/10 text-rose-200">miss</span>
    );

  return (
    <div className="space-y-6">
      <nav className="flex flex-wrap items-center gap-2 text-xs text-slate-500">
        <Link className="hover:text-emerald-300" href="/">
          Predictions
        </Link>
        <span>/</span>
        <Link className="hover:text-emerald-300" href={`/leagues/${match.league.slug}?date=${dayKey}`}>
          {match.league.name}
        </Link>
        <span>/</span>
        <span className="text-slate-300">
          {match.home.name} vs {match.away.name}
        </span>
      </nav>

      <section className="panel p-6">
        <div className="flex flex-wrap items-center gap-2">
          <span className="chip">
            <span className="size-1.5 rounded-full" style={{ background: match.league.accent }} />
            {match.league.flag} {match.league.name}
          </span>
          <span className="chip">{match.roundName}</span>
          {match.source === "espn" ? (
            <span className="chip border-emerald-400/30 bg-emerald-400/10 text-emerald-300">
              live data
            </span>
          ) : null}
          {match.broadcast ? <span className="chip">📺 {match.broadcast}</span> : null}
          <span className="chip">{formatDayNumber(dayKey)} · {formatKickoff(kickoff)} UTC</span>
          {match.status === "live" ? (
            <span className="chip border-rose-400/40 bg-rose-400/10 text-rose-200">
              <span className="live-dot size-1.5 rounded-full bg-rose-400" /> live
            </span>
          ) : match.status === "finished" ? (
            <span className="chip">finished</span>
          ) : (
            <span className="chip">scheduled</span>
          )}
          <span className="ml-auto flex items-center gap-3">
            <span className="text-xs text-slate-400">confidence</span>
            <ConfidenceRing value={prediction.confidence} size={54} />
          </span>
        </div>

        <div className="mt-5 grid grid-cols-[1fr_auto_1fr] items-center gap-4">
          <div className="flex items-center justify-end gap-3 text-right">
            <div>
              <p className="text-lg font-semibold leading-tight text-white">{match.home.name}</p>
              <p className="text-[11px] text-slate-500">
                attack {match.home.attack.toFixed(2)} · defence {match.home.defense.toFixed(2)}
                {match.home.record ? ` · ${match.home.record} W-D-L` : ""}
              </p>
              <div className="mt-1.5 flex justify-end">
                <FormPips lastFive={match.home.lastFive} />
              </div>
            </div>
            <TeamBadge abbreviation={match.home.abbreviation} accent={match.league.accent} size="lg" />
          </div>

          <div className="text-center">
            {match.status === "scheduled" ? (
              <>
                <p className="text-4xl font-bold tracking-tight text-white">
                  {prediction.scoreHome}-{prediction.scoreAway}
                </p>
                <p className="mt-1 text-[10px] uppercase tracking-[0.18em] text-slate-500">
                  model score
                </p>
              </>
            ) : (
              <>
                <p className="text-4xl font-bold tracking-tight text-white">
                  {match.homeGoals ?? 0}-{match.awayGoals ?? 0}
                </p>
                <p className="mt-1 text-[10px] uppercase tracking-[0.18em] text-slate-500">
                  {match.status === "finished" ? "full time" : "in play"}
                </p>
                {match.htHomeGoals !== null ? (
                  <p className="mt-1 text-xs text-slate-400">
                    HT {match.htHomeGoals}-{match.htAwayGoals ?? 0}
                  </p>
                ) : null}
              </>
            )}
            <p className="mt-2 text-xs text-slate-400">
              xG {prediction.expectedHome.toFixed(2)} - {prediction.expectedAway.toFixed(2)}
            </p>
          </div>

          <div className="flex items-center gap-3">
            <TeamBadge abbreviation={match.away.abbreviation} accent={match.league.accent} size="lg" />
            <div>
              <p className="text-lg font-semibold leading-tight text-white">{match.away.name}</p>
              <p className="text-[11px] text-slate-500">
                attack {match.away.attack.toFixed(2)} · defence {match.away.defense.toFixed(2)}
                {match.away.record ? ` · ${match.away.record} W-D-L` : ""}
              </p>
              <div className="mt-1.5">
                <FormPips lastFive={match.away.lastFive} />
              </div>
            </div>
          </div>
        </div>

        <div className="mt-6">
          <ProbabilityBar
            height="h-3"
            segments={[
              { label: "Home", value: prediction.probHome, tone: "linear-gradient(90deg,#16d6a0,#22d3ee)" },
              { label: "Draw", value: prediction.probDraw, tone: "rgba(148,163,184,0.5)" },
              { label: "Away", value: prediction.probAway, tone: "linear-gradient(90deg,#818cf8,#e879f9)" },
            ]}
          />
          <div className="mt-2 grid grid-cols-3 text-center text-sm">
            <span className="font-semibold text-emerald-300">
              {pct(prediction.probHome)} <span className="text-slate-500">@ {prediction.oddsHome.toFixed(2)}</span>
            </span>
            <span className="font-semibold text-slate-300">
              {pct(prediction.probDraw)} <span className="text-slate-500">@ {prediction.oddsDraw.toFixed(2)}</span>
            </span>
            <span className="font-semibold text-indigo-300">
              {pct(prediction.probAway)} <span className="text-slate-500">@ {prediction.oddsAway.toFixed(2)}</span>
            </span>
          </div>
        </div>

        <div className="mt-5 grid gap-3 sm:grid-cols-3">
          <div className="panel-tight p-3">
            <p className="label">Primary tip</p>
            <p className="mt-1 text-sm font-semibold text-emerald-300">
              {prediction.tipLabel} · {pct(prediction.tipProbability)}
            </p>
            <p className="text-[11px] text-slate-500">
              fair price {(1 / prediction.tipProbability).toFixed(2)} · edge{" "}
              {(prediction.valueEdge * 100).toFixed(1)}%
            </p>
          </div>
          <div className="panel-tight p-3">
            <p className="label">Alternative</p>
            <p className="mt-1 text-sm font-semibold text-slate-100">
              {prediction.altTipLabel} · {pct(prediction.altTipProbability)}
            </p>
            <p className="text-[11px] text-slate-500">
              fair price {(1 / prediction.altTipProbability).toFixed(2)}
            </p>
          </div>
          <div className="panel-tight p-3">
            <p className="label">Settled markets</p>
            <div className="mt-1.5 flex flex-wrap gap-1.5">
              <span className="flex items-center gap-1 text-[11px] text-slate-400">
                tip {hitBadge(prediction.hitOutcome)}
              </span>
              <span className="flex items-center gap-1 text-[11px] text-slate-400">
                O2.5 {hitBadge(prediction.hitOver25)}
              </span>
              <span className="flex items-center gap-1 text-[11px] text-slate-400">
                score {hitBadge(prediction.hitCorrectScore)}
              </span>
            </div>
          </div>
        </div>
      </section>

      <div className="grid gap-6 lg:grid-cols-[1.35fr_1fr]">
        <section className="panel p-6">
          <h2 className="text-lg font-semibold text-white">Correct score matrix</h2>
          <p className="mt-1 text-xs text-slate-500">
            Dixon-Coles adjusted probabilities for every scoreline up to 8 goals per team.
          </p>

          <div className="mt-4 overflow-x-auto">
            <table className="w-full border-separate border-spacing-1 text-center text-[11px]">
              <thead>
                <tr>
                  <th className="w-10" />
                  {Array.from({ length: 6 }, (_, away) => (
                    <th key={away} className="pb-1 font-semibold text-slate-500">
                      {away}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {Array.from({ length: 6 }, (_, home) => (
                  <tr key={home}>
                    <th className="pr-1 text-right font-semibold text-slate-500">{home}</th>
                    {Array.from({ length: 6 }, (_, away) => {
                      const value = grid[home][away];
                      const isTop = home === prediction.scoreHome && away === prediction.scoreAway;
                      const intensity = Math.min(1, value / 0.18);
                      return (
                        <td
                          key={away}
                          className={`rounded-md py-2 font-semibold ${
                            isTop ? "ring-1 ring-emerald-400/70" : ""
                          }`}
                          style={{
                            background: `rgba(22, 214, 160, ${0.06 + intensity * 0.5})`,
                            color: intensity > 0.55 ? "#04120e" : "#cbd5e1",
                          }}
                        >
                          {(value * 100).toFixed(1)}
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="mt-2 text-[11px] text-slate-500">
            Rows = {match.home.abbreviation} goals · columns = {match.away.abbreviation} goals
          </p>

          <div className="mt-5 grid gap-2 sm:grid-cols-2">
            {prediction.topScores.map((line, index) => (
              <div
                key={line.score}
                className={`flex items-center justify-between rounded-lg px-3 py-2 text-sm ${
                  index === 0 ? "bg-emerald-400/10 text-emerald-200" : "bg-white/[0.03] text-slate-300"
                }`}
              >
                <span className="font-semibold">{line.score.replace("-", " - ")}</span>
                <span>{pct(line.probability)}</span>
              </div>
            ))}
          </div>
        </section>

        <div className="space-y-6">
          <section className="panel p-6">
            <h2 className="text-lg font-semibold text-white">Simulation profile</h2>
            <p className="mt-1 text-xs text-slate-500">
              10,000-run profile implied by the model&apos;s goal expectations.
            </p>
            <div className="mt-4 space-y-3">
              <Meter label="Over 2.5 goals" value={prediction.probOver25} />
              <Meter label="Both teams score" value={prediction.probBtts} tone="#38bdf8" />
              <Meter
                label="Home win"
                value={prediction.probHome}
                tone="linear-gradient(90deg,#16d6a0,#22d3ee)"
              />
              <Meter label="Draw" value={prediction.probDraw} tone="rgba(148,163,184,0.7)" />
              <Meter label="Away win" value={prediction.probAway} tone="#a78bfa" />
              <Meter label="Over 3.5 goals" value={prediction.probOver35} tone="#fbbf24" />
            </div>
            <div className="mt-5 grid grid-cols-2 gap-3">
              <StatTile label="Total expected goals" value={totalXg.toFixed(2)} />
              <StatTile
                label="Most likely HT/FT"
                value={prediction.htft[0]?.outcome ?? "-"}
                hint={pct(prediction.htft[0]?.probability ?? 0)}
              />
            </div>
          </section>

          <section className="panel p-6">
            <h2 className="text-lg font-semibold text-white">Team ratings</h2>
            <div className="mt-4 space-y-2 text-sm">
              {[
                {
                  label: "Attack multiplier",
                  home: match.home.attack,
                  away: match.away.attack,
                  format: (value: number) => value.toFixed(2),
                },
                {
                  label: "Defence multiplier",
                  home: 1 / match.home.defense,
                  away: 1 / match.away.defense,
                  format: (value: number) => value.toFixed(2),
                },
                {
                  label: "Form factor",
                  home: match.home.form,
                  away: match.away.form,
                  format: (value: number) => value.toFixed(2),
                },
                {
                  label: "Elo rating",
                  home: match.home.elo,
                  away: match.away.elo,
                  format: (value: number) => Math.round(value).toString(),
                },
              ].map((row) => {
                const total = row.home + row.away || 1;
                return (
                  <div key={row.label}>
                    <div className="flex items-center justify-between text-xs text-slate-400">
                      <span className="font-semibold text-slate-200">{row.format(row.home)}</span>
                      <span>{row.label}</span>
                      <span className="font-semibold text-slate-200">{row.format(row.away)}</span>
                    </div>
                    <div className="mt-1 flex h-1.5 gap-0.5">
                      <div
                        className="rounded-l-full bg-gradient-to-r from-emerald-400 to-cyan-400"
                        style={{ width: `${(row.home / total) * 100}%` }}
                      />
                      <div
                        className="rounded-r-full bg-gradient-to-r from-indigo-400 to-fuchsia-400"
                        style={{ width: `${(row.away / total) * 100}%` }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
            <p className="mt-4 text-[11px] leading-relaxed text-slate-500">
              Multipliers are relative to league average, so 1.20 attack means a team scores 20% more
              than the mean side in its competition. Lower defence is better; the bar shows the
              inverted (positive) view.
            </p>
          </section>
        </div>
      </div>

      <section className="panel p-6">
        <h2 className="text-lg font-semibold text-white">Every market priced by the model</h2>
        <p className="mt-1 text-xs text-slate-500">
          Prices include a 5-9% overround. Edge is model probability × price − 1.
        </p>
        <div className="mt-4 overflow-x-auto">
          <table className="w-full min-w-[640px] text-sm">
            <thead>
              <tr className="border-b border-white/10 text-left text-[10px] uppercase tracking-[0.14em] text-slate-500">
                <th className="py-2">Market</th>
                <th className="py-2">Selection</th>
                <th className="py-2 text-right">Probability</th>
                <th className="py-2 text-right">Price</th>
                <th className="py-2 text-right">Edge</th>
              </tr>
            </thead>
            <tbody>
              {markets.map((market) => {
                const edge = market.probability * market.odds - 1;
                return (
                  <tr key={`${market.group}-${market.label}`} className="border-b border-white/5">
                    <td className="py-2.5 text-xs text-slate-500">{market.group}</td>
                    <td className="py-2.5 text-slate-200">{market.label}</td>
                    <td className="py-2.5 text-right font-semibold text-white">
                      {pct(market.probability)}
                    </td>
                    <td className="py-2.5 text-right text-slate-400">{market.odds.toFixed(2)}</td>
                    <td
                      className={`py-2.5 text-right font-semibold ${
                        edge > 0 ? "text-emerald-300" : "text-slate-500"
                      }`}
                    >
                      {edge > 0 ? "+" : ""}
                      {(edge * 100).toFixed(1)}%
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </section>

      <section className="panel p-6">
        <h2 className="text-lg font-semibold text-white">
          How this prediction was built for {longDayLabel(dayKey)}
        </h2>
        <div className="mt-4 grid gap-4 text-sm leading-relaxed text-slate-400 md:grid-cols-3">
          <div>
            <p className="font-semibold text-slate-200">1. Expected goals</p>
            <p className="mt-1 text-xs">
              Half the league average goal rate is scaled by the home side&apos;s attack multiplier
              and the away side&apos;s defence multiplier, then by home advantage
              {` (${match.league.name} averages ${(match.league.tier === 1 ? 2.8 : 2.6).toFixed(1)} goals per game)`}.
            </p>
          </div>
          <div>
            <p className="font-semibold text-slate-200">2. Scoreline grid</p>
            <p className="mt-1 text-xs">
              A Poisson grid up to {MAX_GOALS} goals per team is built and adjusted with a
              Dixon-Coles correction so 0-0, 1-0, 0-1 and 1-1 behave like real football instead of
              independent coin flips.
            </p>
          </div>
          <div>
            <p className="font-semibold text-slate-200">3. Market extraction</p>
            <p className="mt-1 text-xs">
              Result, totals, BTTS, clean sheets, correct score, double chance and HT/FT are read
              from that single matrix, priced with an overround and ranked by expected value.
            </p>
          </div>
        </div>
      </section>

      {leagueMatches.length > 0 ? (
        <section>
          <h2 className="mb-3 text-lg font-semibold text-white">
            More {match.league.name} predictions
          </h2>
          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
            {leagueMatches.map((row) => (
              <MatchCard key={row.id} match={row} />
            ))}
          </div>
        </section>
      ) : null}
    </div>
  );
}
