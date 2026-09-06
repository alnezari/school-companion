"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useLang } from "@/lib/lang";
import { t } from "@/lib/i18n";
import { todayISO, weekStartFor, addDays, formatDate } from "@/lib/schedule";
import { loadWeeks, type WeekSummary } from "@/lib/data";
import { ParentNav } from "@/components/ParentNav";
import { isParentUnlocked } from "@/components/ParentGate";

export default function WeeksPage() {
  const router = useRouter();
  const [lang] = useLang("parent");
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
          <span className="ms-auto"><Link href="/parent" className="rounded-full border border-line bg-white px-3 py-1.5 text-sm font-semibold">🏠</Link></span>
        </div>
        <ParentNav active="weeks" d={d} />
        {!weeks ? <p className="mt-6 text-center text-ink-2">…</p> : weeks.length === 0 ? (
          <p className="mt-6 rounded-2xl bg-white p-6 text-center text-ink-2">{d.noWeeks}</p>
        ) : (
          <div className="mt-3 grid gap-1.5">
            {weeks.map((w) => {
              const isNow = w.start_date === current;
              const color = w.confidence === "green" ? "bg-green" : w.confidence === "orange" ? "bg-orange" : "bg-red";
              return (
                <Link key={w.id} href={isNow ? "/parent/school" : `/parent/school?week=${w.start_date}`}
                  className={`flex items-center gap-2 rounded-xl border bg-white px-3 py-2 text-sm ${isNow ? "border-accent" : "border-line"}`}>
                  <span className={`h-2.5 w-2.5 shrink-0 rounded-full ${color}`} />
                  <b>{d.parentTitle} {w.week_number ?? "—"}</b>
                  <span className="text-ink-2">{formatDate(w.start_date, lang)} – {formatDate(addDays(w.start_date, 4), lang)}</span>
                  <span className="ms-auto text-xs text-ink-2">
                    {isNow ? <span className="rounded-full bg-accent-soft px-2 py-0.5 font-bold text-accent">{d.today}</span>
                      : w.start_date < current ? <span className="rounded-full bg-line px-2 py-0.5 font-bold">{d.past}</span>
                      : `${d.uploadedOn} ${formatDate(w.created_at.slice(0, 10), lang)}`}
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
