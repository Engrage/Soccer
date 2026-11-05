import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { PredictionBoard } from "@/components/prediction-board";
import { FormPips } from "@/components/ui";
import { getAllLeagues, getLeagueBySlug, getTeamsForLeague } from "@/lib/queries";
import { fetchStandings } from "@/lib/espn";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const league = await getLeagueBySlug(slug);
  if (!league) return { title: "League not found" };
  return {
    title: `${league.name} predictions`,
    description: `Updated ${league.name} predictions with model probabilities, over/under, BTTS, correct score and HT/FT for every fixture.`,
  };
}

export default async function LeaguePage({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const [{ slug }, resolvedSearchParams] = await Promise.all([params, searchParams]);
  const league = await getLeagueBySlug(slug);
  if (!league) notFound();

  const [teamRatings, leagueList, standings] = await Promise.all([
    getTeamsForLeague(league.id),
    getAllLeagues(),
    league.externalId ? fetchStandings(league.externalId) : Promise.resolve([]),
  ]);
  const table = [...standings].sort((a, b) => {
    if (a.rank && b.rank) return a.rank - b.rank;
    return b.points - a.points || b.goalsFor - b.goalsAgainst - (a.goalsFor - a.goalsAgainst);
  });
  const ratingByName = new Map(teamRatings.map((team) => [team.name, team]));

  return (
    <div className="space-y-6">
      <section className="panel p-6 lg:p-8">
        <div className="flex flex-wrap items-center gap-3">
          <span className="text-3xl">{league.flag}</span>
          <div>
            <h1 className="text-2xl font-semibold tracking-tight text-white sm:text-3xl">
              {league.name}
            </h1>
            <p className="text-xs text-slate-500">
              {league.country} · tier {league.tier} · {teamRatings.length} teams rated
            </p>
          </div>
          <span
            className="ml-auto h-1.5 w-24 rounded-full"
            style={{ background: `linear-gradient(90deg, ${league.accent}, transparent)` }}
          />
        </div>
      </section>

      <PredictionBoard
        searchParams={resolvedSearchParams}
        focus="all"
        eyebrow={`${league.country} predictions`}
        title={`${league.name} model board`}
        description={`Every ${league.name} fixture is modelled with its own goal environment and team multipliers. Filter by market, confidence or value edge to isolate the selections the engine likes most in this competition.`}
        defaults={{ league: slug, sort: "kickoff" }}
        showTopPicks={false}
      />

      {table.length > 0 ? (
        <section className="panel p-6">
          <h2 className="text-lg font-semibold text-white">Real league table</h2>
          <p className="mt-1 text-xs text-slate-500">
            Live standings for {league.name} — the same goals for/against data feeds the attack and
            defence multipliers used by the prediction engine.
          </p>
          <div className="mt-4 overflow-x-auto">
            <table className="w-full min-w-[720px] text-sm">
              <thead>
                <tr className="border-b border-white/10 text-left text-[10px] uppercase tracking-[0.14em] text-slate-500">
                  <th className="py-2">#</th>
                  <th className="py-2">Team</th>
                  <th className="py-2 text-right">P</th>
                  <th className="py-2 text-right">W</th>
                  <th className="py-2 text-right">D</th>
                  <th className="py-2 text-right">L</th>
                  <th className="py-2 text-right">GF</th>
                  <th className="py-2 text-right">GA</th>
                  <th className="py-2 text-right">GD</th>
                  <th className="py-2 text-right">Pts</th>
                  <th className="py-2 text-right">Attack</th>
                  <th className="py-2 text-right">Defence</th>
                </tr>
              </thead>
              <tbody>
                {table.map((row, index) => {
                  const rating = ratingByName.get(row.name);
                  const gd = row.goalsFor - row.goalsAgainst;
                  return (
                    <tr key={row.id} className="border-b border-white/5">
                      <td className="py-2.5 text-slate-500">{row.rank || index + 1}</td>
                      <td className="py-2.5 font-medium text-slate-100">
                        <span className="mr-2 text-xs text-slate-500">{row.abbreviation}</span>
                        {row.name}
                      </td>
                      <td className="py-2.5 text-right text-slate-400">{row.gamesPlayed}</td>
                      <td className="py-2.5 text-right text-emerald-300">{row.wins}</td>
                      <td className="py-2.5 text-right text-slate-300">{row.ties}</td>
                      <td className="py-2.5 text-right text-rose-300">{row.losses}</td>
                      <td className="py-2.5 text-right text-slate-300">{row.goalsFor}</td>
                      <td className="py-2.5 text-right text-slate-300">{row.goalsAgainst}</td>
                      <td className="py-2.5 text-right text-slate-400">
                        {gd > 0 ? `+${gd}` : gd}
                      </td>
                      <td className="py-2.5 text-right font-semibold text-white">{row.points}</td>
                      <td className="py-2.5 text-right text-emerald-300">
                        {rating ? rating.attack.toFixed(2) : "—"}
                      </td>
                      <td className="py-2.5 text-right text-rose-300">
                        {rating ? rating.defense.toFixed(2) : "—"}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </section>
      ) : null}

      <section className="panel p-6">
        <h2 className="text-lg font-semibold text-white">Team ratings used by the engine</h2>
        <p className="mt-1 text-xs text-slate-500">
          Attack and defence are multipliers relative to league average — higher attack and lower
          defence are better.
        </p>
        <div className="mt-4 grid gap-2 sm:grid-cols-2 xl:grid-cols-3">
          {teamRatings.slice(0, 12).map((team) => (
            <div key={team.id} className="panel-tight flex items-center gap-3 p-3">
              <span className="grid size-9 place-items-center rounded-lg border border-white/10 bg-white/5 text-[11px] font-bold text-slate-200">
                {team.abbreviation}
              </span>
              <div className="min-w-0">
                <p className="truncate text-sm font-semibold text-white">{team.name}</p>
                <p className="text-[11px] text-slate-500">
                  {team.record ? `${team.record} W-D-L · ` : ""}
                  elo {Math.round(team.elo)}
                </p>
              </div>
              <div className="ml-auto text-right">
                <p className="text-xs font-semibold text-emerald-300">{team.attack.toFixed(2)}</p>
                <p className="text-xs font-semibold text-rose-300">{team.defense.toFixed(2)}</p>
              </div>
            </div>
          ))}
        </div>
      </section>

      <section className="panel p-6">
        <h2 className="text-lg font-semibold text-white">Other competitions</h2>
        <div className="mt-4 flex flex-wrap gap-2">
          {leagueList
            .filter((item) => item.slug !== league.slug)
            .map((item) => (
              <a key={item.slug} className="chip hover:border-emerald-400/40" href={`/leagues/${item.slug}`}>
                {item.flag} {item.name}
              </a>
            ))}
        </div>
      </section>
    </div>
  );
}
