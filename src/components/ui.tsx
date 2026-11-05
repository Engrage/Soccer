import type { CSSProperties, ReactNode } from "react";

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
    <div className="panel-tight p-4">
      <p className="label">{label}</p>
      <p className="stat-value mt-1" style={accent ? { color: accent } : undefined}>
        {value}
      </p>
      {hint ? <p className="mt-1 text-[11px] text-slate-500">{hint}</p> : null}
    </div>
  );
}

export function TeamBadge({
  abbreviation,
  accent,
  size = "md",
}: {
  abbreviation: string;
  accent: string;
  size?: "md" | "lg";
}) {
  const dimension = size === "lg" ? "size-12 text-sm" : "size-9 text-[11px]";
  return (
    <span
      className={`grid ${dimension} shrink-0 place-items-center rounded-xl border border-white/10 font-bold text-white`}
      style={{
        background: `linear-gradient(135deg, ${accent}33, rgba(255,255,255,0.04))`,
        boxShadow: `inset 0 0 0 1px ${accent}22`,
      }}
    >
      {abbreviation.slice(0, 3).toUpperCase()}
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
  const total = segments.reduce((sum, segment) => sum + segment.value, 0) || 1;
  return (
    <div className={`flex ${height} w-full overflow-hidden rounded-full bg-white/5`}>
      {segments.map((segment) => (
        <div
          key={segment.label}
          title={`${segment.label}: ${(segment.value * 100).toFixed(1)}%`}
          style={{
            width: `${(segment.value / total) * 100}%`,
            background: segment.tone,
          }}
        />
      ))}
    </div>
  );
}

export function ConfidenceRing({ value, size = 44 }: { value: number; size?: number }) {
  const clamped = Math.max(0, Math.min(100, value));
  const stroke = 4;
  const radius = (size - stroke) / 2;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference * (1 - clamped / 100);
  const color = clamped >= 70 ? "#16d6a0" : clamped >= 50 ? "#38bdf8" : "#fbbf24";
  return (
    <span className="relative inline-grid shrink-0 place-items-center" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="-rotate-90">
        <circle cx={size / 2} cy={size / 2} r={radius} stroke="rgba(255,255,255,0.08)" strokeWidth={stroke} fill="none" />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          stroke={color}
          strokeWidth={stroke}
          fill="none"
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={offset}
        />
      </svg>
      <span className="absolute text-[10px] font-bold text-white">{Math.round(clamped)}</span>
    </span>
  );
}

export function FormPips({ lastFive }: { lastFive: string[] | string | null | undefined }) {
  const results = Array.isArray(lastFive)
    ? lastFive
    : typeof lastFive === "string"
      ? lastFive.split("")
      : [];
  const tone = (result: string) =>
    result === "W"
      ? "bg-emerald-400"
      : result === "D"
        ? "bg-slate-400"
        : result === "L"
          ? "bg-rose-400"
          : "bg-white/15";
  return (
    <span className="inline-flex items-center gap-1">
      {Array.from({ length: 5 }, (_, index) => {
        const result = results[index] ?? "-";
        return (
          <span
            key={index}
            title={result}
            className={`size-1.5 rounded-full ${tone(result)}`}
          />
        );
      })}
    </span>
  );
}

export function Meter({
  label,
  value,
  tone = "#16d6a0",
}: {
  label: string;
  value: number;
  tone?: string;
}) {
  const pct = Math.max(0, Math.min(1, value)) * 100;
  const style: CSSProperties = {
    width: `${pct}%`,
    background: tone.startsWith("linear") ? tone : `linear-gradient(90deg, ${tone}88, ${tone})`,
  };
  return (
    <div>
      <div className="flex items-center justify-between text-xs">
        <span className="text-slate-400">{label}</span>
        <span className="font-semibold text-white">{pct.toFixed(1)}%</span>
      </div>
      <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-white/5">
        <div className="h-full rounded-full" style={style} />
      </div>
    </div>
  );
}
