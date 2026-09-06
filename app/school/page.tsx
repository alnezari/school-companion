"use client";
import { useEffect, useMemo, useRef, useState } from "react";
import { motion, AnimatePresence, LayoutGroup, type PanInfo } from "motion/react";
import { useLang } from "@/lib/lang";
import { t, DAY_NAMES7 } from "@/lib/i18n";
import { addDays, todayISO, schoolDay, weekday, formatDate } from "@/lib/schedule";
import { buildDay, homeworkCount, loadEntries, loadPeriods, loadProgress, loadSettings, loadWeekFor, pkey, setPacked, setProgress, subscribeProgress, type Entry, type ProgressMap, type WeekRow } from "@/lib/data";
import type { Period } from "@/lib/placement";
import { SUBJECTS, subjectName, type SubjectKey } from "@/lib/subjects";
import { SPRING, TAP, enter } from "@/lib/motion";
import { KidTop } from "@/components/KidTop";
import { LessonBody } from "@/components/LessonSheet";

const lid = (slot: number) => `lesson-${slot}`;

/** A finished lesson is a little book: coloured cover, darker spine. Same element morphs from card to book to bag. */
function Book({ subjectKey, small = false, className = "", ...rest }: { subjectKey: string; small?: boolean; className?: string } & React.ComponentProps<typeof motion.div>) {
  const meta = SUBJECTS[subjectKey as SubjectKey];
  return (
    <motion.div {...rest} className={`flex select-none flex-col items-center justify-center rounded-e-lg rounded-s-sm text-white ${small ? "h-8 w-[18px] text-[10px]" : "h-20 w-14 gap-1"} ${className}`}
      style={{ background: meta.color, boxShadow: "inset 5px 0 0 rgba(0,0,0,.22), 0 3px 8px rgba(0,0,0,.18)", ...(rest.style as object) }}>
      <span className={small ? "" : "text-2xl"}>{meta.icon}</span>
      {!small && <span dir="auto" className="max-w-full truncate px-1 font-display text-[10px] font-extrabold leading-tight">{subjectName(subjectKey)}</span>}
    </motion.div>
  );
}

/** A flat, soft bag. The mouth is a slot that opens and closes; a zipper draws across it. Slow enough to watch. */
function Bag({ open, count, mouthRef, onTapBag, children }: { open: boolean; count: number; mouthRef: React.RefObject<HTMLDivElement | null>; onTapBag: () => void; children: React.ReactNode }) {
  const zip = { duration: 0.7, ease: [0.645, 0.045, 0.355, 1] as const };
  return (
    <motion.div initial={{ y: 110, opacity: 0 }} animate={{ y: 0, opacity: 1 }} exit={{ y: 110, opacity: 0 }} transition={SPRING.hero} className="relative mx-auto mt-5 h-[168px] w-[232px]">
      <motion.div key={`bump-${count}`} initial={{ scaleY: 0.94, scaleX: 1.03 }} animate={{ scaleY: 1, scaleX: 1 }} transition={SPRING.bouncy} className="absolute inset-0 origin-bottom cursor-pointer" onClick={onTapBag}>
        <div className="absolute left-1/2 top-0 h-9 w-24 -translate-x-1/2 rounded-t-full border-[8px] border-b-0 border-[#1D3E7A]" />
        <div className="absolute inset-x-0 bottom-0 top-7 rounded-[28px] bg-[#3B7DDD] shadow-[inset_0_-14px_0_rgba(0,0,0,.10),0_16px_30px_-18px_rgba(0,0,0,.45)]" />
        <div className="absolute inset-x-10 bottom-4 h-11 rounded-2xl bg-[#2F6BD0] shadow-[inset_0_3px_0_rgba(255,255,255,.14)]" />
        <motion.div ref={mouthRef} initial={false} animate={{ height: open ? 58 : 6, y: open ? 0 : 26 }} transition={SPRING.hero} onClick={(e) => e.stopPropagation()}
          className="absolute inset-x-6 top-10 flex items-end justify-center gap-[3px] overflow-hidden rounded-2xl bg-[#17305F] px-2 pb-1.5 shadow-[inset_0_8px_12px_rgba(0,0,0,.45)]">{children}</motion.div>
        <motion.div initial={false} animate={{ scaleX: open ? 0 : 1, opacity: open ? 0 : 1 }} transition={zip} className="absolute inset-x-6 top-[66px] h-1.5 origin-left rounded-full"
          style={{ background: "repeating-linear-gradient(90deg,#FFD84D 0 5px,#E0B93A 5px 7px,transparent 7px 9px)" }} />
        <motion.div initial={false} animate={{ x: open ? -160 : 0, opacity: open ? 0 : 1 }} transition={zip} className="absolute right-5 top-[61px] h-4 w-3 rounded-sm bg-[#FFD84D] shadow-sm" />
      </motion.div>
    </motion.div>
  );
}

