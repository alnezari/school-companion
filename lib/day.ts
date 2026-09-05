"use client";
import { supabase } from "./supabase/client";
import { weekday } from "./schedule";

// The daily plan. One list of activities: a fixed one appears on the day by itself at its time (locked or movable);
// the others he adds himself from the basket. Categories carry the colours.
export interface Category { key: string; name_en: string; name_ar: string; color: string; sort: number }
export interface Activity {
  id: string; name_en: string; name_ar: string; icon: string; category: string; durations: number[]; stars: number; max_minutes_per_day: number | null; active: boolean; sort: number;
  fixed: boolean; start_time: string | null; minutes: number | null; days: number[]; repeat: "weekly" | "once"; on_date: string | null; locked: boolean;
}
export interface DayItem { id: string; date: string; activity_id: string; start_time: string; minutes: number; done_at: string | null; not_done_at: string | null }
export type DayStatus = "done" | "not_done" | null;
export interface DayConfig { home: string; bed: string; wake: string }

/** The palette parents can pick from for a new category. */
export const PALETTE = ["#22A06B", "#3B7DDD", "#7A5AF8", "#F27D26", "#D9A400", "#E0457B", "#0FA3B1", "#8A94A6"];
export const toMin = (t: string) => { const [h, m] = t.split(":").map(Number); return h * 60 + m; };
export const toTime = (min: number) => `${String(Math.floor(min / 60)).padStart(2, "0")}:${String(min % 60).padStart(2, "0")}`;
export function isWeekend(iso: string) { return weekday(iso) >= 5; }
/** The part of the day he controls: home → bed on school days, wake → bed on Friday and Saturday. */
export function dayWindow(cfg: DayConfig, iso: string) {
  return { start: toMin(isWeekend(iso) ? cfg.wake : cfg.home), end: toMin(cfg.bed) };
}
export function configFrom(s: Record<string, string>): DayConfig {
  return { home: s.day_home_time || "14:00", bed: s.day_bed_time || "19:30", wake: s.day_weekend_wake || "09:00" };
}
/** Fixed activities that belong on this date (and are not skipped). */
export function showsOn(a: Activity, iso: string) {
  return a.active && a.fixed && !!a.start_time && (a.repeat === "once" ? a.on_date === iso : a.days.includes(weekday(iso)));
}
export function fixedFor(list: Activity[], iso: string, skips: Set<string>) {
  return list.filter((a) => showsOn(a, iso) && !skips.has(a.id));
}
export const catColor = (cats: Category[], key: string) => cats.find((c) => c.key === key)?.color ?? "#8A94A6";
export const catName = (cats: Category[], key: string, lang: "en" | "ar") => { const c = cats.find((x) => x.key === key); return c ? (lang === "ar" ? c.name_ar : c.name_en) : key; };

const clean = (a: Activity): Activity => ({ ...a, start_time: a.start_time ? a.start_time.slice(0, 5) : null });
export async function loadCategories(): Promise<Category[]> {
  const { data } = await supabase().from("categories").select("*").order("sort");
  return (data || []) as Category[];
}
export async function loadActivities(): Promise<Activity[]> {
  const { data } = await supabase().from("activities").select("*").order("sort").order("created_at");
  return ((data || []) as Activity[]).map(clean);
}
export async function loadSkips(iso: string): Promise<Set<string>> {
  const { data } = await supabase().from("activity_skips").select("activity_id").eq("date", iso);
  return new Set(((data || []) as { activity_id: string }[]).map((r) => r.activity_id));
}
export async function loadDayItems(iso: string): Promise<DayItem[]> {
  const { data } = await supabase().from("day_items").select("*").eq("date", iso).order("start_time");
  return ((data || []) as DayItem[]).map((i) => ({ ...i, start_time: i.start_time.slice(0, 5) }));
}
export async function addDayItem(iso: string, activityId: string, start: number, minutes: number): Promise<DayItem | null> {
  const { data, error } = await supabase().from("day_items").insert({ date: iso, activity_id: activityId, start_time: toTime(start), minutes }).select().single();
  return error ? null : { ...(data as DayItem), start_time: (data as DayItem).start_time.slice(0, 5) };
}
export async function moveDayItem(id: string, start: number) {
  await supabase().from("day_items").update({ start_time: toTime(start) }).eq("id", id);
}
export async function removeDayItem(id: string) {
  await supabase().from("day_items").delete().eq("id", id);
}
/** Once an item's time has come he says how it went: done, not done, or (tap again) undecided. */
export async function setStatus(id: string, status: DayStatus) {
  const now = new Date().toISOString();
  await supabase().from("day_items").update({ done_at: status === "done" ? now : null, not_done_at: status === "not_done" ? now : null }).eq("id", id);
}
export function subscribeDayItems(iso: string, onChange: () => void) {
  const ch = supabase().channel(`day-${iso}`)
    .on("postgres_changes", { event: "*", schema: "public", table: "day_items", filter: `date=eq.${iso}` }, onChange).subscribe();
  return () => { supabase().removeChannel(ch); };
}
/** All stars ever earned in My day. */
export async function loadDayStars(): Promise<number> {
  const { data } = await supabase().from("day_items").select("activities(stars)").not("done_at", "is", null);
  return ((data || []) as unknown as { activities: { stars: number } | null }[]).reduce((n, r) => n + (r.activities?.stars ?? 0), 0);
}

// Parent side
export async function saveActivity(a: Partial<Activity> & { name_en: string; name_ar: string; icon: string; category: string }) {
  const { data, error } = await supabase().from("activities").upsert(a).select().single();
  return error ? null : clean(data as Activity);
}
export async function deleteActivity(id: string) { await supabase().from("activities").delete().eq("id", id); }
export async function saveCategory(c: Category) {
  const { error } = await supabase().from("categories").upsert(c);
  return !error;
}
export async function setSkip(activityId: string, iso: string, skip: boolean) {
  const sb = supabase();
  if (skip) await sb.from("activity_skips").upsert({ activity_id: activityId, date: iso });
  else await sb.from("activity_skips").delete().eq("activity_id", activityId).eq("date", iso);
}
