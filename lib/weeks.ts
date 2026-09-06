// The term's calendar needs no rows: the first week's start date (a setting) numbers every week after it.
import { addDays, weekStartFor } from "./schedule";

const DAY = 86400000;
const days = (a: string, b: string) => Math.round((Date.parse(b + "T12:00:00Z") - Date.parse(a + "T12:00:00Z")) / DAY);

/** Week number of the school week that contains `dateISO`, or null before the term. */
export function weekNumberFor(dateISO: string, week1Start: string): number | null {
  const n = Math.floor(days(week1Start, weekStartFor(dateISO)) / 7) + 1;
  return n >= 1 ? n : null;
}
/** Sunday that starts week `n`. */
export function weekStartOf(n: number, week1Start: string): string {
  return addDays(week1Start, (n - 1) * 7);
}
