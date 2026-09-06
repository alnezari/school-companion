"use client";
import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useLang } from "@/lib/lang";
import { t, DAY_SHORT, DAY_NAMES, type Dict } from "@/lib/i18n";
import { todayISO, schoolDay, weekStartFor, addDays, formatDate } from "@/lib/schedule";
import { buildDay, homeworkCount, loadEntries, loadLatestUpload, loadPeriods, loadSettings, loadTimetableById, loadWeekByStart, markUploadSeen, signedUrl, subscribeUploads, type Entry, type LastCheck, type UploadJob, type WeekRow } from "@/lib/data";
import { ParentNav } from "@/components/ParentNav";
import type { Period } from "@/lib/placement";
import { SUBJECTS, PLAN_SUBJECT_LABEL, subjectName, type SubjectKey, type PlanSubject } from "@/lib/subjects";
import { isParentUnlocked } from "@/components/ParentGate";

const STALE_MS = 6 * 60 * 1000;   // a run older than this with no news was cut off by the server limit
const SHOW_MS = 30 * 60 * 1000;   // a finished run stays on screen this long, unless dismissed
const running = (j: UploadJob | null) => !!j && j.status !== "done" && j.status !== "failed";

export default function ParentPage() {
  const router = useRouter();
  const [lang] = useLang("parent");
  const d = t(lang);
  const [today, setToday] = useState<string | null>(null);
  const [weekStart, setWeekStart] = useState<string | null>(null);
  useEffect(() => {
    const t0 = todayISO(); setToday(t0);
    const q = new URLSearchParams(window.location.search).get("week");
    setWeekStart(q && /^\d{4}-\d{2}-\d{2}$/.test(q) ? q : weekStartFor(t0));
  }, []);
  const currentStart = today ? weekStartFor(today) : null;
  const isCurrent = !!weekStart && weekStart === currentStart;
  const todayIdx = today && isCurrent ? schoolDay(today) : null;
  const [day, setDay] = useState<number>(0);
  useEffect(() => { if (todayIdx != null) setDay(todayIdx); }, [todayIdx]);
  const [periods, setPeriods] = useState<Period[]>([]);
  const [week, setWeek] = useState<WeekRow | null>(null);
  const [entries, setEntries] = useState<Entry[]>([]);
  const [loading, setLoading] = useState(true);
  const [openKey, setOpenKey] = useState<string | null>(null);
  const [showIssues, setShowIssues] = useState(false);
  const [planUrl, setPlanUrl] = useState<string | null>(null);
  const [ttUrl, setTtUrl] = useState<string | null>(null);
  // the one upload flow: a sheet with two slots, then a job card that follows the server step by step
  const [sheet, setSheet] = useState(false);
  const [planFile, setPlanFile] = useState<File | null>(null);
  const [ttFile, setTtFile] = useState<File | null>(null);
  const [job, setJob] = useState<UploadJob | null>(null);
  const [dismissed, setDismissed] = useState<string | null>(null);
  const [folders, setFolders] = useState(false);
  const [lastCheck, setLastCheck] = useState<LastCheck | null>(null);
  const [checking, setChecking] = useState(false);

  useEffect(() => { if (!isParentUnlocked()) router.replace("/"); }, [router]);
  const load = useCallback(async () => {
    if (!weekStart) return;
    const [w, s] = await Promise.all([loadWeekByStart(weekStart), loadSettings()]);
    setFolders(!!s.school_plan_folder);
    try { setLastCheck(s.school_last_check ? JSON.parse(s.school_last_check) : null); } catch { setLastCheck(null); }
    // this week's own documents: the plan it was read from and the timetable it was placed on
    const [p, tt] = await Promise.all([loadPeriods(w?.timetable_id), w?.timetable_id ? loadTimetableById(w.timetable_id) : Promise.resolve(null)]);
    setPeriods(p); setWeek(w);
    setTtUrl(tt?.source_path ? await signedUrl(tt.source_path) : null);
    if (w) { const [e, url] = await Promise.all([loadEntries(w.id), signedUrl(w.source_path)]); setEntries(e); setPlanUrl(url); }
    else { setEntries([]); setPlanUrl(null); }
    setLoading(false);
  }, [weekStart]);
  useEffect(() => { load(); }, [load]);
  useEffect(() => {
    loadLatestUpload().then(setJob);
    return subscribeUploads((u) => { setJob(u); if (u.status === "done") load(); });
  }, [load]);

  const { slots, unmatched } = useMemo(() => buildDay(periods, entries, day), [periods, entries, day]);
  const weekOther = useMemo(() => entries.filter((e) => !e.placed && e.day == null), [entries]);
  const hw = homeworkCount(slots, unmatched);
  const dateISO = weekStart ? addDays(weekStart, day) : null;

  async function upload() {
    if (!planFile) return;
    const fd = new FormData();
    fd.append("plan", planFile);
    if (ttFile) fd.append("timetable", ttFile);
    setSheet(false); setPlanFile(null); setTtFile(null); setDismissed(null);
    const now = new Date().toISOString();
    setJob({ id: "local", status: "saving", source: "manual", week_number: null, seen_at: null, message: null, problems: [], plan_path: null, timetable_path: ttFile ? "pending" : null, week_id: null, created_at: now, updated_at: now });
    try {
      const res = await fetch("/api/upload-week", { method: "POST", body: fd });
      const json = await res.json();
      if (json.ok) load();
      else setJob((j) => j && j.status !== "done" ? { ...j, status: "failed", message: json.message ?? json.error, problems: json.problems ?? [] } : j);
    } catch (e) {
      // the request itself broke (phone slept, network dropped): the server may still finish, and the realtime row will say so
      setJob((j) => j && running(j) ? { ...j, message: e instanceof Error ? e.message : String(e) } : j);
    }
  }
  /** The refresh button: the server looks in the school folders and reads a new week if there is one. */
  async function check() {
    setChecking(true); setDismissed(null);
    try {
      const res = await fetch("/api/fetch-week", { method: "POST" });
      const r = (await res.json()) as { checked?: string; found?: number | null; error?: string; skipped?: string; message?: string };
      setLastCheck({ at: r.checked ?? new Date().toISOString(), source: "refresh", found: r.found ?? null, error: r.error ?? r.message });
      load();
    } catch (e) { setLastCheck({ at: new Date().toISOString(), source: "refresh", error: e instanceof Error ? e.message : String(e) }); }
    setChecking(false);
  }
  const age = job ? Date.now() - new Date(job.updated_at).getTime() : Infinity;
  const stale = running(job) && age > STALE_MS;
  const showJob = !!job && job.id !== dismissed && (running(job) || (age < SHOW_MS && !(job.source === "auto" && job.status === "done")));

  const toggle = (k: string) => setOpenKey((o) => (o === k ? null : k));
  const rowCls = "grid w-full grid-cols-[24px_64px_1fr_auto] items-center gap-2 px-3 py-2 text-start tabular-nums";
  const HW = ({ on }: { on: boolean }) => on ? <span className="rounded-full bg-red-soft px-2 py-0.5 text-[11px] font-bold text-red">{d.hwShort}</span> : <span />;

  return (
    <main className="min-h-dvh px-3 pb-10 pt-3 sm:px-6">
      <header className="mx-auto flex max-w-3xl flex-wrap items-center gap-2">
        <h1 className="font-display text-xl font-extrabold">{d.parentTitle} {week?.week_number ?? ""} {weekStart && <span className="text-base font-normal text-ink-2">· {formatDate(weekStart, lang)} – {formatDate(addDays(weekStart, 4), lang)}</span>}</h1>
        <div className="ms-auto"><Link href="/parent" className="rounded-full border border-line bg-white px-3 py-1.5 text-sm font-semibold">🏠</Link></div>
      </header>

      <div className="mx-auto mt-3 max-w-3xl">
        <ParentNav active="week" d={d} />
        {job && job.source === "auto" && job.status === "done" && !job.seen_at && job.id !== dismissed && (
          <div className="mt-3 flex items-center gap-2 rounded-2xl border-s-4 border-green bg-green-soft px-3 py-2 text-sm">
            <span className="flex-1">✨ <b>{d.parentTitle} {job.week_number ?? ""} {d.weekReady}</b> · {d.fetchedAuto} {formatDate(job.updated_at.slice(0, 10), lang)}</span>
            {job.week_id && week?.id !== job.week_id && <Link href="/parent/school" className="rounded-lg bg-white px-3 py-1 font-semibold">{d.open}</Link>}
            <button onClick={() => { setDismissed(job.id); markUploadSeen(job.id); }} className="px-1 text-ink-2">✕</button>
          </div>
        )}
        {weekStart && currentStart && !isCurrent && (
          <div className="mt-3 flex items-center justify-between gap-2 rounded-2xl border-s-4 border-orange bg-orange-soft px-3 py-2 text-sm">
            <span>⏪ {weekStart < currentStart ? d.oldWeek : d.futureWeek}</span>
            <Link href="/parent/school" className="rounded-lg bg-white px-3 py-1 font-semibold">{d.backToCurrent}</Link>
          </div>
        )}
        <div className="mt-3 grid grid-cols-5 gap-1">
          {DAY_SHORT[lang].map((n, i) => (
            <button key={i} onClick={() => { setDay(i); setOpenKey(null); }}
              className={`rounded-lg border py-1 text-xs font-semibold ${i === day ? "border-accent bg-accent text-white" : "border-line bg-white"} ${i === todayIdx && i !== day ? "border-orange" : ""}`}>
              {n}{i === todayIdx && <span className="ms-1 text-orange">•</span>}
            </button>
          ))}
        </div>

        {loading || !weekStart ? <p className="mt-6 text-center text-ink-2">…</p> : !week ? (
          <p className="mt-4 rounded-2xl bg-white p-6 text-center text-ink-2">{d.noWeek}</p>
        ) : (
          <>
            <div className="mt-3 flex items-baseline justify-between">
              <b>{DAY_NAMES[lang][day]} {dateISO && formatDate(dateISO, lang)}</b>
              <span className="text-sm text-ink-2">{slots.length} {d.classesShort} · <b className="text-red">{hw} {d.hwShort}</b></span>
            </div>

            <div className="mt-2 grid gap-1.5">
              {slots.map(({ period, entry }) => {
                const meta = SUBJECTS[period.subject_key as SubjectKey];
                const k = `s-${period.slot}`;
                return (
                  <div key={k} className={`rounded-xl border bg-white ${openKey === k ? "border-accent" : "border-line"}`}>
                    <button onClick={() => toggle(k)} className={rowCls}>
                      <span className="font-bold text-ink-2">{period.slot}</span>
                      <span className="text-xs text-ink-2">{period.start_time.slice(0, 5)}–{period.end_time.slice(0, 5)}</span>
                      <span>
                        <span className="font-semibold" style={{ color: meta.color }} dir="auto">{meta.icon} {subjectName(period.subject_key)}</span>
                        <span className="block text-xs text-ink-2">{entry ? period.teacher ?? "" : d.empty}</span>
                      </span>
                      <HW on={!!entry?.homework} />
                    </button>
                    {openKey === k && <div className="border-t border-line px-3 py-3 text-sm">{entry ? <Parts entry={entry} d={d} /> : <p className="text-ink-2">{d.empty}</p>}</div>}
                  </div>
                );
              })}
              {/* Plan items that matched no period of this day stay on the day, highlighted, so nothing is lost. */}
              {unmatched.map((e) => <Unmatched key={e.id} e={e} d={d} lang={lang} open={openKey === `u-${e.id}`} onToggle={() => toggle(`u-${e.id}`)} rowCls={rowCls} />)}
            </div>

            {weekOther.length > 0 && (
              <>
                <div className="mt-4 text-xs font-bold uppercase tracking-wider text-ink-2">{d.alsoThisWeek}</div>
                <div className="mt-1 grid gap-1.5">{weekOther.map((e) => <Unmatched key={e.id} e={e} d={d} lang={lang} open={openKey === `u-${e.id}`} onToggle={() => toggle(`u-${e.id}`)} rowCls={rowCls} />)}</div>
              </>
            )}

            <div className={`mt-4 rounded-2xl border-s-4 px-3 py-2 text-sm ${week.confidence === "green" ? "border-green bg-green-soft" : week.confidence === "orange" ? "border-orange bg-orange-soft" : "border-red bg-red-soft"}`}>
              <button onClick={() => setShowIssues((v) => !v)} className="w-full text-start font-semibold">● {d.confidence[week.confidence]} {week.issues.length > 0 && `(${week.issues.length})`}</button>
              {showIssues && <ul className="mt-2 list-disc ps-5">{week.issues.map((i, k) => <li key={k} dir="auto">{i[lang]}</li>)}{week.issues.length === 0 && <li>{week.title}</li>}</ul>}
            </div>
          </>
        )}

        {/* This week's two documents, opened straight away. */}
        <div className="mt-6 grid grid-cols-2 gap-2">
          <DocButton href={planUrl} icon="📄" label={d.planDoc} />
          <DocButton href={ttUrl} icon="🗓" label={d.ttDoc} />
        </div>

        {showJob && job && (
          <section className={`mt-4 rounded-2xl border-s-4 bg-white p-4 text-sm ${job.status === "done" ? "border-green" : job.status === "failed" || stale ? "border-red" : "border-accent"}`}>
            <div className="flex items-center gap-3">
              {running(job) && !stale ? <span className="h-6 w-6 shrink-0 animate-spin rounded-full border-[3px] border-line border-t-accent" /> : <span className="text-xl">{job.status === "done" ? "✅" : "⛔"}</span>}
              <b className="flex-1 font-display text-base">{job.status === "done" ? d.uploadDone : job.status === "failed" ? d.uploadFail : stale ? d.uploadTimedOut : job.status === "saving" ? d.stepSaving : job.status === "timetable" ? d.stepTimetable : d.stepPlan}</b>
              {!running(job) || stale ? <button onClick={() => setDismissed(job.id)} className="text-ink-2">✕</button> : null}
            </div>
            {running(job) && !stale && (
              <ol className="mt-3 grid gap-1">
                {([["saving", d.stepSaving], ["timetable", d.stepTimetable], ["plan", d.stepPlan]] as const).map(([s, label]) => {
                  const order = ["saving", "timetable", "plan"];
                  const cur = order.indexOf(job.status), me = order.indexOf(s);
                  const skipped = s === "timetable" && !job.timetable_path;
                  return (
                    <li key={s} className={`flex items-center gap-2 ${me > cur || skipped ? "text-ink-2/60" : ""}`}>
                      <span className={`grid h-5 w-5 place-items-center rounded-full text-[11px] ${skipped ? "bg-line" : me < cur ? "bg-green text-white" : me === cur ? "animate-pulse bg-accent text-white" : "border border-line"}`}>{skipped ? "–" : me < cur ? "✓" : ""}</span>
                      {label}{skipped && <span className="text-xs">({d.ttOptional})</span>}
                    </li>
                  );
                })}
              </ol>
            )}
            {running(job) && !stale && <p className="mt-3 text-xs text-ink-2">{d.uploadKeeps}</p>}
            {job.message && job.status !== "done" && !running(job) && <p dir="auto" className="mt-2 text-red">{job.message}</p>}
            {job.status === "done" && job.message && <p dir="auto" className="mt-2 text-ink-2">{job.message}</p>}
            {job.problems.length > 0 && !running(job) && <ul className="mt-2 list-disc ps-5">{job.problems.map((p, i) => <li key={i} dir="auto">{p}</li>)}</ul>}
          </section>
        )}

        <div className="mt-4 grid grid-cols-[1fr_auto] gap-2">
          <button onClick={check} disabled={checking || !folders || (running(job) && !stale)} title={folders ? undefined : d.noFolders}
            className="flex items-center justify-center gap-2 rounded-2xl bg-accent py-3.5 font-display text-lg font-extrabold text-white shadow-sm disabled:opacity-50">
            {checking ? <span className="h-5 w-5 animate-spin rounded-full border-[3px] border-white/40 border-t-white" /> : "🔄"} {checking ? d.checking : d.checkFolder}
          </button>
          <button onClick={() => setSheet(true)} disabled={running(job) && !stale} className="rounded-2xl border border-line bg-white px-4 font-display text-lg font-extrabold disabled:opacity-50">⬆ {d.uploadShort}</button>
        </div>
        {!folders && <p className="mt-2 text-center text-xs text-ink-2">{d.noFolders}</p>}
        {lastCheck && !checking && (
          <p dir="auto" className={`mt-2 text-center text-xs ${lastCheck.error ? "text-red" : "text-ink-2"}`}>
            {d.lastChecked} {new Date(lastCheck.at).toLocaleString(lang === "ar" ? "ar-SA" : "en-GB", { weekday: "short", hour: "2-digit", minute: "2-digit" })} · {lastCheck.error ? lastCheck.error : lastCheck.found ? `${d.parentTitle} ${lastCheck.found} ${d.weekReady}` : d.nothingNew}
          </p>
        )}
      </div>

      {sheet && (
        <div className="fixed inset-0 z-40 flex items-end justify-center bg-black/40 p-3 sm:items-center" onClick={() => setSheet(false)}>
          <div onClick={(e) => e.stopPropagation()} className="w-full max-w-md rounded-3xl bg-white p-5 shadow-2xl">
            <h2 className="font-display text-lg font-extrabold">⬆ {d.uploadBoth}</h2>
            <div className="mt-4 grid grid-cols-2 gap-3">
              <FileSlot icon="📄" label={d.planDoc} file={planFile} onFile={setPlanFile} d={d} />
              <FileSlot icon="🗓" label={d.ttDoc} sub={d.ttOptional} file={ttFile} onFile={setTtFile} d={d} />
            </div>
            <div className="mt-4 flex gap-2">
              <button onClick={() => setSheet(false)} className="flex-1 rounded-xl border border-line py-3 font-semibold">{d.close}</button>
              <button onClick={upload} disabled={!planFile} className="flex-[2] rounded-xl bg-accent py-3 font-semibold text-white disabled:opacity-50">{d.uploadShort}</button>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}

function DocButton({ href, icon, label }: { href: string | null; icon: string; label: string }) {
  const cls = "flex items-center justify-center gap-2 rounded-xl border py-3 text-sm font-semibold";
  return href
    ? <a href={href} target="_blank" rel="noreferrer" className={`${cls} border-line bg-white`}>{icon} {label}</a>
    : <span className={`${cls} border-dashed border-line text-ink-2/60`}>{icon} {label}</span>;
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

function Unmatched({ e, d, lang, open, onToggle, rowCls }: { e: Entry; d: Dict; lang: "en" | "ar"; open: boolean; onToggle: () => void; rowCls: string }) {
  const label = PLAN_SUBJECT_LABEL[e.plan_subject as PlanSubject]?.[lang] ?? e.plan_subject;
  return (
    <div className="rounded-xl border border-orange bg-orange-soft">
      <button onClick={onToggle} className={rowCls}>
        <span className="text-orange">⚠</span>
        <span />
        <span>
          <span className="font-semibold" dir="auto">{label}{e.specific_period ? ` · ${SUBJECTS[e.specific_period as SubjectKey]?.[lang]}` : ""}</span>
          <span className="block text-xs text-orange">{d.notMatched}</span>
        </span>
        {e.homework ? <span className="rounded-full bg-red-soft px-2 py-0.5 text-[11px] font-bold text-red">{d.hwShort}</span> : <span />}
      </button>
      {open && <div className="border-t border-orange/40 px-3 py-3 text-sm"><Parts entry={e} d={d} /></div>}
    </div>
  );
}

function Parts({ entry, d }: { entry: Entry; d: Dict }) {
  const [raw, setRaw] = useState(false);
  const P = ({ label, text, red = false }: { label: string; text: string | null; red?: boolean }) =>
    !text ? null : (
      <div className="mt-2">
        <div className={`text-[11px] font-bold uppercase tracking-wider ${red ? "text-red" : "text-accent"}`}>{label}</div>
        <p dir="auto" className={`whitespace-pre-wrap ${red ? "font-semibold text-red" : ""}`}>{text}</p>
      </div>
    );
  return (
    <div>
      {entry.needs_parent && <span className="rounded-full bg-orange-soft px-2 py-0.5 text-[11px] font-bold text-orange">⚑ {d.needsParent}</span>}
      <P label={d.topic} text={entry.topic} />
      <P label={d.lesson} text={entry.lesson} />
      <P label={d.pages} text={entry.pages} />
      <P label={d.objectives} text={entry.objectives} />
      <P label={d.activity} text={entry.activity} />
      {entry.links.length > 0 && <div className="mt-2 flex flex-wrap gap-2">{entry.links.map((l) => <a key={l} href={l} target="_blank" rel="noreferrer" className="text-accent underline">{l}</a>)}</div>}
      <P label={d.practice} text={entry.independent_practice} />
      <P label={d.homeworkTitle} text={entry.homework} red />
      <P label={d.extra} text={entry.extra} />
      <button onClick={() => setRaw((v) => !v)} className="mt-2 text-xs text-ink-2 underline">{d.raw}</button>
      {raw && <pre dir="auto" className="mt-1 whitespace-pre-wrap rounded-lg bg-paper p-2 font-body text-xs">{entry.raw_text}</pre>}
    </div>
  );
}
