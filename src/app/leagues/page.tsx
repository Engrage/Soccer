import type { Metadata } from "next";
import Link from "next/link";

import { StatTile } from "@/components/ui";
import { longDayLabel, todayKey } from "@/lib/dates";
import { getAllLeagues, getMatchesForDay, summarise } from "@/lib/queries";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

export const metadata: Metadata = {
  title: "All leagues covered",
  description:
    "GoalSeer covers 14 leagues from Europe and the Americas with per-league fixture counts, model confidence and value pick density.",
};

export default async function LeaguesPage() {
  const date = todayKey();
  const [leagueList, matches] = await Promise.all([getAllLeagues(), getMatchesForDay(date)]);
  const summary = summarise(date, matches);

  const rows = leagueList
    .map((league) => {
      const leagueMatches = matches.filter((match) => match.league.id === league.id);
      const confidence = leagueMatches.length
        ? leagueMatches.reduce((sum, match) => sum + (match.prediction?.confidence ?? 0), 0) /
          leagueMatches.length
        : 0;
      const value = leagueMatches.filter((match) => (match.prediction?.valueEdge ?? 0) > 0.04).length;
      const topGoals = leagueMatches.reduce((sum, match) => {
        const prediction = match.prediction;
        return prediction ? sum + prediction.expectedHome + prediction.expectedAway : sum;
      }, 0);
      return {
        league,
        count: leagueMatches.length,
        confidence,
        value,
        avgGoals: leagueMatches.length ? topGoals / leagueMatches.length : 0,
      };
    })
    .sort((a, b) => b.count - a.count || a.league.name.localeCompare(b.league.name));

  return (
    <div className="space-y-6">
      <section className="panel p-6 lg:p-8">
        <span className="chip-accent">Coverage</span>
        <h1 className="mt-3 text-3xl font-semibold tracking-tight text-white sm:text-4xl">
          Leagues covered by the model
        </h1>
        <p className="mt-3 max-w-3xl text-sm leading-relaxed text-slate-400">
          The same engine runs across every competition — only the goal environment and team
          multipliers change. Each league keeps its own average goals per game, which is why a
          Bundesliga fixture starts from a higher baseline than an Argentine Liga Profesional game.
        </p>
        <div className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <StatTile label="Leagues" value={leagueList.length} hint={longDayLabel(date)} />
          <StatTile label="Fixtures today" value={summary.totalMatches} />
          <StatTile
            label="Avg confidence"
            value={Math.round(summary.averageConfidence)}
            accent="#16d6a0"
          />
          <StatTile label="Value picks" value={summary.valuePicks} accent="#38bdf8" />
        </div>
      </section>

      <section className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
        {rows.map((row) => (
          <Link
            key={row.league.id}
            href={`/leagues/${row.league.slug}?date=${date}`}
            className="panel group p-5 transition hover:border-emerald-400/35 hover:bg-emerald-400/[0.04]"
          >
            <div className="flex items-center gap-3">
              <span className="text-2xl">{row.league.flag}</span>
              <div>
                <p className="text-sm font-semibold text-white">{row.league.name}</p>
                <p className="text-[11px] text-slate-500">
                  {row.league.country} · tier {row.league.tier}
                </p>
              </div>
              <span className="ml-auto chip">{row.count} today</span>
            </div>
            <div className="mt-4 grid grid-cols-3 gap-2 text-center">
              <div className="rounded-lg bg-white/[0.03] py-2">
                <p className="text-[10px] uppercase tracking-[0.12em] text-slate-500">conf</p>
                <p className="text-sm font-semibold text-white">{Math.round(row.confidence)}</p>
              </div>
              <div className="rounded-lg bg-white/[0.03] py-2">
                <p className="text-[10px] uppercase tracking-[0.12em] text-slate-500">xG avg</p>
                <p className="text-sm font-semibold text-white">{row.avgGoals.toFixed(2)}</p>
              </div>
              <div className="rounded-lg bg-white/[0.03] py-2">
                <p className="text-[10px] uppercase tracking-[0.12em] text-slate-500">value</p>
                <p className="text-sm font-semibold text-emerald-300">{row.value}</p>
              </div>
            </div>
            <p className="mt-3 text-[11px] text-slate-500 transition group-hover:text-emerald-300">
              Open league predictions →
            </p>
          </Link>
        ))}
      </section>
    </div>
  );
}
