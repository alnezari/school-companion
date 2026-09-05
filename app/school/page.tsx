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
import { LessonSheet } from "@/components/LessonSheet";

const lid = (slot: number) => `lesson-${slot}`;

/** A finished lesson is a little book: coloured cover, darker spine. Same element morphs from card to book to bag. */
function Book({ subjectKey, small = false, className = "", ...rest }: { subjectKey: string; small?: boolean; className?: string } & React.ComponentProps<typeof motion.div>) {
  const meta = SUBJECTS[subjectKey as SubjectKey];
  return (
    <motion.div {...rest} className={`flex select-none flex-col items-center justify-center rounded-e-lg rounded-s-sm text-white ${small ? "h-9 w-6 text-sm" : "h-20 w-14 gap-1"} ${className}`}
      style={{ background: meta.color, boxShadow: "inset 5px 0 0 rgba(0,0,0,.22), 0 3px 8px rgba(0,0,0,.18)", ...(rest.style as object) }}>
      <span className={small ? "" : "text-2xl"}>{meta.icon}</span>
      {!small && <span dir="auto" className="max-w-full truncate px-1 font-display text-[10px] font-extrabold leading-tight">{subjectName(subjectKey)}</span>}
    </motion.div>
  );
}

/** The bag arrives closed, opens its flap, takes the books one by one, then zips up. */
function Bag({ open, zipped, count, total, openingRef, onTapBag, children }: { open: boolean; zipped: boolean; count: number; total: number; openingRef: React.RefObject<HTMLDivElement | null>; onTapBag: () => void; children: React.ReactNode }) {
  return (
    <motion.div initial={{ y: 120, opacity: 0 }} animate={{ y: 0, opacity: 1 }} exit={{ y: 120, opacity: 0 }} transition={SPRING.gentle} className="relative mx-auto mt-3 h-[190px] w-[240px]" style={{ perspective: 600 }}>
      <motion.div key={`squash-${count}`} initial={{ scaleY: 0.92, scaleX: 1.04 }} animate={{ scaleY: 1, scaleX: 1 }} transition={SPRING.bouncy} className="absolute inset-0 origin-bottom" onClick={onTapBag}>
        <div className="absolute left-1/2 top-[-4px] h-10 w-24 -translate-x-1/2 rounded-t-[36px] border-[9px] border-b-0 border-[#17305F]" />
        <div className="absolute inset-x-0 bottom-0 top-8 rounded-[26px] bg-[#3B7DDD] shadow-[inset_0_-16px_0_rgba(0,0,0,.12),0_14px_28px_-16px_rgba(0,0,0,.5)]" />
        <div className="absolute inset-x-9 bottom-5 h-12 rounded-2xl bg-[#2457C5] shadow-[inset_0_3px_0_rgba(255,255,255,.15)]" />
        {/* the mouth: a dark pocket the books drop into; the flap covers it completely when closed */}
        <div ref={openingRef} onClick={(e) => e.stopPropagation()} className="absolute inset-x-5 top-9 flex h-14 items-end justify-center gap-1 overflow-hidden rounded-2xl bg-[#17305F] px-2 pb-1.5 shadow-[inset_0_6px_10px_rgba(0,0,0,.45)]">{children}</div>
        <motion.div initial={false} animate={{ scaleX: zipped ? 1 : 0 }} transition={{ duration: 0.4, ease: [0.645, 0.045, 0.355, 1] }} className="absolute inset-x-6 top-[74px] z-10 h-1 origin-left" style={{ background: "repeating-linear-gradient(90deg,#FFD84D 0 6px,transparent 6px 9px)" }} />
        <motion.div initial={false} animate={{ rotateX: open ? -78 : 0 }} transition={SPRING.gentle} className="absolute inset-x-2 top-0 z-20 h-[84px] origin-top rounded-[22px] shadow-[0_8px_12px_-8px_rgba(0,0,0,.45)]"
          style={{ background: "linear-gradient(#5A97F2,#4E8EF0 70%,#3E7BE0)", backfaceVisibility: "visible" }}>
          <div className="absolute bottom-3 left-1/2 h-2 w-7 -translate-x-1/2 rounded bg-[#FFD84D]" />
        </motion.div>
      </motion.div>
      <div className="absolute -bottom-6 inset-x-0 text-center font-display text-sm font-extrabold text-[#17305F]">🎒 {count}/{total}</div>
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
  useEffect(() => { if (!allDone) { setBagOpen(false); return; } const id = setTimeout(() => setBagOpen(true), 650); return () => clearTimeout(id); }, [allDone]);
  useEffect(() => { if (allPacked) { setReopen(false); const id = setTimeout(() => setCelebrate(true), 700); return () => clearTimeout(id); } }, [allPacked]);

  const openingRef = useRef<HTMLDivElement>(null);
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
    const r = openingRef.current?.getBoundingClientRect();
    if (r && info.point.x >= r.left - 16 && info.point.x <= r.right + 16 && info.point.y >= r.top - 40 && info.point.y <= r.bottom + 30) pack(slot, true);
  }
  async function mark(slot: number, done: boolean, feeling?: "easy" | "ok" | "hard") {
    if (!week) return;
    const row = await setProgress(week.id, day, slot, done, feeling ?? null);
    setProgressMap((m) => ({ ...m, [pkey(day, slot)]: row }));
    if (done) setTimeout(() => setOpenSlot(null), 700);
  }

  const name = settings.child_name || "Taym";
  const open = openSlot != null ? slots.find((s) => s.period.slot === openSlot) : null;
  const todo = slots.filter((s) => !st(s.period.slot)?.done_at);
  const finished = slots.filter((s) => st(s.period.slot)?.done_at && !st(s.period.slot)?.packed_at);
  const packed = slots.filter((s) => st(s.period.slot)?.packed_at);

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
              <motion.p {...enter(0)} className="inline-block rounded-2xl bg-white/80 px-4 py-2 font-display text-lg font-bold">
                📚 {slots.length} {d.classes}{hw > 0 && <> · <span className="text-red">{hw} {d.homework}</span></>}{prepare > 0 && <> · {prepare} {d.toPrepare}</>}
                {" · "}⭐ {doneCount}/{slots.length}
              </motion.p>
              <AnimatePresence mode="popLayout">
                {allPacked ? (
                  <motion.div key="ready" initial={{ scale: 0.8, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} transition={SPRING.bouncy} className="mt-3 rounded-2xl bg-green px-4 py-3 text-center font-display text-xl font-extrabold text-white">{d.allDone}</motion.div>
                ) : allDone ? (
                  <motion.div key="pack" {...enter(0)} className="mt-3 rounded-2xl bg-[#F27D26] px-4 py-3 text-center font-display text-xl font-extrabold text-white">{d.packTitle}<span className="block text-sm font-semibold opacity-90">{d.packHint} · {d.tapBookToo}</span></motion.div>
                ) : null}
              </AnimatePresence>
              <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3">
                {todo.map(({ period, entry }, i) => {
                  const meta = SUBJECTS[period.subject_key as SubjectKey];
                  const title = entry ? ([entry.lesson, entry.topic].find(Boolean) as string) || entry.raw_text.slice(0, 80) : d.emptyCard;
                  return (
                    <motion.button key={period.slot} layoutId={lid(period.slot)} layout {...enter(i + 1)} whileTap={TAP} onClick={() => setOpenSlot(period.slot)}
                      className="relative flex min-h-36 flex-col rounded-3xl border-4 bg-white p-4 text-start shadow-sm" style={{ borderColor: meta.color, borderRadius: 24 }}>
                      <div className="flex items-center gap-3">
                        <span className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl font-display text-xl font-extrabold text-white" style={{ background: meta.color }}>{period.slot}</span>
                        <span className="text-3xl">{meta.icon}</span>
                        <span className="ms-auto text-2xl text-line">☆</span>
                      </div>
                      <div className="mt-2 font-display text-lg font-extrabold leading-tight" dir="auto">{subjectName(period.subject_key)}</div>
                      <p dir="auto" className="mt-1 line-clamp-2 text-sm text-ink-2">{title}</p>
                      {entry?.homework && <span className="mt-2 inline-block w-fit rounded-full bg-red px-2.5 py-0.5 text-xs font-extrabold text-white">{d.homeworkTitle.toUpperCase()}</span>}
                    </motion.button>
                  );
                })}
              </div>
            </div>

            <aside className="lg:sticky lg:top-4 lg:self-start">
              <motion.section {...enter(1)} className="rounded-3xl bg-white/70 p-4">
                <div className="flex items-center justify-between"><h2 className="font-display font-extrabold">✅ {d.finished}</h2><span className="text-sm font-semibold text-ink-2">{doneCount}/{slots.length}</span></div>
                <div className="mt-3 flex min-h-[88px] flex-wrap items-end gap-3">
                  {finished.map(({ period }) => (
                    <Book key={period.slot} subjectKey={period.subject_key} layoutId={lid(period.slot)} layout
                      drag={allDone} dragSnapToOrigin dragElastic={0.6} dragMomentum={false} dragTransition={SPRING.spatial as object}
                      whileDrag={{ scale: 1.12, rotate: 5, zIndex: 50, boxShadow: "0 18px 30px -12px rgba(0,0,0,.4)" }} whileTap={{ scale: 0.95 }}
                      onDragEnd={(_e, info) => dropped(period.slot, info)} onTap={() => (allDone ? pack(period.slot, true) : setOpenSlot(period.slot))}
                      className={allDone ? "cursor-grab touch-none" : "cursor-pointer"} />
                  ))}
                  {finished.length === 0 && packed.length === 0 && <p className="text-sm text-ink-2">☆</p>}
                </div>
                <AnimatePresence>
                  {allDone && (
                    <Bag key="bag" open={bagOpen && (!allPacked || reopen)} zipped={allPacked && !reopen} count={packedCount} total={slots.length} openingRef={openingRef} onTapBag={() => allPacked && setReopen((r) => !r)}>
                      {packed.map(({ period }) => (
                        <Book key={period.slot} subjectKey={period.subject_key} layoutId={lid(period.slot)} layout small whileTap={{ y: -8 }} onTap={() => pack(period.slot, false)} className="cursor-pointer" />
                      ))}
                    </Bag>
                  )}
                </AnimatePresence>
                {allDone && <div className="h-6" />}
              </motion.section>
            </aside>
          </div>

          <AnimatePresence>
            {open && week && (
              <LessonSheet key="sheet" period={open.period} entry={open.entry} done={!!st(open.period.slot)?.done_at} lang={lang} d={d}
                onClose={() => setOpenSlot(null)} onDone={(v, f) => mark(open.period.slot, v, f)} />
            )}
          </AnimatePresence>
        </LayoutGroup>
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
