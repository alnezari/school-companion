"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useLang } from "@/lib/lang";
import { t } from "@/lib/i18n";
import { todayISO, weekStartFor, addDays, formatDate } from "@/lib/schedule";
import { loadWeeks, type WeekSummary } from "@/lib/data";
import { LangToggle } from "@/components/LangToggle";
import { ParentNav } from "@/components/ParentNav";
import { isParentUnlocked } from "@/components/ParentGate";

export default function WeeksPage() {
  const router = useRouter();
  const [lang, setLang] = useLang("parent");
  const d = t(lang);
  const [weeks, setWeeks] = useState<WeekSummary[] | null>(null);
  const [current, setCurrent] = useState("");
  useEffect(() => { if (!isParentUnlocked()) router.replace("/"); }, [router]);
  useEffect(() => { setCurrent(weekStartFor(todayISO())); loadWeeks().then(setWeeks); }, []);

  return (
    <main className="min-h-dvh px-3 pb-10 pt-3 sm:px-6">
      <div className="mx-auto max-w-3xl">
        <div className="flex items-center gap-2">
          <h1 className="font-display text-xl font-extrabold">🗂 {d.weeks}</h1>
          <LangToggle lang={lang} setLang={setLang} className="ms-auto" />
          <Link href="/" className="rounded-full border border-line bg-white px-3 py-1.5 text-sm font-semibold">🎒</Link>
        </div>
        <ParentNav active="weeks" d={d} />
        {!weeks ? <p className="mt-6 text-center text-ink-2">…</p> : weeks.length === 0 ? (
          <p className="mt-6 rounded-2xl bg-white p-6 text-center text-ink-2">{d.noWeeks}</p>
        ) : (
          <div className="mt-3 grid gap-2">
            {weeks.map((w) => {
              const pct = w.total ? Math.round((w.done / w.total) * 100) : 0;
              const isNow = w.start_date === current;
              const color = w.confidence === "green" ? "bg-green" : w.confidence === "orange" ? "bg-orange" : "bg-red";
              return (
                <Link key={w.id} href={isNow ? "/parent" : `/parent?week=${w.start_date}`}
                  className={`block rounded-2xl border bg-white p-3 ${isNow ? "border-accent ring-2 ring-accent/30" : "border-line"}`}>
                  <div className="flex items-center gap-2">
                    <span className={`h-3 w-3 shrink-0 rounded-full ${color}`} />
                    <b>{d.parentTitle} {w.week_number ?? "—"}</b>
                    <span className="text-sm text-ink-2">· {formatDate(w.start_date, lang)} – {formatDate(addDays(w.start_date, 4), lang)}</span>
                    {isNow && <span className="ms-auto rounded-full bg-accent-soft px-2 py-0.5 text-xs font-bold text-accent">{d.today}</span>}
                    {!isNow && w.start_date < current && <span className="ms-auto rounded-full bg-line px-2 py-0.5 text-xs font-bold text-ink-2">{d.past}</span>}
                  </div>
                  <div className="mt-2 h-2 overflow-hidden rounded-full bg-line"><div className="h-full bg-green" style={{ width: `${pct}%` }} /></div>
                  <div className="mt-1 flex justify-between text-xs text-ink-2 tabular-nums">
                    <span>{w.done}/{w.total} · {pct}% {d.completed}</span>
                    <span>{d.uploadedOn} {formatDate(w.created_at.slice(0, 10), lang)}</span>
                  </div>
                </Link>
              );
            })}
          </div>
        )}
      </div>
    </main>
  );
}
