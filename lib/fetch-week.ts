// Server only. "Go and look": list the school's two folders and read the earliest week that is still missing.
import type { SupabaseClient } from "@supabase/supabase-js";
import { listFolder, downloadFile, folderIdFrom, type DriveFile } from "@/lib/drive";
import { ReadError, storeFile, readTimetable, readPlan, timetableFor } from "@/lib/readers";
import { sendToAll } from "@/lib/push-send";
import { addDays, todayISO } from "@/lib/schedule";
import { weekNumberFor, weekStartOf } from "@/lib/weeks";

export type FetchResult = { checked: string; found: number | null; missing: number[]; weekId?: string; error?: string; skipped?: string };

/**
 * One run reads at most one week, so it always fits inside the function's time limit.
 * A week is "missing" when its number (from the first week's start date up to the week tomorrow belongs to) has no stored row.
 * The nightly check leaves a week alone for a day after a failed reading; the refresh button always tries.
 */
export async function runFetch(sb: SupabaseClient, source: "refresh" | "auto"): Promise<FetchResult> {
  const checked = new Date().toISOString();
  const { data: rows } = await sb.from("settings").select("key,value").in("key", ["school_plan_folder", "school_timetable_folder", "school_class", "school_week1_start", "notif_week_ready"]);
  const s = Object.fromEntries(((rows || []) as { key: string; value: string }[]).map((r) => [r.key, r.value]));
  const planFolder = folderIdFrom(s.school_plan_folder || ""), ttFolder = folderIdFrom(s.school_timetable_folder || "");
  const week1 = /^\d{4}-\d{2}-\d{2}$/.test(s.school_week1_start || "") ? s.school_week1_start : null;
  if (!planFolder || !week1) return { checked, found: null, missing: [], skipped: "no_setup" };
  const note = (v: Record<string, unknown>) => sb.from("settings").upsert({ key: "school_last_check", value: JSON.stringify({ at: checked, source, ...v }) });

  const upto = weekNumberFor(addDays(todayISO(), 1), week1) ?? 0;
  const { data: have } = await sb.from("weeks").select("week_number");
  const stored = new Set(((have || []) as { week_number: number | null }[]).map((w) => w.week_number));
  const missing = Array.from({ length: upto }, (_, i) => i + 1).filter((n) => !stored.has(n));
  if (missing.length === 0) { await note({ found: null, missing }); return { checked, found: null, missing }; }

  let plans: DriveFile[], tts: DriveFile[];
  try {
    [plans, tts] = await Promise.all([listFolder(planFolder), ttFolder ? listFolder(ttFolder) : Promise.resolve([])]);
  } catch (e) {
    const error = e instanceof Error ? e.message : String(e);
    await note({ error, missing });
    return { checked, found: null, missing, error };
  }
  let target: number | undefined;
  for (const n of missing) {
    if (!plans.some((f) => f.week === n)) continue;
    if (source === "auto") {
      const { data: failed } = await sb.from("uploads").select("id").eq("status", "failed").eq("week_number", n).gte("created_at", new Date(Date.now() - 20 * 3600e3).toISOString()).limit(1);
      if (failed && failed.length) continue;
    }
    target = n; break;
  }
  if (!target) { await note({ found: null, missing }); return { checked, found: null, missing }; }

  const plan = plans.find((f) => f.week === target)!;
  const tt = tts.find((f) => f.week === target) ?? null;
  const weekStart = weekStartOf(target, week1);
  const { data: job } = await sb.from("uploads").insert({ status: "saving", source, week_number: target }).select("id").single();
  const step = (patch: Record<string, unknown>) => job ? sb.from("uploads").update({ ...patch, updated_at: new Date().toISOString() }).eq("id", job.id) : Promise.resolve();
  try {
    const [planFile, ttFile] = await Promise.all([downloadFile(plan), tt ? downloadFile(tt) : Promise.resolve(null)]);
    const p = await storeFile(sb, planFile, "plans", `week${target}`);
    const t = ttFile ? await storeFile(sb, ttFile, "timetables", `week${target}`) : null;
    await step({ plan_path: p.storagePath, timetable_path: t?.storagePath ?? null, status: t ? "timetable" : "plan" });

    // the same timetable file again costs no reading: reuse the stored one
    let timetableId: string | null = null, ttIssues: { en: string }[] = [];
    if (t) {
      const { data: same } = await sb.from("timetables").select("id").eq("file_hash", t.hash).limit(1).maybeSingle();
      if (same) timetableId = same.id as string;
      else { const r = await readTimetable(sb, t.doc, t.storagePath, weekStart, s.school_class || null, t.hash); timetableId = r.timetableId; ttIssues = r.issues; }
      await step({ status: "plan" });
    }
    const week = await readPlan(sb, p.doc, p.storagePath, timetableId ?? await timetableFor(sb, weekStart));
    const problems = [...ttIssues, ...week.issues].map((i) => i.en);
    if (week.start !== weekStart) problems.unshift(`The plan says the week starts on ${week.start}; the term calendar expected ${weekStart}.`);
    await step({ status: "done", week_id: week.weekId, message: week.what_i_saw, problems });
    await note({ found: target, weekId: week.weekId, missing: missing.filter((n) => n !== target) });
    if (source === "auto" && s.notif_week_ready !== "false") {
      const { data: subs } = await sb.from("push_subscriptions").select("endpoint,p256dh,auth");
      if (subs && subs.length) {
        const dead = await sendToAll(subs, { title: `📚 Week ${target} is ready`, body: "The new weekly plan and timetable were fetched from the school folder.", url: "/parent/school", tag: `week-ready-${target}` });
        if (dead.length) await sb.from("push_subscriptions").delete().in("endpoint", dead);
      }
    }
    return { checked, found: target, missing: missing.filter((n) => n !== target), weekId: week.weekId };
  } catch (e) {
    const err = e instanceof ReadError ? e : new ReadError("failed", e instanceof Error ? e.message : String(e), [], 500);
    await step({ status: "failed", message: err.message, problems: err.problems });
    await note({ found: target, error: err.message, missing });
    return { checked, found: target, missing, error: err.message };
  }
}
