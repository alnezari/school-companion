"use client";
import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useLang } from "@/lib/lang";
import { t, DAY_NAMES } from "@/lib/i18n";
import { nextSchoolDay, schoolDay, formatDate } from "@/lib/schedule";
import { buildDay, homeworkCount, loadEntries, loadPeriods, loadProgress, loadSettings, loadWeekFor, pkey, setPacked, setProgress, subscribeProgress, type Entry, type ProgressMap, type WeekRow } from "@/lib/data";
import type { Period } from "@/lib/placement";
import { SUBJECTS, subjectName, type SubjectKey } from "@/lib/subjects";
import { KidTop } from "@/components/KidTop";
import { LessonSheet } from "@/components/LessonSheet";

/** A finished lesson becomes a little book: a coloured cover with a darker spine. */
function Book({ subjectKey, small = false, style, ...rest }: { subjectKey: string; small?: boolean } & React.HTMLAttributes<HTMLDivElement>) {
  const meta = SUBJECTS[subjectKey as SubjectKey];
  return (
    <div {...rest} style={{ background: meta.color, boxShadow: "inset 6px 0 0 rgba(0,0,0,.22), 0 2px 6px rgba(0,0,0,.15)", ...style }}
      className={`flex select-none flex-col items-center justify-center rounded-e-lg rounded-s-sm text-white ${small ? "h-14 w-10 text-xl" : "h-24 w-20 gap-1"} ${rest.className ?? ""}`}>
      <span className={small ? "" : "text-3xl"}>{meta.icon}</span>
      {!small && <span dir="auto" className="max-w-full truncate px-1 font-display text-[11px] font-extrabold leading-tight">{subjectName(subjectKey)}</span>}
    </div>
  );
}

