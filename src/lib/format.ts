export const TAKA = "\u09F3";

export function money(value: number | null | undefined): string {
  const n = Number(value ?? 0);
  return `${TAKA}${n.toLocaleString("en-US", { maximumFractionDigits: 0 })}`;
}

export function litres(value: number | null | undefined, digits = 1): string {
  return `${Number(value ?? 0).toFixed(digits)} L`;
}

export function shortDate(value: string | Date | null | undefined): string {
  if (!value) return "—";
  const d = typeof value === "string" ? new Date(value) : value;
  return d.toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" });
}

export function dayLabel(value: string): string {
  return new Date(value).toLocaleDateString("en-GB", { day: "2-digit", month: "short" });
}

export function ageFromDob(dob: string | null | undefined): string {
  if (!dob) return "—";
  const months = Math.max(
    0,
    Math.round((Date.now() - new Date(dob).getTime()) / (1000 * 60 * 60 * 24 * 30.44)),
  );
  const years = Math.floor(months / 12);
  const rem = months % 12;
  if (years === 0) return `${rem} mo`;
  return rem === 0 ? `${years} yr` : `${years} yr ${rem} mo`;
}

export function today(): string {
  return new Date().toISOString().slice(0, 10);
}

export function daysAgo(n: number): string {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return d.toISOString().slice(0, 10);
}

export function relativeTime(value: string): string {
  const diff = Date.now() - new Date(value).getTime();
  const mins = Math.round(diff / 60000);
  if (mins < 60) return `${Math.max(mins, 1)} min ago`;
  const hours = Math.round(mins / 60);
  if (hours < 24) return `${hours} h ago`;
  const days = Math.round(hours / 24);
  if (days < 30) return `${days} d ago`;
  return shortDate(value);
}
