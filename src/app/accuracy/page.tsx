import type { Metadata } from "next";
import Link from "next/link";

import { MatchCard } from "@/components/match-card";
import { StatTile } from "@/components/ui";
import { shortDayLabel } from "@/lib/dates";
import { getAccuracyReport, getRecentSettled } from "@/lib/queries";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

export const metadata: Metadata = {
  title: "Model accuracy & hit rates",
  description:
    "Transparent hit-rate tracking for every GoalSeer market: primary tip, match result, totals, BTTS, correct score and HT/FT, plus Brier score.",
};

const pct = (value: number) => `${(value * 100).toFixed(1)}%`;

export default async function AccuracyPage() {
  const [report, settled] = await Promise.all([getAccuracyReport(), getRecentSettled(6)]);
  const maxTrend = Math.max(...report.trend.map((row) => row.hitRate), 0.01);

  return (
    <div className="space-y-6">
      <section className="panel p-6 lg:p-8">
        <div className="flex flex-wrap items-center gap-2">
          <span className="chip-accent">Model performance</span>
          <span
            className={`chip ${
              report.dataSource === "live"
                ? "border-emerald-400/30 bg-emerald-400/10 text-emerald-300"
                : "border-amber-400/30 bg-amber-400/10 text-amber-200"
            }`}
          >
            {report.dataSource === "live" ? "graded on real results" : "graded on simulated archive"}
          </span>
        </div>
        <h1 className="mt-3 text-3xl font-semibold tracking-tight text-white sm:text-4xl">
          Accuracy &amp; hit rates
        </h1>
        <p className="mt-3 max-w-3xl text-sm leading-relaxed text-slate-400">
          Every settled fixture is graded automatically. The primary tip is the market with the best
          blend of probability and price edge; the remaining rows show how each individual market
          performs so you can see where the model is genuinely strong rather than trusting a single
          headline number. {report.sampleSize.toLocaleString()} graded fixtures.
        </p>
        <div className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <StatTile
            label="Primary tip hit rate"
            value={pct(report.hitRate)}
            hint={`${report.sampleSize} graded fixtures`}
            accent="#16d6a0"
          />
          <StatTile
            label="Brier score (1X2)"
            value={report.brierScore.toFixed(3)}
            hint="3-way Brier · lower is better, 0.667 = uniform"
          />
          <StatTile
            label="Totals hit rate"
            value={pct(report.overRate)}
            hint="over/under 2.5 direction"
            accent="#38bdf8"
          />
          <StatTile
            label="Correct score hit rate"
            value={pct(report.correctScoreRate)}
            hint="exact scoreline match"
            accent="#fbbf24"
          />
        </div>
      </section>

      <div className="grid gap-6 lg:grid-cols-2">
        <section className="panel p-6">
          <h2 className="text-lg font-semibold text-white">Hit rate by market</h2>
          <div className="mt-4 space-y-3">
            {report.byMarket.map((market) => (
              <div key={market.market}>
                <div className="flex items-baseline justify-between text-sm">
                  <span className="text-slate-300">{market.label}</span>
                  <span className="font-semibold text-white">{pct(market.hitRate)}</span>
                </div>
                <div className="mt-1.5 h-2 overflow-hidden rounded-full bg-white/5">
                  <div
                    className="h-full rounded-full bg-gradient-to-r from-emerald-400 to-cyan-400"
                    style={{ width: `${Math.max(2, market.hitRate * 100)}%` }}
                  />
                </div>
              </div>
            ))}
          </div>
          <p className="mt-4 text-[11px] leading-relaxed text-slate-500">
            Correct score and HT/FT are structurally low-probability markets; a 10-12% correct-score
            hit rate is already a strong signal because the fair baseline for a typical match is
            around 9%.
          </p>
        </section>

        <section className="panel p-6">
          <h2 className="text-lg font-semibold text-white">Daily trend</h2>
          <p className="mt-1 text-xs text-slate-500">Primary tip hit rate per matchday</p>
          <div className="mt-6 flex h-44 items-end gap-2">
            {report.trend.map((row) => (
              <div key={row.day} className="flex flex-1 flex-col items-center gap-2">
                <span className="text-[10px] font-semibold text-slate-300">
                  {pct(row.hitRate)}
                </span>
                <div
                  className="w-full rounded-t-md bg-gradient-to-t from-emerald-500/30 to-emerald-400"
                  style={{ height: `${Math.max(4, (row.hitRate / maxTrend) * 100)}%` }}
                  title={`${row.sampleSize} fixtures`}
                />
                <span className="text-[10px] text-slate-500">{shortDayLabel(row.day)}</span>
              </div>
            ))}
          </div>
        </section>
      </div>

      <section className="panel p-6">
        <h2 className="text-lg font-semibold text-white">Performance by league</h2>
        <div className="mt-4 overflow-x-auto">
          <table className="w-full min-w-[620px] text-sm">
            <thead>
              <tr className="border-b border-white/10 text-left text-[10px] uppercase tracking-[0.14em] text-slate-500">
                <th className="py-2">League</th>
                <th className="py-2 text-right">Fixtures</th>
                <th className="py-2 text-right">Primary tip</th>
                <th className="py-2 text-right">Totals</th>
                <th className="py-2 text-right">Correct score</th>
                <th className="py-2 text-right" />
              </tr>
            </thead>
            <tbody>
              {report.byLeague.map((league) => (
                <tr key={league.slug} className="border-b border-white/5">
                  <td className="py-2.5 text-slate-200">
                    <span className="mr-2">{league.flag}</span>
                    {league.name}
                  </td>
                  <td className="py-2.5 text-right text-slate-400">{league.sampleSize}</td>
                  <td className="py-2.5 text-right font-semibold text-emerald-300">
                    {pct(league.hitRate)}
                  </td>
                  <td className="py-2.5 text-right text-slate-300">{pct(league.overRate)}</td>
                  <td className="py-2.5 text-right text-slate-300">
                    {pct(league.correctScoreRate)}
                  </td>
                  <td className="py-2.5 text-right">
                    <Link
                      className="text-xs text-emerald-300 hover:text-emerald-200"
                      href={`/leagues/${league.slug}`}
                    >
                      board →
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section className="panel p-6">
        <h2 className="text-lg font-semibold text-white">Where the tips come from</h2>
        <p className="mt-1 text-xs text-slate-500">
          Distribution of selected tips across graded fixtures.
        </p>
        <div className="mt-4 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
          {report.byTip.map((tip) => (
            <div key={tip.tip} className="panel-tight p-3">
              <div className="flex items-baseline justify-between">
                <span className="text-sm font-semibold text-slate-100">{tip.label}</span>
                <span className="text-sm font-semibold text-emerald-300">{pct(tip.hitRate)}</span>
              </div>
              <p className="mt-1 text-[11px] text-slate-500">
                {tip.sampleSize} selections graded
              </p>
              <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-white/5">
                <div
                  className="h-full rounded-full bg-cyan-400/80"
                  style={{ width: `${Math.max(2, tip.hitRate * 100)}%` }}
                />
              </div>
            </div>
          ))}
        </div>
      </section>

      <section>
        <h2 className="mb-3 text-lg font-semibold text-white">Recently graded fixtures</h2>
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          {settled.map((match) => (
            <MatchCard key={match.id} match={match} />
          ))}
        </div>
      </section>
    </div>
  );
}
