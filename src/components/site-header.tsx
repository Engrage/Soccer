"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";

const NAV = [
  { href: "/", label: "Predictions" },
  { href: "/over-under", label: "Over/Under" },
  { href: "/correct-score", label: "Correct Score" },
  { href: "/ht-ft", label: "HT/FT" },
  { href: "/value-bets", label: "Value Bets" },
  { href: "/accuracy", label: "Accuracy" },
  { href: "/leagues", label: "Leagues" },
];

export function SiteHeader() {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);

  const isActive = (href: string) =>
    href === "/" ? pathname === "/" : pathname.startsWith(href);

  return (
    <header className="sticky top-0 z-40 border-b border-white/10 bg-ink-950/85 backdrop-blur-xl">
      <div className="mx-auto flex w-full max-w-7xl items-center gap-4 px-4 py-3 sm:px-6">
        <Link href="/" className="flex items-center gap-2.5">
          <span className="grid size-9 place-items-center rounded-xl bg-gradient-to-br from-emerald-400 to-cyan-400 text-base font-black text-slate-950 shadow-lg shadow-emerald-500/20">
            G
          </span>
          <span className="leading-tight">
            <span className="block text-sm font-semibold tracking-tight text-white">GoalSeer</span>
            <span className="block text-[10px] uppercase tracking-[0.18em] text-emerald-300/80">
              Football model
            </span>
          </span>
        </Link>

        <nav className="ml-auto hidden items-center gap-1 lg:flex">
          {NAV.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className={`rounded-lg px-3 py-1.5 text-sm transition ${
                isActive(item.href)
                  ? "bg-emerald-400/15 text-emerald-200"
                  : "text-slate-400 hover:bg-white/5 hover:text-slate-100"
              }`}
            >
              {item.label}
            </Link>
          ))}
        </nav>

        <Link href="/?sort=confidence" className="btn-primary ml-auto hidden lg:ml-3 lg:inline-flex">
          Top confidence
        </Link>

        <button
          type="button"
          aria-label="Toggle navigation"
          onClick={() => setOpen((value) => !value)}
          className="ml-auto grid size-9 place-items-center rounded-lg border border-white/10 bg-white/5 text-slate-300 lg:hidden"
        >
          <span className="text-lg leading-none">{open ? "×" : "≡"}</span>
        </button>
      </div>

      {open ? (
        <nav className="mx-auto grid w-full max-w-7xl grid-cols-2 gap-2 px-4 pb-4 sm:px-6 lg:hidden">
          {NAV.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              onClick={() => setOpen(false)}
              className={`rounded-lg border border-white/10 px-3 py-2 text-sm ${
                isActive(item.href)
                  ? "bg-emerald-400/15 text-emerald-200"
                  : "bg-white/5 text-slate-300"
              }`}
            >
              {item.label}
            </Link>
          ))}
        </nav>
      ) : null}
    </header>
  );
}
