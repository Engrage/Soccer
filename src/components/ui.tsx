import type { ReactNode } from "react";

export function TeamBadge({
  abbreviation,
  accent,
  size = "md",
}: {
  abbreviation: string;
  accent?: string;
  size?: "sm" | "md" | "lg";
}) {
  const dimension =
    size === "sm" ? "size-8 text-[10px]" : size === "lg" ? "size-14 text-sm" : "size-11 text-xs";
  return (
    <span
      className={`grid ${dimension} shrink-0 place-items-center rounded-xl border font-bold tracking-wide`}
      style={{
        borderColor: `${accent ?? "#38bdf8"}44`,
        background: `linear-gradient(140deg, ${accent ?? "#38bdf8"}26, transparent 70%)`,
        color: accent ?? "#7dd3fc",
      }}
    >
      {abbreviation}
    </span>
  );
}

export function ProbabilityBar({
  segments,
  height = "h-2",
}: {
  segments: { label: string; value: number; tone: string }[];
  height?: string;
}) {
  return (
    <div className={`w-full ${height} overflow-hidden rounded-full bg-white/5`}>
      <div className="flex h-full w-full">
        {segments.map((segment) => (
          <div
            key={segment.label}
            className={`${height} h-full transition-all`}
            style={{ width: `${Math.max(segment.value * 100, 2)}%`, background: segment.tone }}
            title={`${segment.label} ${(segment.value * 100).toFixed(0)}%`}
          />
        ))}
      </div>
    </div>
  );
}

export function ConfidenceRing({ value, size = 52 }: { value: number; size?: number }) {
  const radius = size / 2 - 4;
  const circumference = 2 * Math.PI * radius;
  const clamped = Math.max(0, Math.min(100, value));
  const dash = (clamped / 100) * circumference;
  const stroke = clamped >= 75 ? "#16d6a0" : clamped >= 60 ? "#38bdf8" : clamped >= 48 ? "#fbbf24" : "#fb7185";

  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} className="shrink-0">
      <circle
        cx={size / 2}
        cy={size / 2}
        r={radius}
        fill="none"
        stroke="rgba(148,163,184,0.18)"
        strokeWidth={4}
      />
      <circle
        cx={size / 2}
        cy={size / 2}
        r={radius}
        fill="none"
        stroke={stroke}
        strokeWidth={4}
        strokeLinecap="round"
        strokeDasharray={`${dash} ${circumference}`}
        transform={`rotate(-90 ${size / 2} ${size / 2})`}
      />
      <text
        x="50%"
        y="52%"
        dominantBaseline="middle"
        textAnchor="middle"
        fill="#e2e8f0"
        fontSize={size / 3.6}
        fontWeight={700}
      >
        {Math.round(clamped)}
      </text>
    </svg>
  );
}

export function FormPips({ lastFive }: { lastFive: string }) {
  const chars = lastFive.split("").slice(0, 5);
  const tone: Record<string, string> = {
    W: "bg-emerald-400/80 text-slate-950",
    D: "bg-slate-500/60 text-slate-100",
    L: "bg-rose-500/70 text-slate-950",
 "-": "bg-white/10 text-slate-400",
  };
  return (
    <span className="flex gap-1">
      {chars.map((char, index) => (
        <span
          key={`${char}-${index}`}
          className={`grid size-4 place-items-center rounded text-[9px] font-bold ${tone[char] ?? "bg-white/10 text-slate-400"}`}
        >
          {char}
        </span>
      ))}
    </span>
  );
}

export function StatTile({
  label,
  value,
  hint,
  accent,
}: {
  label: string;
  value: ReactNode;
  hint?: string;
  accent?: string;
}) {
  return (
    <div className="panel-tight px-4 py-3">
      <p className="label">{label}</p>
      <p
        className="mt-1 text-xl font-semibold tracking-tight text-white sm:text-2xl"
        style={accent ? { color: accent } : undefined}
      >
        {value}
      </p>
      {hint ? <p className="mt-0.5 text-[11px] text-slate-500">{hint}</p> : null}
    </div>
  );
}

export function Meter({
  label,
  value,
  right,
  tone = "#16d6a0",
}: {
  label: string;
  value: number;
  right?: string;
  tone?: string;
}) {
  return (
    <div>
      <div className="flex items-baseline justify-between text-xs">
        <span className="text-slate-300">{label}</span>
        <span className="font-semibold text-white">
          {right ?? `${(value * 100).toFixed(1)}%`}
        </span>
      </div>
      <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-white/5">
        <div
          className="h-full rounded-full"
          style={{ width: `${Math.min(100, Math.max(2, value * 100))}%`, background: tone }}
        />
      </div>
    </div>
  );
}

export function statusLabel(status: string, kickoff: string): string {
  if (status === "finished") return "FT";
  if (status === "live") return "LIVE";
  return kickoff;
}
