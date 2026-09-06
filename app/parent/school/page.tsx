"use client";
import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useLang } from "@/lib/lang";
import { t, DAY_SHORT, DAY_NAMES, type Dict } from "@/lib/i18n";
import { todayISO, schoolDay, weekStartFor, addDays, formatDate } from "@/lib/schedule";
import { buildDay, homeworkCount, loadEntries, loadLatestUpload, loadPeriods, loadSettings, loadTimetableById, loadUploads, loadWeekByStart, markUploadSeen, signedUrl, subscribeUploads, type Entry, type LastCheck, type UploadJob, type WeekRow } from "@/lib/data";
import { weekNumberFor } from "@/lib/weeks";
import { fmtWhen } from "@/components/SchoolFetch";
import { ParentNav } from "@/components/ParentNav";
import type { Period } from "@/lib/placement";
import { SUBJECTS, PLAN_SUBJECT_LABEL, subjectName, type SubjectKey, type PlanSubject } from "@/lib/subjects";
import { isParentUnlocked } from "@/components/ParentGate";


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
  const [job, setJob] = useState<UploadJob | null>(null);        // the latest run, for the "new week is ready" notice
  const [runs, setRuns] = useState<UploadJob[]>([]);             // recent runs, for this week's statement
  const [dismissed, setDismissed] = useState<string | null>(null);
  const [week1, setWeek1] = useState<string | null>(null);
  const [lastCheck, setLastCheck] = useState<LastCheck | null>(null);

  useEffect(() => { if (!isParentUnlocked()) router.replace("/"); }, [router]);
  const load = useCallback(async () => {
    if (!weekStart) return;
    const [w, s, u] = await Promise.all([loadWeekByStart(weekStart), loadSettings(), loadUploads()]);
    setWeek1(s.school_week1_start || ""); setRuns(u);
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

  const weekNo = week?.week_number ?? (weekStart && week1 ? weekNumberFor(weekStart, week1) : null);
  const run = runs.find((r) => r.week_number != null && r.week_number === weekNo && (r.status === "done" || r.status === "failed")) ?? null;
  const missingNow = weekStart && currentStart && weekStart <= currentStart && !week;
  const toggle = (k: string) => setOpenKey((o) => (o === k ? null : k));
  const rowCls = "grid w-full grid-cols-[24px_64px_1fr_auto] items-center gap-2 px-3 py-2 text-start tabular-nums";
  /** One line under the documents: where this week came from and when, or that it is still awaited. */
  const statement = run
    ? `${run.source === "manual" ? d.uploadedByHand : d.pulledOn} · ${fmtWhen(run.updated_at, lang)} · ${run.status === "done" ? d.uploadDone : `${d.uploadFail}: ${run.message ?? ""}`}`
    : week ? null
    : lastCheck ? `${d.lastChecked} ${fmtWhen(lastCheck.at, lang)} · ${lastCheck.error ? lastCheck.error : weekNo ? `${d.parentTitle} ${weekNo} ${d.notInFolder}` : ""}` : null;
  const HW = ({ on }: { on: boolean }) => on ? <span className="rounded-full bg-red-soft px-2 py-0.5 text-[11px] font-bold text-red">{d.hwShort}</span> : <span />;

  return (
    <main className="min-h-dvh px-3 pb-10 pt-3 sm:px-6">
      <header className="mx-auto flex max-w-3xl flex-wrap items-center gap-2">
        <h1 className="font-display text-xl font-extrabold">{d.parentTitle} {weekNo ?? ""} {weekStart && <span className="text-base font-normal text-ink-2">· {formatDate(weekStart, lang)} – {formatDate(addDays(weekStart, 4), lang)}</span>}</h1>
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
          <p className="mt-4 rounded-2xl bg-white p-6 text-center text-ink-2">{missingNow || weekStart > (currentStart ?? "") ? `⏳ ${d.waitingDocs}` : d.noWeek}</p>
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

        {/* This week's two documents, opened straight away, and one line about where they came from. */}
        <div className="mt-6 grid grid-cols-2 gap-2">
          <DocButton href={planUrl} icon="📄" label={d.planDoc} />
          <DocButton href={ttUrl} icon="🗓" label={d.ttDoc} />
        </div>
        {statement && <p dir="auto" className={`mt-2 text-center text-xs ${run?.status === "failed" || (!run && lastCheck?.error) ? "text-red" : "text-ink-2"}`}>{statement}</p>}
      </div>

    </main>
  );
}

function DocButton({ href, icon, label }: { href: string | null; icon: string; label: string }) {
  const cls = "flex items-center justify-center gap-2 rounded-xl border py-3 text-sm font-semibold";
  return href
    ? <a href={href} target="_blank" rel="noreferrer" className={`${cls} border-line bg-white`}>{icon} {label}</a>
    : <span className={`${cls} border-dashed border-line text-ink-2/60`}>{icon} {label}</span>;
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