export default function KidPage() {
  const [lang] = useLang("kid");
  const d = t(lang);
  const [target, setTarget] = useState<string | null>(null);
  useEffect(() => { setTarget(addDays(todayISO(), 1)); }, []);
  const weekendTomorrow = target != null && schoolDay(target) === null;
  const day = target && !weekendTomorrow ? schoolDay(target)! : 0;

  const [loading, setLoading] = useState(true);
  const [periods, setPeriods] = useState<Period[]>([]);
  const [week, setWeek] = useState<WeekRow | null>(null);
  const [entries, setEntries] = useState<Entry[]>([]);
  const [progress, setProgressMap] = useState<ProgressMap>({});
  const [settings, setSettings] = useState<Record<string, string>>({});
  const [openSlot, setOpenSlot] = useState<number | null>(null);
  const [celebrate, setCelebrate] = useState(false);
  const [bagOpen, setBagOpen] = useState(false);
  const [reopen, setReopen] = useState(false); // tap a zipped bag to open it again and take books out

  useEffect(() => {
    if (!target) return;
    (async () => {
      if (weekendTomorrow) { setSettings(await loadSettings()); setLoading(false); return; }
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
  }, [target, weekendTomorrow]);
  useEffect(() => {
    if (!week) return;
    return subscribeProgress(week.id, (row) => setProgressMap((m) => ({ ...m, [pkey(row.day, row.slot)]: row })));
  }, [week]);

  const { slots, unmatched } = useMemo(() => buildDay(periods, entries, day), [periods, entries, day]);
  const st = (slot: number) => progress[pkey(day, slot)];
  const doneCount = slots.filter((s) => st(s.period.slot)?.done_at).length;
  const hw = homeworkCount(slots, unmatched);
  const prepare = slots.filter((s) => !s.entry).length;
  const allDone = slots.length > 0 && doneCount === slots.length;
  const packedCount = slots.filter((s) => st(s.period.slot)?.packed_at).length;
  const allPacked = allDone && packedCount === slots.length;
  // the bag comes in closed, then opens after a beat
  useEffect(() => { if (!allDone) { setBagOpen(false); return; } const id = setTimeout(() => setBagOpen(true), 1000); return () => clearTimeout(id); }, [allDone]);
  const prevPacked = useRef<number | null>(null);
  useEffect(() => {
    if (allPacked) setReopen(false);
    const justFinished = allPacked && prevPacked.current === slots.length - 1; // the last book went in now, not on an earlier visit
    prevPacked.current = loading ? null : packedCount;
    if (!justFinished) return;
    const id = setTimeout(() => setCelebrate(true), 1100); // let the zip close first
    return () => clearTimeout(id);
  }, [allPacked, packedCount, slots.length, loading]);
  useEffect(() => { if (!celebrate) return; const id = setTimeout(() => setCelebrate(false), 4000); return () => clearTimeout(id); }, [celebrate]);
  const dragged = useRef(false); // a drag must never count as a tap

  const mouthRef = useRef<HTMLDivElement>(null);
  async function pack(slot: number, packed: boolean) {
    if (!week) return;
    const packed_at = await setPacked(week.id, day, slot, packed);
    setProgressMap((m) => ({ ...m, [pkey(day, slot)]: { ...m[pkey(day, slot)], packed_at } }));
    if (packed && target) {
      const nowAllPacked = slots.every((s) => (s.period.slot === slot ? true : !!progress[pkey(day, s.period.slot)]?.packed_at));
      if (nowAllPacked) fetch("/api/notify", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ type: "bag_packed", date: target }) }).catch(() => {});
    }
  }
  function dropped(slot: number, info: PanInfo) {
    setTimeout(() => { dragged.current = false; }, 250);
    const r = mouthRef.current?.getBoundingClientRect();
    if (r && info.point.x >= r.left - 16 && info.point.x <= r.right + 16 && info.point.y >= r.top - 40 && info.point.y <= r.bottom + 30) pack(slot, true);
  }
  async function mark(slot: number, done: boolean, feeling?: "easy" | "ok" | "hard") {
    if (!week) return;
    const row = await setProgress(week.id, day, slot, done, feeling ?? null);
    setProgressMap((m) => ({ ...m, [pkey(day, slot)]: row }));
    if (done) setTimeout(() => setOpenSlot(null), 900); // a beat to see the star, then the card folds into a book in front of him
  }

  const name = settings.child_name || "Taym";
  const isDone = (slot: number) => !!st(slot)?.done_at, isPacked = (slot: number) => !!st(slot)?.packed_at;
  const grid = slots.filter((s) => !isDone(s.period.slot) || s.period.slot === openSlot); // lessons to do, plus a finished one he opened again
  const finished = slots.filter((s) => isDone(s.period.slot) && !isPacked(s.period.slot) && s.period.slot !== openSlot);
  const packed = slots.filter((s) => isPacked(s.period.slot));

  return (
    <main className="min-h-dvh bg-kid px-4 pb-8 pt-4 sm:px-6 lg:px-10">
      <KidTop className="max-w-6xl" title={<>{d.hi} {name} 👋</>} stars={doneCount}
        sub={target && <>{d.tomorrowIs} <b className="text-ink">{DAY_NAMES7[lang][weekday(target)]}</b>, {formatDate(target, lang)}</>} />

      {loading ? (
        <p className="mx-auto mt-10 max-w-6xl text-center text-ink-2">…</p>
      ) : weekendTomorrow ? (
        <motion.section {...enter(0)} className="mx-auto mt-10 max-w-md rounded-3xl bg-white p-8 text-center shadow-sm">
          <div className="text-6xl">🎉</div>
          <h2 className="mt-3 font-display text-2xl font-extrabold">{d.weekendTitle}</h2>
          <p className="mt-2 text-ink-2">{d.weekendBody}</p>
        </motion.section>
      ) : !week || slots.length === 0 ? (
        <motion.section {...enter(0)} className="mx-auto mt-10 max-w-md rounded-3xl bg-white p-8 text-center shadow-sm">
          <div className="text-6xl">🌤️</div>
          <h2 className="mt-3 font-display text-2xl font-extrabold">{d.noPlanTitle}</h2>
          <p className="mt-2 text-ink-2">{d.noPlanBody}</p>
        </motion.section>
      ) : (
        <LayoutGroup>
          {/* One structure for every screen: lessons on the left, the finished books and the bag on the right; they stack on a phone. */}
          <div className="mx-auto mt-4 grid max-w-6xl gap-4 lg:grid-cols-[minmax(0,1fr)_320px]">
            <div>
              <motion.div {...enter(0)} className="flex items-center gap-3 rounded-2xl bg-white/70 px-4 py-2.5">
                <div className="flex flex-1 gap-1">
                  {slots.map(({ period }) => <motion.span key={period.slot} initial={false} animate={{ backgroundColor: isDone(period.slot) ? "#1E8E4E" : "#E7DFCF" }} transition={SPRING.effect} className="h-2 flex-1 rounded-full" />)}
                </div>
                {hw > 0 && <span className="rounded-full bg-red px-2.5 py-0.5 text-xs font-extrabold text-white">{hw} {d.homework}</span>}
              </motion.div>
              <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3">
                {grid.map(({ period, entry }, i) => {
                  const meta = SUBJECTS[period.subject_key as SubjectKey];
                  const title = entry ? ([entry.lesson, entry.topic].find(Boolean) as string) || entry.raw_text.slice(0, 80) : d.emptyCard;
                  if (openSlot === period.slot) return (
                    // the card opens in place: same card, more inside, everything visible when it closes
                    <motion.div key={period.slot} layoutId={lid(period.slot)} layout transition={{ layout: SPRING.gentle }} className="col-span-full rounded-3xl border-4 bg-white p-5 shadow-md" style={{ borderColor: meta.color, borderRadius: 24 }}>
                      <motion.div layout="position" initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.25, delay: 0.1 }}>
                        <LessonBody period={period} entry={entry} done={isDone(period.slot)} lang={lang} d={d} onClose={() => setOpenSlot(null)} onDone={(v, f) => mark(period.slot, v, f)} />
                      </motion.div>
                    </motion.div>
                  );
                  return (
                    <motion.button key={period.slot} layoutId={lid(period.slot)} layout {...enter(i + 1)} whileTap={TAP} onClick={() => setOpenSlot(period.slot)}
                      className="relative flex min-h-36 flex-col rounded-3xl border-4 bg-white p-4 text-start shadow-sm" style={{ borderColor: meta.color, borderRadius: 24 }}>
                      <motion.div layout="position" className="contents">
                        <div className="flex items-center gap-3">
                          <span className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl font-display text-xl font-extrabold text-white" style={{ background: meta.color }}>{period.slot}</span>
                          <span className="text-3xl">{meta.icon}</span>
                          <span className="ms-auto text-2xl text-line">☆</span>
                        </div>
                        <div className="mt-2 font-display text-lg font-extrabold leading-tight" dir="auto">{subjectName(period.subject_key)}</div>
                        <p dir="auto" className="mt-1 line-clamp-2 text-sm text-ink-2">{title}</p>
                        {entry?.homework && <span className="mt-2 inline-block w-fit rounded-full bg-red px-2.5 py-0.5 text-xs font-extrabold text-white">{d.homeworkTitle.toUpperCase()}</span>}
                      </motion.div>
                    </motion.button>
                  );
                })}
              </div>
            </div>

            <aside className="lg:sticky lg:top-4 lg:self-start">
              <motion.section {...enter(1)} className="rounded-3xl bg-white/70 p-4">
                <AnimatePresence mode="wait" initial={false}>
                  <motion.h2 key={allPacked ? "ready" : allDone ? "pack" : "fin"} initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -6 }} transition={{ duration: 0.2 }} className="font-display font-extrabold">
                    {allPacked ? d.readyShort : allDone ? d.packShort : `✅ ${d.finished}`}
                  </motion.h2>
                </AnimatePresence>
                <div className="mt-3 flex min-h-[88px] flex-wrap items-end gap-3">
                  {finished.map(({ period }) => (
                    <Book key={period.slot} subjectKey={period.subject_key} layoutId={lid(period.slot)} layout transition={{ layout: SPRING.hero }}
                      drag={allDone} dragSnapToOrigin dragElastic={0.6} dragMomentum={false} dragTransition={SPRING.spatial as object}
                      onDragStart={() => { dragged.current = true; }} onDragEnd={(_e, info) => dropped(period.slot, info)}
                      whileDrag={{ scale: 1.1, rotate: 4, zIndex: 50, boxShadow: "0 18px 30px -12px rgba(0,0,0,.4)" }}
                      onTap={() => { if (!dragged.current) setOpenSlot(period.slot); }}
                      className={allDone ? "cursor-grab touch-none" : "cursor-pointer"} />
                  ))}
                  {finished.length === 0 && packed.length === 0 && <p className="text-sm text-ink-2">☆</p>}
                </div>
                <AnimatePresence>
                  {allDone && (
                    <Bag key="bag" open={bagOpen && (!allPacked || reopen)} count={packedCount} mouthRef={mouthRef} onTapBag={() => allPacked && setReopen((r) => !r)}>
                      {packed.map(({ period }) => (
                        <Book key={period.slot} subjectKey={period.subject_key} layoutId={lid(period.slot)} layout transition={{ layout: SPRING.hero }} small whileTap={{ y: -8 }} onTap={() => pack(period.slot, false)} className="cursor-pointer" />
                      ))}
                    </Bag>
                  )}
                </AnimatePresence>
              </motion.section>
            </aside>
          </div>
        </LayoutGroup>
      )}

      <AnimatePresence>
        {celebrate && (
          <motion.div key="party" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.3 }} onClick={() => setCelebrate(false)}
            className="fixed inset-0 z-50 flex flex-col items-center justify-center bg-kid/95 p-6 text-center">
            <motion.div initial={{ scale: 0.4, rotate: -12 }} animate={{ scale: 1, rotate: 0 }} transition={{ ...SPRING.bouncy, delay: 0.1 }} className="text-[110px] leading-none drop-shadow-lg">🎒</motion.div>
            <motion.h2 initial={{ y: 20, opacity: 0 }} animate={{ y: 0, opacity: 1 }} transition={{ ...SPRING.gentle, delay: 0.35 }} className="mt-4 font-display text-4xl font-extrabold sm:text-5xl">{d.bagPackedTitle}</motion.h2>
            <motion.p initial={{ y: 20, opacity: 0 }} animate={{ y: 0, opacity: 1 }} transition={{ ...SPRING.gentle, delay: 0.5 }} className="mt-2 text-xl text-ink-2">{d.bagPackedSub}</motion.p>
            <div className="confetti pointer-events-none absolute inset-0">
              {Array.from({ length: 40 }).map((_, i) => (
                <span key={i} style={{ left: `${(i * 37) % 100}%`, background: ["#F27D26", "#22A06B", "#3B7DDD", "#7A5AF8", "#D9A400"][i % 5], animationDelay: `${(i % 10) * 120}ms` }} />
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </main>
  );
}
