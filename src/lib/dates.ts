const DAY_MS = 86_400_000;

export function todayKey(now = new Date()): string {
  return now.toISOString().slice(0, 10);
}

export function dayKeyFrom(date: Date): string {
  return date.toISOString().slice(0, 10);
}

export function addDays(date: Date, days: number): Date {
  return new Date(date.getTime() + days * DAY_MS);
}

export function dateFromKey(key: string): Date {
  const [y, m, d] = key.split("-").map(Number);
  return new Date(Date.UTC(y, (m ?? 1) - 1, d ?? 1, 12, 0, 0));
}

export function formatKickoff(date: Date): string {
  return date.toISOString().slice(11, 16);
}

export function shortDayLabel(key: string): string {
  return dateFromKey(key).toLocaleDateString("en-GB", {
    weekday: "short",
    day: "2-digit",
    timeZone: "UTC",
  });
}

export function longDayLabel(key: string): string {
  return dateFromKey(key).toLocaleDateString("en-GB", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  });
}

export function formatDayNumber(key: string): string {
  return dateFromKey(key).toLocaleDateString("en-GB", {
    day: "2-digit",
    month: "short",
    timeZone: "UTC",
  });
}

export function isValidDayKey(key: string): boolean {
  return /^\d{4}-\d{2}-\d{2}$/.test(key) && !Number.isNaN(dateFromKey(key).getTime());
}
