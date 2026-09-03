// Dates and the school week, always in Saudi time.
export const TZ = "Asia/Riyadh";

export function todayISO(): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: TZ, year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date());
}
export function addDays(iso: string, n: number): string {
  const d = new Date(iso + "T12:00:00Z");
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}
/** 0 = Sunday … 6 = Saturday, for an ISO date. */
export function weekday(iso: string): number {
  return new Date(iso + "T12:00:00Z").getUTCDay();
}
/** School day index 0..4 (Sun..Thu) or null for Fri/Sat. */
export function schoolDay(iso: string): number | null {
  const w = weekday(iso);
  return w <= 4 ? w : null;
}
/** The next school day after today: Sun..Wed -> tomorrow, Thu/Fri/Sat -> next Sunday. */
export function nextSchoolDay(fromISO = todayISO()): string {
  const w = weekday(fromISO);
  const gap = w <= 3 ? 1 : 7 - w; // Thu(4)->3, Fri(5)->2, Sat(6)->1
  return addDays(fromISO, gap);
}
/** Sunday of the school week containing the date (Fri/Sat belong to the coming week). */
export function weekStartFor(iso: string): string {
  const w = weekday(iso);
  return w <= 4 ? addDays(iso, -w) : addDays(iso, 7 - w);
}
export function formatDate(iso: string, lang: "en" | "ar") {
  return new Intl.DateTimeFormat(lang === "ar" ? "ar-SA-u-nu-latn-ca-gregory" : "en-GB", { timeZone: "UTC", day: "numeric", month: "long" })
    .format(new Date(iso + "T12:00:00Z"));
}
export function fmtTime(t: string) {
  const [h, m] = t.split(":");
  return `${Number(h)}:${m}`;
}
/** Minutes since midnight → "4:30 PM" (or "٤:٣٠ م" style suffix in Arabic, digits kept Latin). */
export function fmt12(min: number, lang: "en" | "ar" = "en", omitMinutes = false) {
  const h = Math.floor(min / 60) % 24, m = min % 60, h12 = h % 12 || 12;
  const suffix = lang === "ar" ? (h < 12 ? "ص" : "م") : (h < 12 ? "AM" : "PM");
  return `${h12}${omitMinutes && m === 0 ? "" : `:${String(m).padStart(2, "0")}`} ${suffix}`;
}
