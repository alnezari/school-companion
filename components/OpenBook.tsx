"use client";
import { motion } from "motion/react";
import { SPRING, DUR, EASE_MOVE } from "@/lib/motion";
import type { Entry } from "@/lib/data";
import type { Period } from "@/lib/placement";
import { SUBJECTS, subjectName, type SubjectKey } from "@/lib/subjects";
import type { Dict } from "@/lib/i18n";

function hostOf(l: string) { try { return new URL(l).hostname; } catch { return l; } }
export type Feeling = "easy" | "ok" | "hard";
type Props = { layoutId: string; period: Period; entry: Entry | null; done: boolean; d: Dict; onClose: () => void; onFinish: (f: Feeling) => void; onUndo: () => void };

const stop = (e: React.SyntheticEvent) => e.stopPropagation();

/**
 * The book, opened. It grows out of its cover (shared layoutId) and lies on a dimmed page:
 * the cover on the left page, the lesson on the right. Tapping anywhere closes it — the only other
 * thing to tap is one of the three faces ("I finished, and that's how it felt").
 */
export function OpenBook({ layoutId, period, entry, done, d, onClose, onFinish, onUndo }: Props) {
  const meta = SUBJECTS[period.subject_key as SubjectKey];
  const Part = ({ label, text, big = false, red = false }: { label: string; text: string | null; big?: boolean; red?: boolean }) =>
    !text ? null : (
      <section className={`rounded-2xl p-4 ${red ? "bg-red-soft" : "bg-paper"}`}>
        <div className={`text-xs font-bold uppercase tracking-wider ${red ? "text-red" : "text-ink-2"}`}>{label}</div>
        <p dir="auto" className={`mt-1 whitespace-pre-wrap ${big ? "font-display text-2xl font-extrabold" : ""}`}>{text}</p>
      </section>
    );
  const title = [entry?.topic, entry?.lesson].filter(Boolean).join(" — ");
  const fade = { initial: { opacity: 0 }, animate: { opacity: 1 }, exit: { opacity: 0, transition: { duration: DUR.fast } }, transition: { duration: DUR.base, delay: 0.12 } };

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0, transition: { duration: DUR.base, ease: EASE_MOVE } }} transition={{ duration: DUR.base }}
      onClick={onClose} className="fixed inset-0 z-40 flex flex-col items-center justify-center bg-ink/45 p-3 sm:p-6">
      <motion.div layoutId={layoutId} transition={{ layout: SPRING.gentle }} style={{ borderRadius: 24, background: meta.color }}
        className="grid max-h-[86dvh] w-full max-w-3xl cursor-pointer overflow-y-auto overscroll-contain shadow-2xl sm:grid-cols-[minmax(0,2fr)_minmax(0,3fr)]">
        {/* left page: the cover, inside */}
        <motion.div {...fade} className="relative flex flex-col items-center justify-center gap-2 p-6 text-center text-white sm:sticky sm:top-0 sm:min-h-[420px]">
          <span className="grid h-10 w-10 place-items-center rounded-xl bg-white/25 font-display text-lg font-extrabold">{period.slot}</span>
          <span className="mt-1 text-6xl drop-shadow">{meta.icon}</span>
          <div dir="auto" className="font-display text-2xl font-extrabold leading-tight">{subjectName(period.subject_key)}</div>
          <div className="text-sm text-white/80">{period.start_time.slice(0, 5)} – {period.end_time.slice(0, 5)}</div>
          <span className="pointer-events-none absolute inset-y-0 end-0 hidden w-5 sm:block rtl:rotate-180" style={{ background: "linear-gradient(90deg, transparent, rgba(0,0,0,.18))" }} />
        </motion.div>

        {/* right page: the lesson */}
        <motion.div {...fade} className="rounded-t-3xl bg-white p-5 sm:rounded-s-none sm:rounded-e-3xl">
          <div className="grid gap-3">
            {entry ? (
              <>
                <Part label={d.lessonAbout} text={title || entry.raw_text} />
                <Part label={d.pages} text={entry.pages} big />
                <Part label={d.canDo} text={entry.objectives} />
                <Part label={d.activity} text={entry.activity} />
                {entry.links.length > 0 && (
                  <section className="rounded-2xl bg-paper p-4">
                    <div className="text-xs font-bold uppercase tracking-wider text-ink-2">{d.links}</div>
                    <div className="mt-2 flex flex-wrap gap-2">
                      {entry.links.map((l) => <a key={l} href={l} target="_blank" rel="noreferrer" onClick={stop} className="rounded-xl bg-accent px-3 py-2 text-sm font-semibold text-white">▶ {hostOf(l)}</a>)}
                    </div>
                  </section>
                )}
                <Part label={d.homeworkTitle} text={entry.homework} red />
                {entry.independent_practice && entry.independent_practice !== entry.homework && <Part label={d.practice} text={entry.independent_practice} />}
                <Part label="" text={entry.extra} />
              </>
            ) : (
              <section className="rounded-2xl bg-paper p-5 text-center text-lg font-semibold">🎒 {d.emptyCard}</section>
            )}
          </div>

          <div className="mt-5 border-t border-line pt-4">
            {done ? (
              <div className="text-center">
                <div className="pop text-5xl">⭐</div>
                <div className="font-display text-xl font-extrabold">{d.markedDone}</div>
                <button onClick={(e) => { stop(e); onUndo(); }} className="mt-2 text-sm text-ink-2 underline">{d.undo}</button>
              </div>
            ) : (
              <>
                <div className="text-center font-display text-xl font-extrabold">{d.finishedHow}</div>
                <div className="mt-3 grid grid-cols-3 gap-2">
                  {([["easy", "😄", d.feelEasy, d.feelEasySub], ["ok", "🙂", d.feelOk, d.feelOkSub], ["hard", "😕", d.feelHard, d.feelHardSub]] as const).map(([k, face, label, sub], i) => (
                    <motion.button key={k} initial={{ scale: 0.6, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} transition={{ ...SPRING.gentle, delay: 0.25 + i * 0.06 }} whileTap={{ scale: 0.94 }}
                      onClick={(e) => { stop(e); onFinish(k); }} className="rounded-2xl border-2 border-line bg-paper px-2 py-4 text-center">
                      <div className="text-4xl">{face}</div>
                      <div className="mt-1 font-display text-lg font-extrabold">{label}</div>
                      <div className="text-xs text-ink-2">{sub}</div>
                    </motion.button>
                  ))}
                </div>
              </>
            )}
          </div>
        </motion.div>
      </motion.div>
      <motion.p initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.6 }} className="mt-3 text-sm text-white/80">{d.tapToClose}</motion.p>
    </motion.div>
  );
}
