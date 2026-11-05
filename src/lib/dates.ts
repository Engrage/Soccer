export const DAY_MS = 86_400_000;

export function dayKeyFrom(date: Date): string {
  return date.toISOString().slice(0, 10);
}

export function parseDayKey(key: string): Date {
  const [year, month, day] = key.split("-").map(Number);
  return new Date(Date.UTC(year, (month ?? 1) - 1, day ?? 1, 0, 0, 0));
}

export function isValidDayKey(key: string | undefined | null): key is string {
  return typeof key === "string" && /^\d{4}-\d{2}-\d{2}$/.test(key);
}

export function addDays(date: Date, days: number): Date {
  return new Date(date.getTime() + days * DAY_MS);
}

export function todayKey(): string {
  return dayKeyFrom(new Date());
}

/** Day offset label used by the date strip in the UI. */
export function relativeLabel(key: string): string {
  const today = todayKey();
  if (key === today) return "Today";
  if (key === dayKeyFrom(addDays(parseDayKey(today), 1))) return "Tomorrow";
  if (key === dayKeyFrom(addDays(parseDayKey(today), -1))) return "Yesterday";
  return shortDayLabel(key);
}

export function shortDayLabel(key: string): string {
  const date = parseDayKey(key);
  return date.toLocaleDateString("en-GB", {
    weekday: "short",
    day: "numeric",
    month: "short",
    timeZone: "UTC",
  });
}

export function longDayLabel(key: string): string {
  const date = parseDayKey(key);
  return date.toLocaleDateString("en-GB", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  });
}

/** Deterministic UTC formatting so server and client markup match. */
export function formatKickoff(date: Date): string {
  return date.toLocaleTimeString("en-GB", {
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "UTC",
  });
}

export function weekdayLabel(key: string): string {
  return parseDayKey(key).toLocaleDateString("en-GB", { weekday: "short", timeZone: "UTC" });
}

export function formatDayNumber(key: string): string {
  const date = parseDayKey(key);
  return date.toLocaleDateString("en-GB", {
    day: "2-digit",
    month: "short",
    timeZone: "UTC",
  });
}
