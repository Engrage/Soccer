import Link from "next/link";

import { BoardControls } from "@/components/board-controls";
import { LiveRefresher } from "@/components/live-refresher";
import { MatchCard, type CardFocus } from "@/components/match-card";
import { StatTile } from "@/components/ui";
import {
  loadBoard,
  parseBoardParams,
  PAGE_SIZE,
  type BoardParams,
  type SearchParamsInput,
} from "@/lib/board";

function boardBasePath(focus: string): string {
  switch (focus) {
    case "over-under":
      return "/over-under";
    case "correct-score":
      return "/correct-score";
    case "ht-ft":
      return "/ht-ft";
    case "value":
      return "/value-bets";
    default:
      return "/";
  }
}
import { longDayLabel } from "@/lib/dates";

export type PredictionBoardProps = {
  searchParams: SearchParamsInput;
  focus: CardFocus;
  title: string;
  eyebrow: string;
  description: string;
  defaults?: { market?: string; sort?: string; rankMarket?: string; league?: string };
  showTopPicks?: boolean;
};

export async function PredictionBoard({
  searchParams,
  focus,
  title,
  eyebrow,
  description,
  defaults,
  showTopPicks = true,
}: PredictionBoardProps) {
  const params = parseBoardParams(searchParams, defaults);
  const board = await loadBoard(params);
  const settled = board.summary.finishedMatches;
  const basePath = boardBasePath(focus);
  const live = board.rows.some((row) => row.source === "espn");
  const liveNow = board.rows.filter((row) => row.status === "live").length;
  const syncedAt = board.rows.reduce<string | null>((latest, row) => {
    if (!row.syncedAt) return latest;
    return !latest || row.syncedAt > latest ? row.syncedAt : latest;
  }, null);
  const refreshMs = liveNow > 0 ? 45_000 : 300_000;

  return (
    <div className="space-y-6">
      <section className="panel overflow-hidden">
        <div className="grid gap-6 p-6 lg:grid-cols-[1.4fr_1fr] lg:p-8">
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <span className="chip-accent">{eyebrow}</span>
              {live ? (
                <span className="inline-flex items-center gap-1.5 rounded-full border border-emerald-400/30 bg-emerald-400/10 px-2.5 py-1 text-[11px] font-semibold text-emerald-300">
                  <span className="live-dot size-1.5 rounded-full bg-emerald-400" />
                  Live data · real fixtures, standings &amp; odds
                </span>
              ) : (
                <span className="chip border-amber-400/30 bg-amber-400/10 text-amber-200">
                  Offline model data
                </span>
              )}
            </div>
            <h1 className="mt-3 text-3xl font-semibold tracking-tight text-white sm:text-4xl">
              {title}
            </h1>
            <p className="mt-3 max-w-2xl text-sm leading-relaxed text-slate-400">{description}</p>
            {live ? (
              <p className="mt-2 text-xs text-slate-500">
                Fixtures, scores and bookmaker prices synced from the live ESPN football feed ·
                team attack and defence multipliers computed from real season goals for/against.
              </p>
            ) : null}
            <div className="mt-5 flex flex-wrap gap-2">
              <Link className="btn" href="/over-under">
                Over/under board
              </Link>
              <Link className="btn" href="/correct-score">
                Correct score grid
              </Link>
              <Link className="btn" href="/ht-ft">
                HT/FT matrix
              </Link>
              <Link className="btn" href="/value-bets">
                Value bets
              </Link>
            </div>
          </div>
          <div className="space-y-3 self-start">
            <div className="grid grid-cols-2 gap-3">
            <StatTile
              label="Matches analysed"
              value={board.summary.totalMatches}
              hint={longDayLabel(params.date)}
            />
            <StatTile
              label="Avg confidence"
              value={`${Math.round(board.summary.averageConfidence)}`}
              hint="0-100 model conviction"
            />
            <StatTile
              label="Live now"
              value={board.summary.liveMatches}
              hint="in-play fixtures"
              accent="#fb7185"
            />
            <StatTile
              label="Value picks"
              value={board.summary.valuePicks}
              hint="edge > 4%"
              accent="#16d6a0"
            />
            </div>
            {live ? (
              <LiveRefresher liveCount={liveNow} intervalMs={refreshMs} syncedAt={syncedAt} />
            ) : null}
          </div>
        </div>
      </section>

      <BoardControls
        basePath={basePath}
        days={board.days}
        leagues={board.leagues.map((league) => ({
          slug: league.slug,
          name: league.name,
          flag: league.flag,
        }))}
        date={params.date}
        league={params.league}
        market={params.market}
        query={params.q}
        sort={params.sort}
        minConfidence={params.minConfidence}
        markets={[
          { value: "all", label: "All markets" },
          ...(
            [
              "home",
              "draw",
              "away",
              "over-2.5",
              "under-2.5",
              "over-3.5",
              "btts-yes",
              "btts-no",
              "double-1x",
              "double-12",
              "double-x2",
              "value",
            ] as const
          ).map((value) => ({
            value,
            label:
              value === "value"
                ? "Positive value edge"
                : value === "home"
                  ? "Home win"
                  : value === "draw"
                    ? "Draw"
                    : value === "away"
                      ? "Away win"
                      : value === "over-2.5"
                        ? "Over 2.5 goals"
                        : value === "under-2.5"
                          ? "Under 2.5 goals"
                          : value === "over-3.5"
                            ? "Over 3.5 goals"
                            : value === "btts-yes"
                              ? "Both teams to score"
                              : value === "btts-no"
                                ? "BTTS - No"
                                : value === "double-1x"
                                  ? "Double chance 1X"
                                  : value === "double-12"
                                    ? "Double chance 12"
                                    : "Double chance X2",
          })),
        ]}
      />

      {showTopPicks && board.topPicks.length > 0 ? (
        <section>
          <div className="mb-3 flex items-end justify-between">
            <div>
              <h2 className="text-lg font-semibold text-white">Highest conviction picks</h2>
              <p className="text-xs text-slate-500">
                Ranked by model confidence for {longDayLabel(params.date)}
              </p>
            </div>
            <Link className="text-xs text-emerald-300 hover:text-emerald-200" href="/value-bets">
              See all value bets →
            </Link>
          </div>
          <div className="grid gap-3 lg:grid-cols-3">
            {board.topPicks.map((match, index) => (
              <MatchCard
                key={match.id}
                match={match}
                focus={focus}
                highlight={`#${index + 1} pick`}
              />
            ))}
          </div>
        </section>
      ) : null}

      <section className="space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 className="text-lg font-semibold text-white">
            {board.filteredCount} prediction{board.filteredCount === 1 ? "" : "s"}
            {params.league !== "all" ? ` · ${board.leagues.find((l) => l.slug === params.league)?.name ?? params.league}` : ""}
          </h2>
          <p className="text-xs text-slate-500">
            {settled > 0
              ? `${settled} fixture${settled === 1 ? "" : "s"} already settled · hit rates update live`
              : "All fixtures pending kickoff"}
          </p>
        </div>

        {board.groups.length === 0 ? (
          <div className="panel p-10 text-center">
            <p className="text-sm font-medium text-white">No matches match these filters</p>
            <p className="mt-1 text-xs text-slate-400">
              {live
                ? "No real fixtures match these filters for this date. Clear the market filter, lower the confidence threshold or pick another date from the strip above."
                : "Live fixtures could not be reached for this date. Clear the filters or try again shortly — the simulator archive is used only when the feed is unreachable."}
            </p>
          </div>
        ) : (
          board.groups.map((group) => (
            <details
              key={group.league.id}
              open
              className="panel group/league overflow-hidden"
            >
              <summary className="flex cursor-pointer list-none items-center gap-3 px-4 py-3">
                <span className="text-lg">{group.league.flag}</span>
                <span className="text-sm font-semibold text-white">{group.league.name}</span>
                <span className="chip">{group.matches.length} fixtures</span>
                <span
                  className="ml-auto h-1.5 w-16 rounded-full"
                  style={{
                    background: `linear-gradient(90deg, ${group.league.accent}, transparent)`,
                  }}
                />
                <Link
                  href={`/leagues/${group.league.slug}?date=${params.date}`}
                  className="chip hover:border-emerald-400/40 hover:text-emerald-200"
                >
                  League view
                </Link>
                <span className="text-xs text-slate-500 transition group-open/league:rotate-180">
                  ▾
                </span>
              </summary>
              <div className="grid gap-3 border-t border-white/5 p-3 md:grid-cols-2 xl:grid-cols-3">
                {group.matches.map((match) => (
                  <MatchCard key={match.id} match={match} focus={focus} />
                ))}
              </div>
            </details>
          ))
        )}

        {board.pageCount > 1 ? (
          <Pagination basePath={basePath} params={params} pageCount={board.pageCount} />
        ) : null}
      </section>
    </div>
  );
}

