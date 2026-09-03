"use client";
import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useLang } from "@/lib/lang";
import { t } from "@/lib/i18n";
import { LangToggle } from "@/components/LangToggle";
import { loadAllPeriodCounts, loadAllProgress, loadSettings, type ProgressWithWeek } from "@/lib/data";
import { addDays, todayISO, weekday, formatDate } from "@/lib/schedule";

// Always encouraging: counts stars, full days, full weeks and streaks. Never scores, never "behind", never what comes later.
export default function StarsPage() {
  const [lang, setLang] = useLang("kid");
  const d = t(lang);
  const [rows, setRows] = useState<ProgressWithWeek[] | null>(null);
  const [counts, setCounts] = useState<Record<string, number>>({});
  const [name, setName] = useState("");
  useEffect(() => {
    Promise.all([loadAllProgress(), loadAllPeriodCounts(), loadSettings()]).then(([r, c, s]) => { setRows(r); setCounts(c); setName(s.child_name || ""); });
  }, []);

  const stats = useMemo(() => {
    if (!rows) return null;
    const byDay = new Map<string, { done: number; total: number; week: string }>();
    for (const r of rows) {
      if (!r.weeks) continue;
      const date = addDays(r.weeks.start_date, r.day);
      const total = counts[`${r.weeks.timetable_id}-${r.day}`] ?? 8;
      const cur = byDay.get(date) ?? { done: 0, total, week: r.weeks.start_date };
      cur.done += 1;
      byDay.set(date, cur);
    }
    const days = [...byDay.entries()].sort(([a], [b]) => (a < b ? -1 : 1));
    const fullDays = days.filter(([, v]) => v.done >= v.total).length;
    const byWeek = new Map<string, { stars: number; fullDays: number }>();
    for (const [, v] of days) {
      const w = byWeek.get(v.week) ?? { stars: 0, fullDays: 0 };
      w.stars += v.done; if (v.done >= v.total) w.fullDays += 1;
      byWeek.set(v.week, w);
    }
    const fullWeeks = [...byWeek.values()].filter((w) => w.fullDays >= 5).length;
    // Streak: consecutive school days (Fri/Sat skipped) with at least one star, ending at the last active day.
    let streak = 0;
    if (days.length) {
      let cursor = days[days.length - 1][0];
      const active = new Set(days.map(([k]) => k));
      const last = todayISO();
      if (cursor <= last) {
        while (active.has(cursor)) {
          streak += 1;
          do { cursor = addDays(cursor, -1); } while (weekday(cursor) >= 5);
        }
      }
    }
    const weeks = [...byWeek.entries()].sort(([a], [b]) => (a < b ? -1 : 1)).slice(-6);
    return { stars: rows.length, fullDays, fullWeeks, streak, weeks };
  }, [rows, counts]);

  const max = Math.max(1, ...(stats?.weeks.map(([, w]) => w.stars) ?? [1]));

  return (
    <main className="min-h-dvh bg-kid px-4 pb-8 pt-4 sm:px-6 lg:px-10">
      <header className="mx-auto flex max-w-6xl items-start justify-between gap-3">
        <h1 className="font-display text-3xl font-extrabold sm:text-4xl">⭐ {d.starsTitle}{name ? ` · ${name}` : ""}</h1>
        <LangToggle lang={lang} setLang={setLang} />
      </header>

      {!stats ? <p className="mt-10 text-center text-ink-2">…</p> : (
        <div className="mx-auto max-w-6xl">
          <div className="rise mt-4 rounded-3xl bg-white p-6 text-center shadow-sm">
            <div className="pop font-display text-7xl font-extrabold text-[#F27D26]">{stats.stars}</div>
            <div className="text-lg font-semibold text-ink-2">{d.totalStars}</div>
            <p className="mt-2 text-ink-2">{stats.stars === 0 ? d.noStarsYet : d.keepGoing}</p>
          </div>
          <div className="mt-3 grid grid-cols-3 gap-3">
            {[["🏆", stats.fullDays, d.fullDays], ["🏅", stats.fullWeeks, d.fullWeeks], ["🔥", stats.streak, d.streak]].map(([icon, n, label], i) => (
              <div key={i} className="rise rounded-3xl bg-white p-4 text-center shadow-sm" style={{ animationDelay: `${i * 80}ms` }}>
                <div className="text-4xl">{icon}</div>
                <div className="font-display text-3xl font-extrabold">{n}</div>
                <div className="text-sm font-semibold text-ink-2">{label}</div>
              </div>
            ))}
          </div>
          {stats.weeks.length > 0 && (
            <div className="mt-3 rounded-3xl bg-white p-5 shadow-sm">
              <div className="font-display text-lg font-extrabold">{d.starsPerWeek}</div>
              <div className="mt-3 flex h-40 items-end gap-3">
                {stats.weeks.map(([start, w]) => (
                  <div key={start} className="flex flex-1 flex-col items-center gap-1">
                    <div className="font-display font-extrabold">{w.stars}</div>
                    <div className="w-full rounded-t-xl bg-[#F27D26]" style={{ height: `${Math.max(6, (w.stars / max) * 100)}%` }} />
                    <div className="text-[11px] text-ink-2">{formatDate(start, lang)}</div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      <nav className="mx-auto mt-6 flex max-w-6xl gap-2">
        <Link href="/" className="rounded-2xl bg-white px-4 py-3 text-center font-display text-lg font-extrabold">🏠</Link>
        <Link href="/school" className="flex-1 rounded-2xl bg-white py-3 text-center font-display text-lg font-extrabold">📚 {d.tomorrow}</Link>
        <span className="flex-1 rounded-2xl bg-[#F27D26] py-3 text-center font-display text-lg font-extrabold text-white">⭐ {d.stars}</span>
      </nav>
    </main>
  );
}
