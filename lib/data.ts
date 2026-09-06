"use client";
import { supabase } from "./supabase/client";
import type { Period, Issue } from "./placement";
import type { RealtimePostgresChangesPayload } from "@supabase/supabase-js";

export interface WeekRow {
  id: string; title: string | null; week_number: number | null; start_date: string; end_date: string; timetable_id: string | null;
  value_of_week: { arabic: string; english: string; source: string } | null;
  source_path: string; confidence: "green" | "orange" | "red"; issues: Issue[];
  dates_mentioned: { text: string; date: string | null; kind: string }[];
}
export interface Entry {
  id: string; day: number | null; slot: number | null; subject_key: string | null; plan_subject: string; specific_period: string | null;
  topic: string | null; lesson: string | null; pages: string | null; objectives: string | null; activity: string | null;
  links: string[]; homework: string | null; independent_practice: string | null; extra: string | null; raw_text: string;
  needs_parent: boolean; placed: boolean;
}
export interface Progress { week_id: string; day: number; slot: number; done_at: string | null; feeling: "easy" | "ok" | "hard" | null; packed_at?: string | null }
export type ProgressMap = Record<string, Progress>;
export const pkey = (day: number, slot: number) => `${day}-${slot}`;

export interface Timetable { id: string; name: string; valid_from: string; source_path: string | null; notes: string | null; class_name: string | null; issues: { en: string; ar: string }[] }
export async function loadLatestTimetable(): Promise<Timetable | null> {
  const { data } = await supabase().from("timetables").select("*").order("valid_from", { ascending: false }).order("created_at", { ascending: false }).limit(1).maybeSingle();
  return (data as Timetable | null) ?? null;
}
export async function loadPeriodsFor(timetableId: string): Promise<Period[]> {
  const { data } = await supabase().from("periods").select("day,slot,start_time,end_time,subject_key,teacher").eq("timetable_id", timetableId).order("day").order("slot");
  return (data || []) as Period[];
}
/** Periods for a week: the timetable it was placed with, else the latest one. */
export async function loadPeriods(timetableId?: string | null): Promise<Period[]> {
  const id = timetableId ?? (await loadLatestTimetable())?.id;
  return id ? loadPeriodsFor(id) : [];
}
export async function updatePeriod(timetableId: string, day: number, slot: number, patch: { subject_key?: string; teacher?: string | null }) {
  const { error } = await supabase().from("periods").update(patch).eq("timetable_id", timetableId).eq("day", day).eq("slot", slot);
  return !error;
}
export interface ProgressWithWeek extends Progress { weeks: { start_date: string; timetable_id: string | null } | null }
export async function loadAllProgress(): Promise<ProgressWithWeek[]> {
  const { data } = await supabase().from("progress").select("*, weeks(start_date, timetable_id)").not("done_at", "is", null);
  return (data || []) as ProgressWithWeek[];
}
export async function loadAllPeriodCounts(): Promise<Record<string, number>> {
  const { data } = await supabase().from("periods").select("timetable_id, day");
  const counts: Record<string, number> = {};
  for (const r of (data || []) as { timetable_id: string; day: number }[]) counts[`${r.timetable_id}-${r.day}`] = (counts[`${r.timetable_id}-${r.day}`] ?? 0) + 1;
  return counts;
}
export async function loadWeekFor(dateISO: string): Promise<WeekRow | null> {
  const { data } = await supabase().from("weeks").select("*").lte("start_date", dateISO).gte("end_date", dateISO).maybeSingle();
  return (data as WeekRow | null) ?? null;
}
export async function loadEntries(weekId: string): Promise<Entry[]> {
  const { data } = await supabase().from("entries").select("*").eq("week_id", weekId).order("day").order("slot");
  return (data || []) as Entry[];
}
export async function loadProgress(weekId: string): Promise<ProgressMap> {
  const { data } = await supabase().from("progress").select("*").eq("week_id", weekId);
  const map: ProgressMap = {};
  for (const p of (data || []) as Progress[]) map[pkey(p.day, p.slot)] = p;
  return map;
}
export function subscribeProgress(weekId: string, onChange: (p: Progress) => void) {
  const ch = supabase()
    .channel(`progress-${weekId}`)
    .on("postgres_changes", { event: "*", schema: "public", table: "progress", filter: `week_id=eq.${weekId}` }, (payload: RealtimePostgresChangesPayload<Progress>) => {
      const row = (payload.new && Object.keys(payload.new).length ? payload.new : payload.old) as Progress;
      if (row && row.week_id) onChange(payload.eventType === "DELETE" ? { ...row, done_at: null, feeling: null } : row);
    })
    .subscribe();
  return () => { supabase().removeChannel(ch); };
}
export async function setProgress(weekId: string, day: number, slot: number, done: boolean, feeling: Progress["feeling"] = null) {
  const row: Progress = { week_id: weekId, day, slot, done_at: done ? new Date().toISOString() : null, feeling: done ? feeling : null, packed_at: null };
  await supabase().from("progress").upsert({ ...row, updated_at: new Date().toISOString() });
  return row;
}
/** The book for a finished lesson went into (or came out of) the bag. */
export async function setPacked(weekId: string, day: number, slot: number, packed: boolean) {
  const packed_at = packed ? new Date().toISOString() : null;
  await supabase().from("progress").update({ packed_at, updated_at: new Date().toISOString() }).eq("week_id", weekId).eq("day", day).eq("slot", slot);
  return packed_at;
}
export async function loadSettings(): Promise<Record<string, string>> {
  const { data } = await supabase().from("settings").select("key,value");
  return Object.fromEntries(((data || []) as { key: string; value: string }[]).map((r) => [r.key, r.value]));
}
export async function saveSetting(key: string, value: string) {
  await supabase().from("settings").upsert({ key, value });
}
export async function signedUrl(path: string) {
  const { data } = await supabase().storage.from("documents").createSignedUrl(path, 3600);
  return data?.signedUrl ?? null;
}