function Pagination({
  basePath,
  params,
  pageCount,
}: {
  basePath: string;
  params: BoardParams;
  pageCount: number;
}) {
  const buildHref = (page: number) => {
    const search = new URLSearchParams();
    search.set("date", params.date);
    if (params.league !== "all") search.set("league", params.league);
    if (params.market !== "all") search.set("market", params.market);
    if (params.q) search.set("q", params.q);
    if (params.sort !== "kickoff") search.set("sort", params.sort);
    if (params.minConfidence > 0) search.set("minConfidence", String(params.minConfidence));
    if (page > 1) search.set("page", String(page));
    const qs = search.toString();
    return qs ? `${basePath}?${qs}` : basePath;
  };

  const page = params.page;
  const windowPages = Array.from({ length: pageCount }, (_, index) => index + 1).filter(
    (item) => item === 1 || item === pageCount || Math.abs(item - page) <= 1,
  );

  return (
    <nav className="panel flex flex-wrap items-center justify-center gap-1.5 p-3">
      {page > 1 ? (
        <Link className="btn" href={buildHref(page - 1)}>
          ← Prev
        </Link>
      ) : null}
      {windowPages.map((item, index) => (
        <span key={item} className="flex items-center gap-1.5">
          {index > 0 && item - windowPages[index - 1] > 1 ? (
            <span className="px-1 text-xs text-slate-600">…</span>
          ) : null}
          <Link
            href={buildHref(item)}
            className={`grid size-9 place-items-center rounded-lg text-sm transition ${
              item === page
                ? "bg-emerald-400/20 font-semibold text-emerald-200"
                : "border border-white/10 bg-white/[0.03] text-slate-300 hover:border-emerald-400/40"
            }`}
          >
            {item}
          </Link>
        </span>
      ))}
      {page < pageCount ? (
        <Link className="btn" href={buildHref(page + 1)}>
          Next →
        </Link>
      ) : null}
      <p className="ml-2 text-xs text-slate-500">
        page {page} of {pageCount} · {PAGE_SIZE} per page
      </p>
    </nav>
  );
}
