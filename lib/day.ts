"use client";
import { supabase } from "./supabase/client";
import { weekday } from "./schedule";

// The daily plan: a basket of activities the child adds himself, fixed blocks the parents pin, and the cards placed on a date.
export type Category = "sport" | "learning" | "creative" | "screen" | "home" | "rest" | "study";
export const CATEGORY_COLOR: Record<Category, string> = {
  sport: "#22A06B", learning: "#3B7DDD", creative: "#7A5AF8", screen: "#F27D26", home: "#D9A400", rest: "#8A94A6", study: "#2457C5",
};
export const CATEGORIES: Category[] = ["sport", "learning", "creative", "screen", "home", "rest", "study"];

export interface Activity { id: string; name_en: string; name_ar: string; icon: string; category: Category; durations: number[]; stars: number; max_minutes_per_day: number | null; active: boolean; sort: number }
export interface FixedBlock { id: string; name_en: string; name_ar: string; icon: string; category: Category; start_time: string; minutes: number; days: number[]; repeat: "weekly" | "once"; on_date: string | null; stars: number; opens_school: boolean; active: boolean }
export interface DayItem { id: string; date: string; activity_id: string | null; block_id: string | null; start_time: string; minutes: number; done_at: string | null }
export interface DayConfig { home: string; bed: string; wake: string }

export const toMin = (t: string) => { const [h, m] = t.split(":").map(Number); return h * 60 + m; };
export const toTime = (min: number) => `${String(Math.floor(min / 60)).padStart(2, "0")}:${String(min % 60).padStart(2, "0")}`;
export const fmt = (min: number) => `${Math.floor(min / 60)}:${String(min % 60).padStart(2, "0")}`;
export function isWeekend(iso: string) { return weekday(iso) >= 5; }
/** The part of the day he controls: home → bed on school days, wake → bed on Friday and Saturday. */
export function dayWindow(cfg: DayConfig, iso: string) {
  return { start: toMin(isWeekend(iso) ? cfg.wake : cfg.home), end: toMin(cfg.bed) };
}
export function configFrom(s: Record<string, string>): DayConfig {
  return { home: s.day_home_time || "14:00", bed: s.day_bed_time || "19:30", wake: s.day_weekend_wake || "09:00" };
}
export function blocksFor(blocks: FixedBlock[], iso: string, skips: Set<string>) {
  const w = weekday(iso);
  return blocks.filter((b) => b.active && !skips.has(b.id) && (b.repeat === "once" ? b.on_date === iso : b.days.includes(w)));
}

export async function loadActivities(): Promise<Activity[]> {
  const { data } = await supabase().from("activities").select("*").order("sort").order("created_at");
  return (data || []) as Activity[];
}
export async function loadBlocks(): Promise<FixedBlock[]> {
  const { data } = await supabase().from("fixed_blocks").select("*").order("start_time");
  return ((data || []) as FixedBlock[]).map((b) => ({ ...b, start_time: b.start_time.slice(0, 5) }));
}
export async function loadSkips(iso: string): Promise<Set<string>> {
  const { data } = await supabase().from("block_skips").select("block_id").eq("date", iso);
  return new Set(((data || []) as { block_id: string }[]).map((r) => r.block_id));
}
export async function loadDayItems(iso: string): Promise<DayItem[]> {
  const { data } = await supabase().from("day_items").select("*").eq("date", iso).order("start_time");
  return ((data || []) as DayItem[]).map((i) => ({ ...i, start_time: i.start_time.slice(0, 5) }));
}
export async function addDayItem(iso: string, activityId: string, start: number, minutes: number): Promise<DayItem | null> {
  const { data, error } = await supabase().from("day_items").insert({ date: iso, activity_id: activityId, start_time: toTime(start), minutes }).select().single();
  return error ? null : ({ ...(data as DayItem), start_time: (data as DayItem).start_time.slice(0, 5) });
}
export async function moveDayItem(id: string, start: number) {
  await supabase().from("day_items").update({ start_time: toTime(start) }).eq("id", id);
}
export async function removeDayItem(id: string) {
  await supabase().from("day_items").delete().eq("id", id);
}
/** Marking a fixed block done creates a day_item that points at the block (so its stars count too). */
export async function markDone(iso: string, item: { id?: string; block_id?: string; start_time: string; minutes: number }, done: boolean): Promise<DayItem | null> {
  const sb = supabase();
  if (item.id) {
    const { data } = await sb.from("day_items").update({ done_at: done ? new Date().toISOString() : null }).eq("id", item.id).select().single();
    return (data as DayItem) ?? null;
  }
  if (!done || !item.block_id) return null;
  const { data } = await sb.from("day_items").insert({ date: iso, block_id: item.block_id, start_time: item.start_time, minutes: item.minutes, done_at: new Date().toISOString() }).select().single();
  return (data as DayItem) ?? null;
}
export function subscribeDayItems(iso: string, onChange: () => void) {
  const ch = supabase().channel(`day-${iso}`)
    .on("postgres_changes", { event: "*", schema: "public", table: "day_items", filter: `date=eq.${iso}` }, onChange).subscribe();
  return () => { supabase().removeChannel(ch); };
}
export async function loadStarsTotal(): Promise<number> {
  const sb = supabase();
  const { data } = await sb.from("day_items").select("activity_id, block_id, activities(stars), fixed_blocks(stars)").not("done_at", "is", null);
  type Row = { activities: { stars: number } | null; fixed_blocks: { stars: number } | null };
  return ((data || []) as unknown as Row[]).reduce((n, r) => n + (r.activities?.stars ?? r.fixed_blocks?.stars ?? 0), 0);
}

// Parent side
export async function saveActivity(a: Partial<Activity> & { name_en: string; name_ar: string; icon: string; category: Category }) {
  const { data, error } = await supabase().from("activities").upsert(a).select().single();
  return error ? null : (data as Activity);
}
export async function deleteActivity(id: string) { await supabase().from("activities").delete().eq("id", id); }
export async function saveBlock(b: Partial<FixedBlock> & { name_en: string; name_ar: string; icon: string; category: Category; start_time: string; minutes: number }) {
  const { data, error } = await supabase().from("fixed_blocks").upsert(b).select().single();
  return error ? null : ({ ...(data as FixedBlock), start_time: (data as FixedBlock).start_time.slice(0, 5) });
}
export async function deleteBlock(id: string) { await supabase().from("fixed_blocks").delete().eq("id", id); }
export async function setSkip(blockId: string, iso: string, skip: boolean) {
  const sb = supabase();
  if (skip) await sb.from("block_skips").upsert({ block_id: blockId, date: iso });
  else await sb.from("block_skips").delete().eq("block_id", blockId).eq("date", iso);
}
