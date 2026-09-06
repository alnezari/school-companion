"use client";
import { useEffect, useState } from "react";
import type { Dict } from "@/lib/i18n";
import { loadLatestUpload, loadWeeks, markUploadSeen, subscribeUploads, type LastCheck, type UploadJob } from "@/lib/data";
import { addDays, formatDate, todayISO } from "@/lib/schedule";
import { weekNumberFor } from "@/lib/weeks";

const STALE_MS = 6 * 60 * 1000;   // a run older than this with no news was cut off by the server limit
const SHOW_MS = 30 * 60 * 1000;   // a finished run stays on screen this long, unless dismissed
export const running = (j: UploadJob | null) => !!j && j.status !== "done" && j.status !== "failed";
export const fmtWhen = (iso: string, lang: "en" | "ar") => new Date(iso).toLocaleString(lang === "ar" ? "ar-SA" : "en-GB", { weekday: "short", hour: "2-digit", minute: "2-digit" });

/**
 * The one place documents come in (Settings → School): a "Fetch week N" button for the earliest missing week,
 * the last check's outcome, the running job step by step, and a by-hand upload for anything else.
 */
export function SchoolFetch({ d, lang, settings, onChanged }: { d: Dict; lang: "en" | "ar"; settings: Record<string, string>; onChanged?: () => void }) {
  const [stored, setStored] = useState<Set<number> | null>(null);
  const [job, setJob] = useState<UploadJob | null>(null);
  const [dismissed, setDismissed] = useState<string | null>(null);
  const [lastCheck, setLastCheck] = useState<LastCheck | null>(null);
  const [checking, setChecking] = useState(false);
  const [sheet, setSheet] = useState(false);
  const [planFile, setPlanFile] = useState<File | null>(null);
  const [ttFile, setTtFile] = useState<File | null>(null);

  const week1 = settings.school_week1_start, ready = !!settings.school_plan_folder && !!week1;
  const upto = week1 ? weekNumberFor(addDays(todayISO(), 1), week1) ?? 0 : 0;
  const missing = stored ? Array.from({ length: upto }, (_, i) => i + 1).filter((n) => !stored.has(n)) : [];
  const next = missing[0];

  const refresh = () => loadWeeks().then((ws) => { setStored(new Set(ws.map((w) => w.week_number).filter((n): n is number => n != null))); onChanged?.(); });
  useEffect(() => {
    refresh();
    loadLatestUpload().then(setJob);
    try { setLastCheck(settings.school_last_check ? JSON.parse(settings.school_last_check) : null); } catch { setLastCheck(null); }
    return subscribeUploads((u) => { setJob(u); if (u.status === "done") refresh(); });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [settings.school_last_check]);

  async function fetchNow() {
    setChecking(true); setDismissed(null);
    try {
      const res = await fetch("/api/fetch-week", { method: "POST" });
      const r = (await res.json()) as { checked?: string; found?: number | null; missing?: number[]; error?: string; message?: string };
      setLastCheck({ at: r.checked ?? new Date().toISOString(), source: "refresh", found: r.found ?? null, missing: r.missing, error: r.error ?? r.message });
    } catch (e) { setLastCheck({ at: new Date().toISOString(), source: "refresh", error: e instanceof Error ? e.message : String(e) }); }
    await refresh(); setChecking(false);
  }
  async function upload() {
    if (!planFile) return;
    const fd = new FormData(); fd.append("plan", planFile); if (ttFile) fd.append("timetable", ttFile);
    setSheet(false); setPlanFile(null); setTtFile(null); setDismissed(null);
    const now = new Date().toISOString();
    setJob({ id: "local", status: "saving", source: "manual", week_number: null, seen_at: null, message: null, problems: [], plan_path: null, timetable_path: ttFile ? "pending" : null, week_id: null, created_at: now, updated_at: now });
    try {
      const res = await fetch("/api/upload-week", { method: "POST", body: fd });
      const json = await res.json();
      if (json.ok) refresh();
      else setJob((j) => j && j.status !== "done" ? { ...j, status: "failed", message: json.message ?? json.error, problems: json.problems ?? [] } : j);
    } catch (e) { setJob((j) => j && running(j) ? { ...j, message: e instanceof Error ? e.message : String(e) } : j); }
  }

  const age = job ? Date.now() - new Date(job.updated_at).getTime() : Infinity;
  const stale = running(job) && age > STALE_MS;
  const busy = checking || (running(job) && !stale);
  const showJob = !!job && job.id !== dismissed && (running(job) || age < SHOW_MS);
  const statement = !lastCheck ? null
    : lastCheck.error ? lastCheck.error
    : lastCheck.found ? `${d.parentTitle} ${lastCheck.found} ${d.weekReady}`
    : missing.length ? `${d.parentTitle} ${missing[0]} ${d.notInFolder}` : d.allFetched;

  return (
    <div className="mt-4 border-t border-line pt-4">
      <div className="grid grid-cols-[1fr_auto] gap-2">
        <button type="button" onClick={fetchNow} disabled={busy || !ready || !next}
          className="flex items-center justify-center gap-2 rounded-xl bg-accent py-3 font-display text-base font-extrabold text-white disabled:opacity-40">
          {checking ? <span className="h-4 w-4 animate-spin rounded-full border-[3px] border-white/40 border-t-white" /> : "🔄"}
          {checking ? d.checking : next ? `${d.fetchWeek} ${next}` : d.allFetched}
        </button>
        <button type="button" onClick={() => setSheet(true)} disabled={busy} className="rounded-xl border border-line px-3 text-sm font-semibold disabled:opacity-40">⬆ {d.uploadByHand}</button>
      </div>
      {!ready && <p className="mt-2 text-xs text-ink-2">{d.noFolders}</p>}
      {statement && !checking && <p dir="auto" className={`mt-2 text-xs ${lastCheck?.error ? "text-red" : "text-ink-2"}`}>{d.lastChecked} {fmtWhen(lastCheck!.at, lang)} · {statement}</p>}

      {showJob && job && (
        <section className={`mt-3 rounded-xl border-s-4 bg-paper p-3 text-sm ${job.status === "done" ? "border-green" : job.status === "failed" || stale ? "border-red" : "border-accent"}`}>
          <div className="flex items-center gap-3">
            {running(job) && !stale ? <span className="h-5 w-5 shrink-0 animate-spin rounded-full border-[3px] border-line border-t-accent" /> : <span>{job.status === "done" ? "✅" : "⛔"}</span>}
            <b className="flex-1">{job.week_number ? `${d.parentTitle} ${job.week_number} · ` : ""}{job.status === "done" ? d.uploadDone : job.status === "failed" ? d.uploadFail : stale ? d.uploadTimedOut : job.status === "saving" ? d.stepSaving : job.status === "timetable" ? d.stepTimetable : d.stepPlan}</b>
            {(!running(job) || stale) && <button type="button" onClick={() => { setDismissed(job.id); if (job.id !== "local") markUploadSeen(job.id); }} className="text-ink-2">✕</button>}
          </div>
          {running(job) && !stale && (
            <ol className="mt-2 grid gap-1">
              {([["saving", d.stepSaving], ["timetable", d.stepTimetable], ["plan", d.stepPlan]] as const).map(([st, label]) => {
                const order = ["saving", "timetable", "plan"], cur = order.indexOf(job.status), me = order.indexOf(st);
                const skipped = st === "timetable" && !job.timetable_path;
                return (
                  <li key={st} className={`flex items-center gap-2 ${me > cur || skipped ? "text-ink-2/60" : ""}`}>
                    <span className={`grid h-5 w-5 place-items-center rounded-full text-[11px] ${skipped ? "bg-line" : me < cur ? "bg-green text-white" : me === cur ? "animate-pulse bg-accent text-white" : "border border-line"}`}>{skipped ? "–" : me < cur ? "✓" : ""}</span>
                    {label}
                  </li>
                );
              })}
            </ol>
          )}
          {running(job) && !stale && <p className="mt-2 text-xs text-ink-2">{d.uploadKeeps}</p>}
          {job.message && !running(job) && <p dir="auto" className={`mt-2 ${job.status === "done" ? "text-ink-2" : "text-red"}`}>{job.message}</p>}
          {job.problems.length > 0 && !running(job) && <ul className="mt-1 list-disc ps-5 text-xs">{job.problems.map((p, i) => <li key={i} dir="auto">{p}</li>)}</ul>}
        </section>
      )}

      {sheet && (
        <div className="fixed inset-0 z-40 flex items-end justify-center bg-black/40 p-3 sm:items-center" onClick={() => setSheet(false)}>
          <div onClick={(e) => e.stopPropagation()} className="w-full max-w-md rounded-3xl bg-white p-5 shadow-2xl">
            <h2 className="font-display text-lg font-extrabold">⬆ {d.uploadBoth}</h2>
            <div className="mt-4 grid grid-cols-2 gap-3">
              <FileSlot icon="📄" label={d.planDoc} file={planFile} onFile={setPlanFile} d={d} />
              <FileSlot icon="🗓" label={d.ttDoc} sub={d.ttOptional} file={ttFile} onFile={setTtFile} d={d} />
            </div>
            <div className="mt-4 flex gap-2">
              <button type="button" onClick={() => setSheet(false)} className="flex-1 rounded-xl border border-line py-3 font-semibold">{d.close}</button>
              <button type="button" onClick={upload} disabled={!planFile} className="flex-[2] rounded-xl bg-accent py-3 font-semibold text-white disabled:opacity-50">{d.uploadShort}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function FileSlot({ icon, label, sub, file, onFile, d }: { icon: string; label: string; sub?: string; file: File | null; onFile: (f: File | null) => void; d: Dict }) {
  return (
    <label className={`flex cursor-pointer flex-col items-center rounded-2xl border-2 p-4 text-center ${file ? "border-green bg-green-soft" : "border-dashed border-line"}`}>
      <span className="text-3xl">{icon}</span>
      <b className="mt-1 text-sm">{label}</b>
      {sub && !file && <span className="text-xs text-ink-2">{sub}</span>}
      <span className={`mt-2 w-full truncate text-xs ${file ? "font-semibold text-green" : "text-accent underline"}`}>{file ? file.name : d.chooseFile}</span>
      <input type="file" accept="application/pdf,image/jpeg,image/png,image/webp" className="hidden" onChange={(e) => onFile(e.target.files?.[0] ?? null)} />
    </label>
  );
}