export default function KidPage() {
  const [lang] = useLang("kid");
  const d = t(lang);
  const [target, setTarget] = useState<string | null>(null);
  useEffect(() => { setTarget(nextSchoolDay()); }, []);
  const day = target ? (schoolDay(target) ?? 0) : 0;

  const [loading, setLoading] = useState(true);
  const [periods, setPeriods] = useState<Period[]>([]);
  const [week, setWeek] = useState<WeekRow | null>(null);
  const [entries, setEntries] = useState<Entry[]>([]);
  const [progress, setProgressMap] = useState<ProgressMap>({});
  const [settings, setSettings] = useState<Record<string, string>>({});
  const [openSlot, setOpenSlot] = useState<number | null>(null);
  const [celebrate, setCelebrate] = useState(false);

  useEffect(() => {
    if (!target) return;
    (async () => {
      const [w, s] = await Promise.all([loadWeekFor(target), loadSettings()]);
      setWeek(w); setSettings(s);
      const p = await loadPeriods(w?.timetable_id);
      setPeriods(p);
      if (w) {
        const [e, pr] = await Promise.all([loadEntries(w.id), loadProgress(w.id)]);
        setEntries(e); setProgressMap(pr);
      }
      setLoading(false);
    })();
  }, [target]);
  useEffect(() => {
    if (!week) return;
    return subscribeProgress(week.id, (row) => setProgressMap((m) => ({ ...m, [pkey(row.day, row.slot)]: row })));
  }, [week]);

  const { slots, unmatched } = useMemo(() => buildDay(periods, entries, day), [periods, entries, day]);
  const doneCount = slots.filter((s) => progress[pkey(day, s.period.slot)]?.done_at).length;
  const hw = homeworkCount(slots, unmatched);
  const prepare = slots.filter((s) => !s.entry).length;
  const allDone = slots.length > 0 && doneCount === slots.length;
  const packedCount = slots.filter((s) => progress[pkey(day, s.period.slot)]?.packed_at).length;
  const allPacked = allDone && packedCount === slots.length;
  useEffect(() => { if (allPacked) setCelebrate(true); }, [allPacked]);

  // ----- the bag: once everything is done, he drags each book in -----
  const bagRef = useRef<HTMLDivElement>(null);
  const dragRef = useRef<{ slot: number; x0: number; y0: number; moved: boolean } | null>(null);
  const [dragPos, setDragPos] = useState<{ slot: number; dx: number; dy: number } | null>(null);
  async function pack(slot: number, packed: boolean) {
    if (!week) return;
    const packed_at = await setPacked(week.id, day, slot, packed);
    setProgressMap((m) => ({ ...m, [pkey(day, slot)]: { ...m[pkey(day, slot)], packed_at } }));
  }
  function bookDown(e: React.PointerEvent, slot: number) {
    dragRef.current = { slot, x0: e.clientX, y0: e.clientY, moved: false };
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
  }
  function bookMove(e: React.PointerEvent) {
    const dr = dragRef.current; if (!dr || !allDone) return;
    const dx = e.clientX - dr.x0, dy = e.clientY - dr.y0;
    if (Math.abs(dx) + Math.abs(dy) > 6) dr.moved = true;
    if (dr.moved) setDragPos({ slot: dr.slot, dx, dy });
  }
  function bookUp(e: React.PointerEvent) {
    const dr = dragRef.current; dragRef.current = null; setDragPos(null);
    if (!dr) return;
    if (!dr.moved) { setOpenSlot(dr.slot); return; }
    const r = bagRef.current?.getBoundingClientRect();
    if (r && e.clientX >= r.left && e.clientX <= r.right && e.clientY >= r.top && e.clientY <= r.bottom) pack(dr.slot, true);
  }

  async function mark(slot: number, done: boolean, feeling?: "easy" | "ok" | "hard") {
    if (!week) return;
    const row = await setProgress(week.id, day, slot, done, feeling ?? null);
    setProgressMap((m) => ({ ...m, [pkey(day, slot)]: row }));
    if (done) setTimeout(() => setOpenSlot(null), 900);
  }

  const name = settings.child_name || "Taym";
  const open = openSlot != null ? slots.find((s) => s.period.slot === openSlot) : null;

  return (
    <main className="min-h-dvh bg-kid px-4 pb-8 pt-4 sm:px-6 lg:px-10">
      <KidTop className="max-w-6xl" title={<>{d.hi} {name} 👋</>} stars={doneCount}
        sub={target && <>{d.tomorrowIs} <b className="text-ink">{DAY_NAMES[lang][day]}</b>, {formatDate(target, lang)}</>} />

      {loading ? (
        <p className="mx-auto mt-10 max-w-6xl text-center text-ink-2">…</p>
      ) : !week || slots.length === 0 ? (
        <section className="mx-auto mt-10 max-w-md rounded-3xl bg-white p-8 text-center shadow-sm rise">
          <div className="text-6xl">🌤️</div>
          <h2 className="mt-3 font-display text-2xl font-extrabold">{d.noPlanTitle}</h2>
          <p className="mt-2 text-ink-2">{d.noPlanBody}</p>
        </section>
      ) : (
        <div className="mx-auto max-w-6xl">
          <p className="mt-3 inline-block rounded-2xl bg-white/80 px-4 py-2 font-display text-lg font-bold">
            📚 {slots.length} {d.classes}{hw > 0 && <> · <span className="text-red">{hw} {d.homework}</span></>}{prepare > 0 && <> · {prepare} {d.toPrepare}</>}
            {" · "}⭐ {doneCount}/{slots.length}
          </p>
          {allPacked ? <div className="pop mt-3 rounded-2xl bg-green px-4 py-3 text-center font-display text-xl font-extrabold text-white">{d.allDone}</div>
            : allDone && <div className="rise mt-3 rounded-2xl bg-[#F27D26] px-4 py-3 text-center font-display text-xl font-extrabold text-white">{d.packTitle}<span className="block text-sm font-semibold opacity-90">{d.packHint}</span></div>}

          <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {slots.filter((s) => !progress[pkey(day, s.period.slot)]?.done_at).map(({ period, entry }) => {
              const meta = SUBJECTS[period.subject_key as SubjectKey];
              const title = entry ? ([entry.lesson, entry.topic].find(Boolean) as string) || entry.raw_text.slice(0, 80) : d.emptyCard;
              return (
                <button key={period.slot} onClick={() => setOpenSlot(period.slot)}
                  className="rise relative flex min-h-36 flex-col rounded-3xl border-4 bg-white p-4 text-start shadow-sm transition active:scale-[.98]"
                  style={{ borderColor: meta.color, animationDelay: `${period.slot * 40}ms` }}>
                  <div className="flex items-center gap-3">
                    <span className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl font-display text-xl font-extrabold text-white" style={{ background: meta.color }}>{period.slot}</span>
                    <span className="text-3xl">{meta.icon}</span>
                    <span className="ms-auto text-2xl text-line">☆</span>
                  </div>
                  <div className="mt-2 font-display text-lg font-extrabold leading-tight" dir="auto">{subjectName(period.subject_key)}</div>
                  <p dir="auto" className="mt-1 line-clamp-2 text-sm text-ink-2">{title}</p>
                  {entry?.homework && <span className="mt-2 inline-block w-fit rounded-full bg-red px-2.5 py-0.5 text-xs font-extrabold text-white">{d.homeworkTitle.toUpperCase()}</span>}
                </button>
              );
            })}
          </div>
          {doneCount > 0 && (
            <div className={`mt-4 flex flex-wrap items-end gap-4 ${allDone ? "sm:flex-nowrap" : ""}`}>
              <div className="flex flex-wrap gap-3 rounded-2xl border-b-8 border-[#C9A16B] bg-[#F1E3CB] px-3 pb-2 pt-3">
                {slots.filter((s) => { const p = progress[pkey(day, s.period.slot)]; return !!p?.done_at && !p.packed_at; }).map(({ period }) => {
                  const dragging = dragPos?.slot === period.slot;
                  return (
                    <Book key={period.slot} subjectKey={period.subject_key} onPointerDown={(e) => bookDown(e, period.slot)} onPointerMove={bookMove} onPointerUp={bookUp} onPointerCancel={bookUp}
                      className={`pop ${allDone ? "cursor-grab touch-none" : ""} ${dragging ? "z-40 scale-110" : ""}`}
                      style={dragging ? { transform: `translate(${dragPos.dx}px, ${dragPos.dy}px) scale(1.1)`, transition: "none", position: "relative" } : undefined} />
                  );
                })}
                {packedCount === doneCount && <span className="self-center px-2 text-sm font-semibold text-[#8A6A3D]">{d.bagReady}</span>}
              </div>
              {allDone && (
                <div ref={bagRef} className={`flex min-h-32 flex-1 flex-col items-center justify-end rounded-3xl border-4 border-dashed p-3 transition ${dragPos ? "border-[#F27D26] bg-[#FFE9D6]" : "border-[#C9A16B]/60 bg-white/60"}`}>
                  <div className="flex flex-wrap items-end justify-center gap-1">
                    {slots.filter((s) => !!progress[pkey(day, s.period.slot)]?.packed_at).map(({ period }) => (
                      <Book key={period.slot} subjectKey={period.subject_key} small onClick={() => pack(period.slot, false)} className="pop cursor-pointer" />
                    ))}
                  </div>
                  <div className="mt-1 font-display text-lg font-extrabold text-[#8A6A3D]">🎒 {d.myBag} · {packedCount}/{slots.length}</div>
                </div>
              )}
            </div>
          )}
        </div>
      )}


      {open && week && (
        <LessonSheet period={open.period} entry={open.entry} done={!!progress[pkey(day, open.period.slot)]?.done_at} lang={lang} d={d}
          onClose={() => setOpenSlot(null)} onDone={(v, f) => mark(open.period.slot, v, f)} />
      )}
      {celebrate && (
        <div className="confetti pointer-events-none fixed inset-0 z-30" onAnimationEnd={() => setCelebrate(false)}>
          {Array.from({ length: 40 }).map((_, i) => (
            <span key={i} style={{ left: `${(i * 37) % 100}%`, background: ["#F27D26", "#22A06B", "#3B7DDD", "#7A5AF8", "#D9A400"][i % 5], animationDelay: `${(i % 10) * 120}ms` }} />
          ))}
        </div>
      )}
    </main>
  );
}
