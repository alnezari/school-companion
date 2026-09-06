// Server only. "Go and look": list the school's two folders, and if a newer week is there, read it.
import type { SupabaseClient } from "@supabase/supabase-js";
import { listFolder, downloadFile, folderIdFrom, type DriveFile } from "@/lib/drive";
import { ReadError, storeFile, readTimetable, readPlan } from "@/lib/readers";
import { sendToAll } from "@/lib/push-send";

export type FetchResult = { checked: string; found: number | null; weekId?: string; error?: string; skipped?: string };

/**
 * One run, at most one new week, so it always fits inside the function's time limit.
 * "New" means a week number above the highest week already stored; anything older is left alone (the parent can upload it by hand).
 */
export async function runFetch(sb: SupabaseClient, source: "refresh" | "auto"): Promise<FetchResult> {
  const checked = new Date().toISOString();
  const { data: rows } = await sb.from("settings").select("key,value").in("key", ["school_plan_folder", "school_timetable_folder", "school_class", "notif_week_ready"]);
  const s = Object.fromEntries(((rows || []) as { key: string; value: string }[]).map((r) => [r.key, r.value]));
  const planFolder = folderIdFrom(s.school_plan_folder || ""), ttFolder = folderIdFrom(s.school_timetable_folder || "");
  if (!planFolder) return { checked, found: null, skipped: "no_folders" };

  const note = (v: Record<string, unknown>) => sb.from("settings").upsert({ key: "school_last_check", value: JSON.stringify({ at: checked, source, ...v }) });
  let plans: DriveFile[], tts: DriveFile[];
  try {
    [plans, tts] = await Promise.all([listFolder(planFolder), ttFolder ? listFolder(ttFolder) : Promise.resolve([])]);
  } catch (e) {
    const error = e instanceof Error ? e.message : String(e);
    await note({ error });
    return { checked, found: null, error };
  }

  const { data: have } = await sb.from("weeks").select("week_number");
  const maxWeek = Math.max(0, ...((have || []) as { week_number: number | null }[]).map((w) => w.week_number ?? 0));
  const fresh = plans.filter((f) => f.week != null && f.week > maxWeek).sort((a, b) => a.week! - b.week!);
  // a week that just failed is not retried by the nightly check for a day (the refresh button always tries)
  let next = fresh[0];
  if (next && source === "auto") {
    const { data: failed } = await sb.from("uploads").select("id").eq("status", "failed").eq("week_number", next.week!).gte("created_at", new Date(Date.now() - 20 * 3600e3).toISOString()).limit(1);
    if (failed && failed.length) next = undefined as unknown as DriveFile;
  }
  if (!next) { await note({ found: null, maxWeek }); return { checked, found: null }; }

  const tt = tts.find((f) => f.week === next.week) ?? null;
  const { data: job } = await sb.from("uploads").insert({ status: "saving", source, week_number: next.week }).select("id").single();
  const step = (patch: Record<string, unknown>) => job ? sb.from("uploads").update({ ...patch, updated_at: new Date().toISOString() }).eq("id", job.id) : Promise.resolve();
  try {
    const [planFile, ttFile] = await Promise.all([downloadFile(next), tt ? downloadFile(tt) : Promise.resolve(null)]);
    const stem = checked.slice(0, 10);
    const p = await storeFile(sb, planFile, "plans", `${stem}-week${next.week}`);
    const t = ttFile ? await storeFile(sb, ttFile, "timetables", `${stem}-week${next.week}`) : null;
    await step({ plan_path: p.storagePath, timetable_path: t?.storagePath ?? null, status: t ? "timetable" : "plan" });
    const ttResult = t ? await readTimetable(sb, t.doc, t.storagePath, stem, s.school_class || null) : null;
    if (t) await step({ status: "plan" });
    const week = await readPlan(sb, p.doc, p.storagePath);
    const problems = [...(ttResult?.issues ?? []), ...week.issues].map((i) => i.en);
    await step({ status: "done", week_id: week.weekId, message: week.what_i_saw, problems });
    await note({ found: next.week, weekId: week.weekId });
    if (source === "auto" && s.notif_week_ready !== "false") {
      const { data: subs } = await sb.from("push_subscriptions").select("endpoint,p256dh,auth");
      if (subs && subs.length) {
        const dead = await sendToAll(subs, { title: `📚 Week ${next.week} is ready`, body: "The new weekly plan and timetable were fetched from the school folder.", url: "/parent/school", tag: `week-ready-${next.week}` });
        if (dead.length) await sb.from("push_subscriptions").delete().in("endpoint", dead);
      }
    }
    return { checked, found: next.week, weekId: week.weekId };
  } catch (e) {
    const err = e instanceof ReadError ? e : new ReadError("failed", e instanceof Error ? e.message : String(e), [], 500);
    await step({ status: "failed", message: err.message, problems: err.problems });
    await note({ found: next.week, error: err.message });
    return { checked, found: next.week, error: err.message };
  }
}
