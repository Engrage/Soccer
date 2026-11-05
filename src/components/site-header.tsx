import Link from "next/link";

const NAV = [
  { href: "/", label: "Predictions" },
  { href: "/over-under", label: "Over/under" },
  { href: "/correct-score", label: "Correct score" },
  { href: "/ht-ft", label: "HT/FT" },
  { href: "/value-bets", label: "Value bets" },
  { href: "/accuracy", label: "Accuracy" },
  { href: "/leagues", label: "Leagues" },
];

export function SiteHeader() {
  return (
    <header className="sticky top-0 z-40 border-b border-white/10 bg-ink-950/85 backdrop-blur-md">
      <div className="mx-auto flex w-full max-w-7xl items-center gap-4 px-4 py-3 sm:px-6">
        <Link href="/" className="flex shrink-0 items-center gap-2">
          <span className="grid size-8 place-items-center rounded-lg bg-gradient-to-br from-emerald-400 to-cyan-400 text-base font-black text-slate-950">
            G
          </span>
          <span className="text-lg font-semibold tracking-tight text-white">GoalSeer</span>
        </Link>
        <nav className="ml-auto flex items-center gap-1 overflow-x-auto">
          {NAV.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className="whitespace-nowrap rounded-lg px-3 py-1.5 text-sm text-slate-300 transition hover:bg-white/5 hover:text-emerald-200"
            >
              {item.label}
            </Link>
          ))}
        </nav>
      </div>
    </header>
  );
}
