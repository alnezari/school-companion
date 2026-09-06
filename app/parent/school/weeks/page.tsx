"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useLang } from "@/lib/lang";
import { t } from "@/lib/i18n";
import { todayISO, addDays, formatDate } from "@/lib/schedule";
import { loadSettings, loadWeeks, type WeekSummary } from "@/lib/data";
import { weekNumberFor, weekStartOf } from "@/lib/weeks";
import { ParentNav } from "@/components/ParentNav";
import { isParentUnlocked } from "@/components/ParentGate";

/** Every week of the term so far, whether its documents have arrived or not. */
export default function WeeksPage() {
  const router = useRouter();
  const [lang] = useLang("parent");
  const d = t(lang);
  const [weeks, setWeeks] = useState<WeekSummary[] | null>(null);
  const [week1, setWeek1] = useState<string | null>(null);
  const [today, setToday] = useState("");
  useEffect(() => { if (!isParentUnlocked()) router.replace("/"); }, [router]);
  useEffect(() => { setToday(todayISO()); loadWeeks().then(setWeeks); loadSettings().then((s) => setWeek1(s.school_week1_start || "")); }, []);

  const current = week1 && today ? weekNumberFor(today, week1) ?? 0 : 0;
  const upto = week1 && today ? Math.max(current, weekNumberFor(addDays(today, 1), week1) ?? 0) : 0;
  const numbers = Array.from({ length: upto }, (_, i) => upto - i);

  return (
    <main className="min-h-dvh px-3 pb-10 pt-3 sm:px-6">
      <div className="mx-auto max-w-3xl">
        <div className="flex items-center gap-2">
          <h1 className="font-display text-xl font-extrabold">🗂 {d.weeks}</h1>
          <span className="ms-auto"><Link href="/parent" className="rounded-full border border-line bg-white px-3 py-1.5 text-sm font-semibold">🏠</Link></span>
        </div>
        <ParentNav active="weeks" d={d} />
        {!weeks || week1 === null ? <p className="mt-6 text-center text-ink-2">…</p> : numbers.length === 0 ? (
          <p className="mt-6 rounded-2xl bg-white p-6 text-center text-ink-2">{week1 ? d.noWeeks : d.noFolders}</p>
        ) : (
          <div className="mt-3 grid gap-1.5">
            {numbers.map((n) => {
              const start = weekStartOf(n, week1!);
              const w = weeks.find((x) => x.week_number === n) ?? null;
              const isNow = n === current;
              return (
                <Link key={n} href={isNow ? "/parent/school" : `/parent/school?week=${start}`}
                  className={`flex items-center gap-2 rounded-xl border bg-white px-3 py-2 text-sm ${isNow ? "border-accent" : "border-line"}`}>
                  <span className={`h-2.5 w-2.5 shrink-0 rounded-full ${w ? "bg-green" : "bg-line"}`} />
                  <b>{d.parentTitle} {n}</b>
                  <span className="text-ink-2">{formatDate(start, lang)} – {formatDate(addDays(start, 4), lang)}</span>
                  <span className="ms-auto text-xs text-ink-2">
                    {isNow && <span className="me-1 rounded-full bg-accent-soft px-2 py-0.5 font-bold text-accent">{d.today}</span>}
                    {w ? `${d.fetched} ${formatDate(w.created_at.slice(0, 10), lang)}` : `⏳ ${d.waiting}`}
                  </span>
                </Link>
              );
            })}
          </div>
        )}
      </div>
    </main>
  );
}
