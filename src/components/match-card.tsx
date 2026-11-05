import Link from "next/link";

import type { MatchView } from "@/lib/queries";
import { formatKickoff } from "@/lib/dates";
import { ConfidenceRing, ProbabilityBar, TeamBadge } from "@/components/ui";

export type CardFocus = "all" | "over-under" | "correct-score" | "ht-ft" | "value";

const pct = (value: number) => `${Math.round(value * 100)}%`;

function outcomeClass(status: string, hit: boolean | null) {
  if (status !== "finished" || hit === null) return "text-slate-400";
  return hit ? "text-emerald-300" : "text-rose-300";
}

export function MatchCard({
  match,
  focus = "all",
  highlight,
}: {
  match: MatchView;
  focus?: CardFocus;
  highlight?: string;
}) {
  const prediction = match.prediction;
  if (!prediction) return null;

  const kickoffTime = formatKickoff(new Date(match.kickoff));
  const started = match.status !== "scheduled";
  const topScore = prediction.topScores[0];
  const topHtft = prediction.htft[0];
  const bestDouble = prediction.doubleChance[0];
  const expected = prediction.expectedHome + prediction.expectedAway;

  return (
    <Link
      href={`/match/${match.id}`}
      className="panel group block p-4 transition hover:border-emerald-400/35 hover:bg-emerald-400/[0.04]"
    >
      <div className="flex items-center gap-3">
        <span
          className={`chip ${
            match.status === "live"
              ? "border-rose-400/40 bg-rose-400/10 text-rose-200"
              : match.status === "finished"
                ? "border-white/10 bg-white/5 text-slate-300"
                : ""
          }`}
        >
          {match.status === "live" ? (
            <span className="live-dot size-1.5 rounded-full bg-rose-400" />
          ) : null}
          {match.status === "live"
            ? "LIVE"
            : match.status === "finished"
              ? "FT"
              : kickoffTime}
        </span>

        <span className="chip">
          <span
            className="size-1.5 rounded-full"
            style={{ background: match.league.accent }}
          />
          <span className="truncate">{match.league.name}</span>
        </span>

        {highlight ? <span className="chip-accent">{highlight}</span> : null}

        <span className="ml-auto flex items-center gap-3">
          {prediction.valueEdge > 0.05 ? (
            <span className="hidden text-[11px] font-semibold text-emerald-300 sm:inline">
              +{(prediction.valueEdge * 100).toFixed(1)}% edge
            </span>
          ) : null}
          <ConfidenceRing value={prediction.confidence} size={44} />
        </span>
      </div>

      <div className="mt-3 grid grid-cols-[1fr_auto_1fr] items-center gap-3">
        <div className="flex items-center justify-end gap-2.5 text-right">
          <div>
            <p className="text-sm font-semibold leading-tight text-white">{match.home.name}</p>
            <p className="text-[11px] text-slate-500">xG {prediction.expectedHome.toFixed(2)}</p>
          </div>
          <TeamBadge abbreviation={match.home.abbreviation} accent={match.league.accent} />
        </div>

        <div className="min-w-[86px] text-center">
          {started ? (
            <p className="text-xl font-bold tracking-tight text-white">
              {match.homeGoals ?? 0}
              <span className="mx-1 text-slate-500">-</span>
              {match.awayGoals ?? 0}
            </p>
          ) : (
            <p className="text-xl font-bold tracking-tight text-white">
              {prediction.scoreHome}
              <span className="mx-1 text-slate-500">-</span>
              {prediction.scoreAway}
            </p>
          )}
          <p className="text-[10px] uppercase tracking-[0.14em] text-slate-500">
            {started ? "final / live" : "model score"}
          </p>
        </div>

        <div className="flex items-center gap-2.5">
          <TeamBadge abbreviation={match.away.abbreviation} accent={match.league.accent} />
          <div>
            <p className="text-sm font-semibold leading-tight text-white">{match.away.name}</p>
            <p className="text-[11px] text-slate-500">xG {prediction.expectedAway.toFixed(2)}</p>
          </div>
        </div>
      </div>

      <div className="mt-3.5">
        <ProbabilityBar
          segments={[
            { label: "Home", value: prediction.probHome, tone: "linear-gradient(90deg,#16d6a0,#22d3ee)" },
            { label: "Draw", value: prediction.probDraw, tone: "rgba(148,163,184,0.45)" },
            { label: "Away", value: prediction.probAway, tone: "linear-gradient(90deg,#818cf8,#e879f9)" },
          ]}
        />
        <div className="mt-1.5 grid grid-cols-3 text-center text-[11px]">
          <span className="font-semibold text-emerald-300">
            1 · {pct(prediction.probHome)}
            <span className="ml-1 text-slate-500">{prediction.oddsHome.toFixed(2)}</span>
          </span>
          <span className="font-semibold text-slate-300">
            X · {pct(prediction.probDraw)}
            <span className="ml-1 text-slate-500">{prediction.oddsDraw.toFixed(2)}</span>
          </span>
          <span className="font-semibold text-indigo-300">
            2 · {pct(prediction.probAway)}
            <span className="ml-1 text-slate-500">{prediction.oddsAway.toFixed(2)}</span>
          </span>
        </div>
      </div>

      <div className="mt-3 grid gap-1.5 text-[11px] sm:grid-cols-2">
        {focus === "over-under" ? (
          <>
            <span className="flex items-center justify-between rounded-lg bg-white/[0.03] px-2.5 py-1.5">
              <span className="text-slate-400">Over 2.5</span>
              <span className={outcomeClass(match.status, prediction.hitOver25)}>
                {pct(prediction.probOver25)}
              </span>
            </span>
            <span className="flex items-center justify-between rounded-lg bg-white/[0.03] px-2.5 py-1.5">
              <span className="text-slate-400">Under 2.5</span>
              <span className="text-slate-200">{pct(1 - prediction.probOver25)}</span>
            </span>
            <span className="flex items-center justify-between rounded-lg bg-white/[0.03] px-2.5 py-1.5">
              <span className="text-slate-400">Over 1.5</span>
              <span className="text-slate-200">{pct(prediction.probOver15)}</span>
            </span>
            <span className="flex items-center justify-between rounded-lg bg-white/[0.03] px-2.5 py-1.5">
              <span className="text-slate-400">Total xG</span>
              <span className="text-slate-200">{expected.toFixed(2)}</span>
            </span>
          </>
        ) : null}

        {focus === "correct-score" ? (
          <>
            {prediction.topScores.slice(0, 4).map((line, index) => (
              <span
                key={line.score}
                className={`flex items-center justify-between rounded-lg px-2.5 py-1.5 ${
                  index === 0 ? "bg-emerald-400/10" : "bg-white/[0.03]"
                }`}
              >
                <span className={index === 0 ? "text-emerald-200" : "text-slate-400"}>
                  {line.score.replace("-", " - ")}
                </span>
                <span className="text-slate-200">{pct(line.probability)}</span>
              </span>
            ))}
          </>
        ) : null}

        {focus === "ht-ft" ? (
          <>
            {prediction.htft.slice(0, 3).map((line, index) => (
              <span
                key={line.outcome}
                className={`flex items-center justify-between rounded-lg px-2.5 py-1.5 ${
                  index === 0 ? "bg-emerald-400/10" : "bg-white/[0.03]"
                }`}
              >
                <span className={index === 0 ? "text-emerald-200" : "text-slate-400"}>
                  {line.label}
                </span>
                <span className="text-slate-200">{pct(line.probability)}</span>
              </span>
            ))}
            <span className="flex items-center justify-between rounded-lg bg-white/[0.03] px-2.5 py-1.5">
              <span className="text-slate-400">Double chance</span>
              <span className="text-slate-200">
                {bestDouble.outcome} · {pct(bestDouble.probability)}
              </span>
            </span>
          </>
        ) : null}

        {focus === "all" || focus === "value" ? (
          <>
            <span className="flex items-center justify-between rounded-lg bg-white/[0.03] px-2.5 py-1.5">
              <span className="text-slate-400">Over 2.5</span>
              <span className={outcomeClass(match.status, prediction.hitOver25)}>
                {pct(prediction.probOver25)}
              </span>
            </span>
            <span className="flex items-center justify-between rounded-lg bg-white/[0.03] px-2.5 py-1.5">
              <span className="text-slate-400">BTTS</span>
              <span className={outcomeClass(match.status, prediction.hitBtts)}>
                {pct(prediction.probBtts)}
              </span>
            </span>
            <span className="flex items-center justify-between rounded-lg bg-white/[0.03] px-2.5 py-1.5">
              <span className="text-slate-400">Top score</span>
              <span className="text-slate-200">
                {topScore?.score.replace("-", "-")} · {pct(topScore?.probability ?? 0)}
              </span>
            </span>
            <span className="flex items-center justify-between rounded-lg bg-white/[0.03] px-2.5 py-1.5">
              <span className="text-slate-400">HT/FT</span>
              <span className="text-slate-200">
                {topHtft?.outcome} · {pct(topHtft?.probability ?? 0)}
              </span>
            </span>
          </>
        ) : null}
      </div>

      <div className="mt-3 flex flex-wrap items-center gap-2 border-t border-white/5 pt-3">
        <span className="chip-accent">
          {prediction.tipLabel} · {pct(prediction.tipProbability)}
        </span>
        <span className="chip">
          Alt: {prediction.altTipLabel} · {pct(prediction.altTipProbability)}
        </span>
        {focus === "value" ? (
          <span className="chip">Odds {prediction.tipProbability > 0 ? (1 / prediction.tipProbability).toFixed(2) : "-"}</span>
        ) : null}
        <span className="ml-auto text-[11px] text-slate-500 transition group-hover:text-emerald-300">
          Full analysis →
        </span>
      </div>
    </Link>
  );
}
