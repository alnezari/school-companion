"use client";
import { useState } from "react";
import type { Entry } from "@/lib/data";
import type { Period } from "@/lib/placement";
import { SUBJECTS, type SubjectKey } from "@/lib/subjects";
import type { Dict, Lang } from "@/lib/i18n";

function hostOf(l: string) { try { return new URL(l).hostname; } catch { return l; } }
export function LessonSheet({ period, entry, done, lang, d, onClose, onDone }:
  { period: Period; entry: Entry | null; done: boolean; lang: Lang; d: Dict; onClose: () => void; onDone: (done: boolean, feeling?: "easy" | "ok" | "hard") => void }) {
  const meta = SUBJECTS[period.subject_key as SubjectKey];
  const [step, setStep] = useState<"idle" | "studying" | "feeling">("idle");
  const Part = ({ label, text, big = false, red = false }: { label: string; text: string | null; big?: boolean; red?: boolean }) =>
    !text ? null : (
      <section className={`rounded-2xl p-4 ${red ? "bg-red-soft" : "bg-paper"}`}>
        <div className={`text-xs font-bold uppercase tracking-wider ${red ? "text-red" : "text-ink-2"}`}>{label}</div>
        <p dir="auto" className={`mt-1 whitespace-pre-wrap ${big ? "font-display text-2xl font-extrabold" : ""}`}>{text}</p>
      </section>
    );
  const title = [entry?.topic, entry?.lesson].filter(Boolean).join(" — ");

  return (
    <div className="fixed inset-0 z-40 flex items-end justify-center bg-black/40 sm:items-center" onClick={onClose}>
      <div onClick={(e) => e.stopPropagation()} className="max-h-[92dvh] w-full max-w-2xl overflow-y-auto rounded-t-3xl bg-white p-5 shadow-2xl sm:rounded-3xl rise">
        <div className="flex items-center gap-3">
          <span className="grid h-12 w-12 place-items-center rounded-2xl text-2xl text-white" style={{ background: meta.color }}>{meta.icon}</span>
          <div className="flex-1">
            <div className="font-display text-xl font-extrabold">{meta[lang]}</div>
            <div className="text-sm text-ink-2">{period.start_time.slice(0, 5)} – {period.end_time.slice(0, 5)}</div>
          </div>
          <button onClick={onClose} className="rounded-full bg-paper px-3 py-1 text-sm font-semibold">{d.close}</button>
        </div>

        <div className="mt-4 grid gap-3">
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
                    {entry.links.map((l) => <a key={l} href={l} target="_blank" rel="noreferrer" className="rounded-xl bg-accent px-3 py-2 text-sm font-semibold text-white">▶ {hostOf(l)}</a>)}
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

        <div className="mt-5">
          {done ? (
            <div className="text-center">
              <div className="pop text-5xl">⭐</div>
              <div className="font-display text-xl font-extrabold">{d.markedDone}</div>
              <button onClick={() => onDone(false)} className="mt-2 text-sm text-ink-2 underline">{d.undo}</button>
            </div>
          ) : step === "feeling" ? (
            <div className="rise">
              <div className="text-center font-display text-xl font-extrabold">{d.howFelt}</div>
              <div className="mt-3 grid grid-cols-3 gap-2">
                {([["easy", "😄", d.feelEasy, d.feelEasySub], ["ok", "🙂", d.feelOk, d.feelOkSub], ["hard", "😕", d.feelHard, d.feelHardSub]] as const).map(([k, face, label, sub]) => (
                  <button key={k} onClick={() => onDone(true, k)} className="rounded-2xl border-2 border-line bg-paper px-2 py-4 text-center active:scale-95">
                    <div className="text-4xl">{face}</div>
                    <div className="mt-1 font-display text-lg font-extrabold">{label}</div>
                    <div className="text-xs text-ink-2">{sub}</div>
                  </button>
                ))}
              </div>
            </div>
          ) : step === "studying" ? (
            <button onClick={() => setStep("feeling")} className="w-full rounded-2xl bg-green py-4 font-display text-xl font-extrabold text-white">✅ {d.done}</button>
          ) : (
            <button onClick={() => setStep("studying")} className="w-full rounded-2xl py-4 font-display text-xl font-extrabold text-white" style={{ background: meta.color }}>📖 {d.study}</button>
          )}
        </div>
      </div>
    </div>
  );
}