/** One card per period of the day, with the plan entry that landed on it (if any). */
export function buildDay(periods: Period[], entries: Entry[], day: number) {
  const slots = periods.filter((p) => p.day === day).map((p) => ({
    period: p,
    entry: entries.find((e) => e.placed && e.day === day && e.slot === p.slot) ?? null,
  }));
  const unmatched = entries.filter((e) => !e.placed && e.day === day);
  return { slots, unmatched };
}
export function homeworkCount(slots: { entry: Entry | null }[], unmatched: Entry[]) {
  const set = new Set<string>();
  for (const s of slots) if (s.entry?.homework) set.add(s.entry.homework.trim());
  for (const e of unmatched) if (e.homework) set.add(e.homework.trim());
  return set.size;
}

export interface UploadJob { id: string; status: "saving" | "timetable" | "plan" | "done" | "failed"; source: "manual" | "refresh" | "auto"; week_number: number | null; seen_at: string | null; message: string | null; problems: string[]; plan_path: string | null; timetable_path: string | null; week_id: string | null; created_at: string; updated_at: string }
export async function markUploadSeen(id: string) { await supabase().from("uploads").update({ seen_at: new Date().toISOString() }).eq("id", id); }
export interface LastCheck { at: string; source: "refresh" | "auto"; found?: number | null; missing?: number[]; error?: string }
export async function loadTimetableById(id: string): Promise<Timetable | null> {
  const { data } = await supabase().from("timetables").select("*").eq("id", id).maybeSingle();
  return (data as Timetable | null) ?? null;
}
export async function loadUploads(limit = 30): Promise<UploadJob[]> {
  const { data } = await supabase().from("uploads").select("*").order("created_at", { ascending: false }).limit(limit);
  return (data || []) as UploadJob[];
}
export async function loadLatestUpload(): Promise<UploadJob | null> {
  const { data } = await supabase().from("uploads").select("*").order("created_at", { ascending: false }).limit(1).maybeSingle();
  return (data as UploadJob | null) ?? null;
}
export function subscribeUploads(onChange: (u: UploadJob) => void) {
  const ch = supabase().channel("uploads").on("postgres_changes", { event: "*", schema: "public", table: "uploads" }, (payload: RealtimePostgresChangesPayload<UploadJob>) => {
    if (payload.new && "id" in payload.new) onChange(payload.new as UploadJob);
  }).subscribe();
  return () => { supabase().removeChannel(ch); };
}
export interface WeekSummary extends WeekRow { created_at: string }
export async function loadWeeks(): Promise<WeekSummary[]> {
  const { data } = await supabase().from("weeks").select("*").order("start_date", { ascending: false });
  return (data || []) as WeekSummary[];
}
export async function loadWeekByStart(start: string): Promise<WeekRow | null> {
  const { data } = await supabase().from("weeks").select("*").eq("start_date", start).maybeSingle();
  return (data as WeekRow | null) ?? null;
}
