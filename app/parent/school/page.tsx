"use client";
import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useLang } from "@/lib/lang";
import { t, DAY_SHORT, DAY_NAMES } from "@/lib/i18n";
import { todayISO, schoolDay, weekStartFor, addDays, formatDate } from "@/lib/schedule";
import { buildDay, homeworkCount, loadEntries, loadPeriods, loadProgress, loadWeekByStart, pkey, signedUrl, subscribeProgress, type Entry, type ProgressMap, type WeekRow } from "@/lib/data";
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
  const [progress, setProgressMap] = useState<ProgressMap>({});
  const [loading, setLoading] = useState(true);
  const [openSlot, setOpenSlot] = useState<number | null>(null);
  const [showIssues, setShowIssues] = useState(false);
  const [docUrl, setDocUrl] = useState<string | null>(null);

  useEffect(() => { if (!isParentUnlocked()) router.replace("/"); }, [router]);
  useEffect(() => {
    if (!weekStart) return;
    (async () => {
      const w = await loadWeekByStart(weekStart);
      const p = await loadPeriods(w?.timetable_id);
      setPeriods(p); setWeek(w);
      if (w) {
        const [e, pr, url] = await Promise.all([loadEntries(w.id), loadProgress(w.id), signedUrl(w.source_path)]);
        setEntries(e); setProgressMap(pr); setDocUrl(url);
      }
      setLoading(false);
    })();
  }, [weekStart]);
  useEffect(() => {
    if (!week) return;
    return subscribeProgress(week.id, (row) => setProgressMap((m) => ({ ...m, [pkey(row.day, row.slot)]: row })));
  }, [week]);

  const { slots, unmatched } = useMemo(() => buildDay(periods, entries, day), [periods, entries, day]);
  const weekOther = useMemo(() => entries.filter((e) => !e.placed && e.day == null), [entries]);
  const done = slots.filter((s) => progress[pkey(day, s.period.slot)]?.done_at).length;
  const pct = slots.length ? Math.round((done / slots.length) * 100) : 0;
  const hw = homeworkCount(slots, unmatched);
  const dateISO = weekStart ? addDays(weekStart, day) : null;
  const feelingPct = { easy: 100, ok: 66, hard: 33 } as const;

  return (
    <main className="min-h-dvh px-3 pb-10 pt-3 sm:px-6">
      <header className="mx-auto flex max-w-3xl flex-wrap items-center gap-2">
        <h1 className="font-display text-xl font-extrabold">{d.parentTitle} {week?.week_number ?? ""} {weekStart && <span className="text-ink-2 text-base font-normal">· {formatDate(weekStart, lang)} – {formatDate(addDays(weekStart, 4), lang)}</span>}</h1>
        <div className="ms-auto"><Link href="/parent" className="rounded-full border border-line bg-white px-3 py-1.5 text-sm font-semibold">🏠</Link></div>
      </header>

      <div className="mx-auto mt-3 max-w-3xl">
        <ParentNav active="week" d={d} />
        {weekStart && currentStart && !isCurrent && (
          <div className="mt-3 flex items-center justify-between gap-2 rounded-2xl border-s-4 border-orange bg-orange-soft px-3 py-2 text-sm">
            <span>⏪ {weekStart < currentStart ? d.oldWeek : d.futureWeek}</span>
            <Link href="/parent/school" className="rounded-lg bg-white px-3 py-1 font-semibold">{d.backToCurrent}</Link>
          </div>
        )}
        <div className="mt-3 grid grid-cols-5 gap-1.5">
          {DAY_SHORT[lang].map((n, i) => (
            <button key={i} onClick={() => { setDay(i); setOpenSlot(null); }}
              className={`rounded-xl border py-2 text-sm font-semibold ${i === day ? "border-accent bg-accent text-white" : "border-line bg-white"} ${i === todayIdx ? "ring-2 ring-orange ring-offset-1" : ""}`}>
              {n}{i === todayIdx && <span className="block text-[10px] font-normal opacity-80">{d.today}</span>}
            </button>
          ))}
        </div>

        {loading || !weekStart ? <p className="mt-6 text-center text-ink-2">…</p> : !week ? (
          <div className="mt-6 rounded-2xl bg-white p-6 text-center text-ink-2">{d.noWeek}<br /><Link href="/parent/school/upload" className="mt-3 inline-block rounded-xl bg-accent px-4 py-2 font-semibold text-white">📄 {d.upload}</Link></div>
        ) : (
          <>
            {week.value_of_week && (week.value_of_week.arabic || week.value_of_week.english) && (
              <p className="mt-3 rounded-2xl border border-line bg-white px-4 py-2 text-sm">
                <span className="text-xs font-bold uppercase tracking-wider text-ink-2">{d.valueOfWeek}</span>
                <span dir="auto" className="block">{week.value_of_week.arabic}</span>
                <span dir="auto" className="block text-ink-2">{week.value_of_week.english}{week.value_of_week.source ? ` — ${week.value_of_week.source}` : ""}</span>
              </p>
            )}
            <div className="mt-3 flex items-baseline justify-between">
              <b className="text-lg">{DAY_NAMES[lang][day]} {dateISO && formatDate(dateISO, lang)}</b>
              <span className="text-sm">{slots.length} {d.classesShort} · <b className="text-red">{hw} {d.hwShort}</b></span>
            </div>
            <div className="mt-1 h-2 overflow-hidden rounded-full bg-line"><div className="h-full bg-green transition-all" style={{ width: `${pct}%` }} /></div>
            <div className="mt-1 text-xs text-ink-2">{done}/{slots.length} · {pct}% {d.completed}</div>

            <div className="mt-2 grid gap-1.5">
              {slots.map(({ period, entry }) => {
                const meta = SUBJECTS[period.subject_key as SubjectKey];
                const pr = progress[pkey(day, period.slot)];
                const isOpen = openSlot === period.slot;
                return (
                  <div key={period.slot} className={`rounded-xl border bg-white ${isOpen ? "border-accent" : "border-line"}`}>
                    <button onClick={() => setOpenSlot(isOpen ? null : period.slot)} className="grid w-full grid-cols-[24px_64px_1fr_14px] items-center gap-2 px-3 py-2 text-start tabular-nums">
                      <span className="font-bold text-ink-2">{period.slot}</span>
                      <span className="text-xs text-ink-2">{period.start_time.slice(0, 5)}–{period.end_time.slice(0, 5)}</span>
                      <span>
                        <span className="font-semibold" style={{ color: meta.color }} dir="auto">{meta.icon} {subjectName(period.subject_key)}</span>
                        <span className="block text-xs text-ink-2">{period.teacher ?? ""}</span>
                      </span>
                      <span className={`h-2.5 w-2.5 justify-self-end rounded-full ${pr?.done_at ? "bg-green" : entry?.homework ? "bg-red" : "bg-line"}`} />
                    </button>
                    {isOpen && (
                      <div className="border-t border-line px-3 py-3 text-sm">
                        <div className="mb-2 flex flex-wrap gap-1.5">
                          {entry?.homework && <span className="rounded-full bg-red-soft px-2 py-0.5 text-[11px] font-bold text-red">{d.hwShort}</span>}
                          {pr?.done_at
                            ? <span className="rounded-full bg-green-soft px-2 py-0.5 text-[11px] font-bold text-green">✓{pr.feeling ? ` ${d.feeling[pr.feeling]} ${feelingPct[pr.feeling]}%` : ""}</span>
                            : <span className="rounded-full bg-line px-2 py-0.5 text-[11px] font-bold text-ink-2">{d.notStarted}</span>}
                        </div>
                        {entry ? <Parts entry={entry} d={d} /> : <p className="text-ink-2">{d.empty}</p>}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>

            {unmatched.length > 0 && <Extras title={d.notMatched} items={unmatched} d={d} lang={lang} />}
            {weekOther.length > 0 && <Extras title={d.otherItems} items={weekOther} d={d} lang={lang} />}

            <div className={`mt-4 rounded-2xl border-s-4 p-3 text-sm ${week.confidence === "green" ? "border-green bg-green-soft" : week.confidence === "orange" ? "border-orange bg-orange-soft" : "border-red bg-red-soft"}`}>
              <button onClick={() => setShowIssues((v) => !v)} className="w-full text-start font-semibold">
                ● {d.confidence[week.confidence]} {week.issues.length > 0 && `(${week.issues.length})`}
              </button>
              {showIssues && (
                <ul className="mt-2 list-disc ps-5">
                  {week.issues.map((i, k) => <li key={k} dir="auto">{i[lang]}</li>)}
                  {week.issues.length === 0 && <li>{week.title}</li>}
                </ul>
              )}
              {docUrl && <a href={docUrl} target="_blank" rel="noreferrer" className="mt-2 block font-semibold text-accent underline">📎 {d.original}</a>}
            </div>
          </>
        )}
        <div className="mt-6 flex gap-2">
          <Link href="/parent/school/upload" className="flex-1 rounded-xl border border-line bg-white py-2 text-center text-sm font-semibold">📄 {d.upload}</Link>
          <Link href="/parent/school/timetable" className="flex-1 rounded-xl border border-line bg-white py-2 text-center text-sm font-semibold">🗓 {d.uploadTimetable}</Link>
        </div>
      </div>
    </main>
  );
}

function Parts({ entry, d }: { entry: Entry; d: ReturnType<typeof t> }) {
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

function Extras({ title, items, d, lang }: { title: string; items: Entry[]; d: ReturnType<typeof t>; lang: "en" | "ar" }) {
  return (
    <section className="mt-4 rounded-2xl border border-orange bg-white p-3">
      <h3 className="text-sm font-bold text-orange">⚠ {title}</h3>
      {items.map((e) => (
        <div key={e.id} className="mt-2 border-t border-line pt-2 text-sm">
          <div className="text-xs font-bold text-ink-2">{PLAN_SUBJECT_LABEL[e.plan_subject as PlanSubject]?.[lang] ?? e.plan_subject}{e.specific_period ? ` · ${SUBJECTS[e.specific_period as SubjectKey]?.[lang]}` : ""}</div>
          <Parts entry={e} d={d} />
        </div>
      ))}
    </section>
  );
}
