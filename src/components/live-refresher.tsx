"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

/**
 * Keeps the board current while matches are in play by re-running the server
 * components on a timer. Live fixtures refresh fastest; pre-match boards settle
 * on a slower cadence so nothing is hammered overnight.
 */
export function LiveRefresher({
  liveCount,
  intervalMs,
  syncedAt,
}: {
  liveCount: number;
  intervalMs: number;
  syncedAt: string | null;
}) {
  const router = useRouter();
  const [enabled, setEnabled] = useState(true);
  const [tick, setTick] = useState(0);

  useEffect(() => {
    if (!enabled) return;
    const id = setInterval(() => {
      router.refresh();
      setTick((value) => value + 1);
    }, intervalMs);
    return () => clearInterval(id);
  }, [enabled, intervalMs, router]);

  const synced = syncedAt ? new Date(syncedAt) : null;
  const clock = synced
    ? synced.toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" })
    : null;

  return (
    <div className="flex flex-wrap items-center gap-2">
      {liveCount > 0 ? (
        <span className="inline-flex items-center gap-1.5 rounded-full border border-rose-400/40 bg-rose-400/10 px-2.5 py-1 text-[11px] font-semibold text-rose-200">
          <span className="live-dot size-1.5 rounded-full bg-rose-400" />
          {liveCount} in play · auto-refresh on
        </span>
      ) : (
        <span className="chip">auto-refresh {Math.round(intervalMs / 1000)}s</span>
      )}
      {clock ? (
        <span className="chip" title={syncedAt ?? undefined}>
          synced {clock}
          {tick > 0 ? ` · ${tick} update${tick === 1 ? "" : "s"}` : ""}
        </span>
      ) : null}
      <button
        type="button"
        onClick={() => setEnabled((value) => !value)}
        className="chip hover:border-emerald-400/40 hover:text-emerald-200"
      >
        {enabled ? "pause" : "resume"}
      </button>
    </div>
  );
}
