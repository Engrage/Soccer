"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef, useState, useTransition } from "react";

export type DayOption = { key: string; label: string; sub: string; count: number };

export type BoardControlsProps = {
  basePath: string;
  days: DayOption[];
  leagues: { slug: string; name: string; flag: string }[];
  date: string;
  league: string;
  market: string;
  query: string;
  sort: string;
  minConfidence: number;
  markets: { value: string; label: string }[];
};

export function BoardControls({
  basePath,
  days,
  leagues,
  date,
  league,
  market,
  query,
  sort,
  minConfidence,
  markets,
}: BoardControlsProps) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [search, setSearch] = useState(query);
  const firstRender = useRef(true);

  const push = (patch: Record<string, string | number | undefined>) => {
    const params = new URLSearchParams();
    const merged: Record<string, string> = {
      date,
      league,
      market,
      q: search,
      sort,
      minConfidence: String(minConfidence),
      // Any filter change resets pagination.
      page: "1",
      ...Object.fromEntries(
        Object.entries(patch).map(([key, value]) => [key, String(value)]),
      ),
    };
    for (const [key, value] of Object.entries(merged)) {
      if (value && value !== "all" && !(key === "minConfidence" && value === "0")) {
        params.set(key, value);
      }
    }
    const qs = params.toString();
    startTransition(() => {
      router.push(qs ? `${basePath}?${qs}` : basePath, { scroll: false });
    });
  };

  useEffect(() => {
    if (firstRender.current) {
      firstRender.current = false;
      return;
    }
    const timer = setTimeout(() => {
      if (search !== query) push({ q: search });
    }, 350);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [search]);

  return (
    <div className="panel p-4">
      <div className="flex gap-2 overflow-x-auto pb-1">
        {days.map((day) => (
          <button
            key={day.key}
            type="button"
            onClick={() => push({ date: day.key })}
            className={`min-w-[104px] shrink-0 rounded-xl border px-3 py-2 text-left transition ${
              day.key === date
                ? "border-emerald-400/50 bg-emerald-400/15 text-emerald-100"
                : "border-white/10 bg-white/[0.03] text-slate-300 hover:border-white/25"
            }`}
          >
            <span className="block text-[11px] uppercase tracking-[0.14em] text-slate-400">
              {day.sub}
            </span>
            <span className="block text-sm font-semibold text-white">{day.label}</span>
            <span className="mt-0.5 block text-[11px] text-slate-400">
              {day.count} matches
            </span>
          </button>
        ))}
      </div>

      <input type="hidden" name="page" value="1" />

      <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-5">
        <label className="xl:col-span-2">
          <span className="label">Search team or league</span>
          <input
            className="field mt-1.5"
            placeholder="e.g. Real Madrid, Bundesliga"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
          />
        </label>

        <label>
          <span className="label">League</span>
          <select
            className="field mt-1.5"
            value={league}
            onChange={(event) => push({ league: event.target.value })}
          >
            <option value="all">All leagues</option>
            {leagues.map((item) => (
              <option key={item.slug} value={item.slug}>
                {item.flag} {item.name}
              </option>
            ))}
          </select>
        </label>

        <label>
          <span className="label">Market focus</span>
          <select
            className="field mt-1.5"
            value={market}
            onChange={(event) => push({ market: event.target.value })}
          >
            <option value="all">All markets</option>
            {markets.map((item) => (
              <option key={item.value} value={item.value}>
                {item.label}
              </option>
            ))}
          </select>
        </label>

        <div className="grid grid-cols-2 gap-3">
          <label>
            <span className="label">Sort</span>
            <select
              className="field mt-1.5"
              value={sort}
              onChange={(event) => push({ sort: event.target.value })}
            >
              <option value="kickoff">Kickoff</option>
              <option value="confidence">Confidence</option>
              <option value="value">Value edge</option>
              <option value="probability">Tip probability</option>
              <option value="goals">Expected goals</option>
            </select>
          </label>
          <label>
            <span className="label">Min conf.</span>
            <select
              className="field mt-1.5"
              value={String(minConfidence)}
              onChange={(event) => push({ minConfidence: Number(event.target.value) })}
            >
              <option value="0">Any</option>
              <option value="55">55+</option>
              <option value="65">65+</option>
              <option value="75">75+</option>
              <option value="85">85+</option>
            </select>
          </label>
        </div>
      </div>

      {pending ? (
        <p className="mt-3 text-xs text-emerald-300/80">Updating model board…</p>
      ) : null}
    </div>
  );
}
