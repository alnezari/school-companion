"use client";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useLang } from "@/lib/lang";
import { t, DAY_NAMES7 } from "@/lib/i18n";
import { todayISO, formatDate, TZ } from "@/lib/schedule";
import { loadSettings } from "@/lib/data";
import { LangToggle } from "@/components/LangToggle";
import {
  CATEGORY_COLOR, addDayItem, blocksFor, configFrom, dayWindow, fmt, loadActivities, loadBlocks, loadDayItems, loadSkips, loadStarsTotal,
  markDone, moveDayItem, removeDayItem, subscribeDayItems, toMin, toTime, type Activity, type DayConfig, type DayItem, type FixedBlock,
} from "@/lib/day";

const PX = 2.4; // pixels per minute
const SNAP = 5;
/** One card on the timeline: a fixed block (locked) or something he added himself. */
interface Card { key: string; start: number; minutes: number; name: string; icon: string; color: string; stars: number; locked: boolean; opensSchool: boolean; item: DayItem | null; block: FixedBlock | null; activity: Activity | null }

function nowMinutes() {
  const p = new Intl.DateTimeFormat("en-GB", { timeZone: TZ, hour: "2-digit", minute: "2-digit", hour12: false }).formatToParts(new Date());
  const h = Number(p.find((x) => x.type === "hour")?.value ?? 0), m = Number(p.find((x) => x.type === "minute")?.value ?? 0);
  return (h % 24) * 60 + m;
}

export default function DayPage() {
  const [lang, setLang] = useLang("kid");
  const d = t(lang);
  const [date, setDate] = useState<string | null>(null);
  const [now, setNow] = useState(0);
  useEffect(() => {
    const tick = () => { setDate(todayISO()); setNow(nowMinutes()); };
    tick(); const id = setInterval(tick, 30_000); return () => clearInterval(id);
  }, []);

  const [cfg, setCfg] = useState<DayConfig | null>(null);
  const [name, setName] = useState("");
  const [activities, setActivities] = useState<Activity[]>([]);
  const [blocks, setBlocks] = useState<FixedBlock[]>([]);
  const [skips, setSkips] = useState<Set<string>>(new Set());
  const [items, setItems] = useState<DayItem[]>([]);
  const [total, setTotal] = useState(0);
  const [gap, setGap] = useState<{ start: number; end: number } | null>(null);
  const [pick, setPick] = useState<Activity | null>(null);
  const [burst, setBurst] = useState<string | null>(null);

  const refresh = useCallback(async (iso: string) => {
    const [it, tot] = await Promise.all([loadDayItems(iso), loadStarsTotal()]);
    setItems(it); setTotal(tot);
  }, []);
  useEffect(() => {
    if (!date) return;
    (async () => {
      const [s, a, b, sk] = await Promise.all([loadSettings(), loadActivities(), loadBlocks(), loadSkips(date)]);
      setCfg(configFrom(s)); setName(s.child_name || "Taym"); setActivities(a.filter((x) => x.active)); setBlocks(b); setSkips(sk);
      await refresh(date);
    })();
    return subscribeDayItems(date, () => refresh(date));
  }, [date, refresh]);

  const win = cfg && date ? dayWindow(cfg, date) : null;
  const cards = useMemo<Card[]>(() => {
    if (!date) return [];
    const nm = (o: { name_en: string; name_ar: string }) => (lang === "ar" ? o.name_ar : o.name_en) || o.name_en;
    const out: Card[] = [];
    for (const b of blocksFor(blocks, date, skips)) {
      const item = items.find((i) => i.block_id === b.id) ?? null;
      out.push({ key: `b-${b.id}`, start: toMin(b.start_time), minutes: b.minutes, name: nm(b), icon: b.icon, color: CATEGORY_COLOR[b.category], stars: b.stars, locked: true, opensSchool: b.opens_school, item, block: b, activity: null });
    }
    for (const i of items) {
      if (!i.activity_id) continue;
      const a = activities.find((x) => x.id === i.activity_id); if (!a) continue;
      out.push({ key: `i-${i.id}`, start: toMin(i.start_time), minutes: i.minutes, name: nm(a), icon: a.icon, color: CATEGORY_COLOR[a.category], stars: a.stars, locked: false, opensSchool: false, item: i, block: null, activity: a });
    }
    return out.sort((x, y) => x.start - y.start);
  }, [date, lang, blocks, skips, items, activities]);
  const todayStars = cards.reduce((n, c) => n + (c.item?.done_at ? c.stars : 0), 0);
  const usedBy = (a: Activity) => items.filter((i) => i.activity_id === a.id).reduce((n, i) => n + i.minutes, 0);

  // ----- drag: kid cards only, snap to 5 minutes, never overlap, stay inside the window -----
  const drag = useRef<{ key: string; y0: number; start0: number } | null>(null);
  const [ghost, setGhost] = useState<{ key: string; start: number } | null>(null);
  const fits = (key: string, start: number, minutes: number) => !!win && start >= win.start && start + minutes <= win.end && !cards.some((c) => c.key !== key && start < c.start + c.minutes && c.start < start + c.minutes);
  function onDown(e: React.PointerEvent, c: Card) {
    if (c.locked || c.item?.done_at) return;
    drag.current = { key: c.key, y0: e.clientY, start0: c.start };
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
  }
  function onMove(e: React.PointerEvent) {
    if (!drag.current) return;
    const s = drag.current.start0 + Math.round((e.clientY - drag.current.y0) / PX / SNAP) * SNAP;
    setGhost({ key: drag.current.key, start: s });
  }
  async function onUp() {
    const g = ghost, dr = drag.current; drag.current = null; setGhost(null);
    if (!g || !dr) return;
    const c = cards.find((x) => x.key === g.key); if (!c || !c.item || g.start === c.start) return;
    if (!fits(c.key, g.start, c.minutes)) return;
    setItems((it) => it.map((i) => (i.id === c.item!.id ? { ...i, start_time: toTime(g.start) } : i)));
    await moveDayItem(c.item.id, g.start);
  }

  // ----- gaps: tap a free stretch to add -----
  const gaps = useMemo(() => {
    if (!win) return [];
    const out: { start: number; end: number }[] = []; let cur = win.start;
    for (const c of cards) { if (c.start - cur >= SNAP) out.push({ start: cur, end: c.start }); cur = Math.max(cur, c.start + c.minutes); }
    if (win.end - cur >= SNAP) out.push({ start: cur, end: win.end });
    return out;
  }, [cards, win]);
  async function add(a: Activity, minutes: number) {
    if (!date || !gap) return;
    const row = await addDayItem(date, a.id, gap.start, minutes);
    if (row) setItems((it) => [...it, row]);
    setGap(null); setPick(null);
  }
  async function done(c: Card, v: boolean) {
    if (!date) return;
    const row = await markDone(date, c.item ? { id: c.item.id, start_time: c.item.start_time, minutes: c.minutes } : { block_id: c.block!.id, start_time: c.block!.start_time, minutes: c.minutes }, v);
    if (row) { setItems((it) => (it.some((i) => i.id === row.id) ? it.map((i) => (i.id === row.id ? { ...i, done_at: row.done_at } : i)) : [...it, { ...row, start_time: row.start_time.slice(0, 5) }])); if (v) { setBurst(c.key); setTimeout(() => setBurst(null), 900); } }
  }
  async function remove(c: Card) { if (!c.item) return; setItems((it) => it.filter((i) => i.id !== c.item!.id)); await removeDayItem(c.item.id); }

  const H = win ? (win.end - win.start) * PX : 0;
  const y = (m: number) => (win ? (m - win.start) * PX : 0);
  const labels = useMemo(() => { if (!win) return []; const out: number[] = []; for (let m = Math.ceil(win.start / 30) * 30; m <= win.end; m += 30) out.push(m); return out; }, [win]);
  const weekday = date ? new Date(date + "T12:00:00Z").getUTCDay() : 0;

  return (
    <main className="min-h-dvh bg-[#EAF4FF] px-4 pb-8 pt-4 sm:px-6 lg:px-10">
      <header className="mx-auto flex max-w-4xl items-start justify-between gap-3">
        <div>
          <h1 className="font-display text-3xl font-extrabold sm:text-4xl">🗓️ {d.myDay}</h1>
          <p className="text-lg text-ink-2">{date && <><b className="text-ink">{DAY_NAMES7[lang][weekday]}</b>, {formatDate(date, lang)}</>}</p>
        </div>
        <div className="flex items-center gap-2">
          <span className="rounded-full bg-white px-3 py-1.5 font-display font-extrabold shadow-sm">⭐ {todayStars} <span className="font-body text-sm font-semibold text-ink-2">{d.todayStars}</span></span>
          <LangToggle lang={lang} setLang={setLang} />
        </div>
      </header>

      {!win ? <p className="mx-auto mt-10 max-w-4xl text-center text-ink-2">…</p> : (
        <div className="mx-auto mt-4 max-w-4xl rounded-3xl bg-white p-3 shadow-sm sm:p-5">
          {cards.filter((c) => !c.locked).length === 0 && <p className="mb-2 rounded-2xl bg-[#EAF4FF] px-4 py-2 text-center font-display font-bold text-accent">{d.nothingPlanned}</p>}
          <div className="relative" style={{ height: H + 16 }}>
            {labels.map((m) => (
              <div key={m} className="absolute inset-x-0 flex items-center gap-2" style={{ top: y(m) }}>
                <span className="w-12 shrink-0 text-end text-xs font-semibold text-ink-2">{fmt(m)}</span>
                <span className="h-px flex-1 bg-line" />
              </div>
            ))}
            <div className="absolute inset-y-0 start-14 end-0">
              {gaps.map((g) => (
                <button key={g.start} onClick={() => setGap(g)} className="absolute inset-x-0 rounded-2xl border-2 border-dashed border-transparent text-sm font-bold text-accent/70 transition hover:border-accent/40 hover:bg-[#EAF4FF]"
                  style={{ top: y(g.start) + 2, height: (g.end - g.start) * PX - 4 }}>
                  {(g.end - g.start) >= 20 && <>＋ {d.addHere}</>}
                </button>
              ))}
              {cards.map((c) => {
                const start = ghost?.key === c.key ? ghost.start : c.start;
                const isDone = !!c.item?.done_at, canDo = now >= c.start && !isDone, bad = ghost?.key === c.key && !fits(c.key, start, c.minutes);
                const short = c.minutes * PX < 44;
                return (
                  <div key={c.key} onPointerDown={(e) => onDown(e, c)} onPointerMove={onMove} onPointerUp={onUp} onPointerCancel={onUp}
                    className={`absolute inset-x-0 flex select-none items-center gap-2 overflow-hidden rounded-2xl border-2 px-3 text-white shadow-sm ${c.locked ? "" : "touch-none"} ${isDone ? "opacity-60" : ""} ${ghost?.key === c.key ? "z-20 scale-[1.02] shadow-xl" : ""}`}
                    style={{ top: y(start) + 2, height: c.minutes * PX - 4, background: c.color, borderColor: bad ? "#C8321E" : "rgba(255,255,255,.5)", transition: ghost?.key === c.key ? "none" : "top .15s" }}>
                    <span className={short ? "text-lg" : "text-2xl"}>{c.icon}</span>
                    <div className="min-w-0 flex-1 leading-tight">
                      <div className={`truncate font-display font-extrabold ${short ? "text-sm" : ""} ${isDone ? "line-through" : ""}`} dir="auto">{c.name}{c.locked && <span className="ms-1 text-xs font-semibold opacity-80">🔒</span>}</div>
                      {!short && <div className="text-xs opacity-90">{fmt(c.start)} · {c.minutes} {d.minutes}{c.stars > 0 && <> · {"⭐".repeat(Math.min(c.stars, 3))}</>}</div>}
                    </div>
                    {c.opensSchool && !isDone && <Link href="/school" onPointerDown={(e) => e.stopPropagation()} className="rounded-full bg-white/25 px-3 py-1 text-xs font-bold">📚 {d.tomorrow}</Link>}
                    {isDone ? <span className={burst === c.key ? "pop text-2xl" : "text-2xl"}>⭐</span>
                      : canDo ? <button onPointerDown={(e) => e.stopPropagation()} onClick={() => done(c, true)} className="rounded-full bg-white px-3 py-1 font-display text-sm font-extrabold" style={{ color: c.color }}>✓ {d.doneStar}</button>
                      : !c.locked && <button onPointerDown={(e) => e.stopPropagation()} onClick={() => remove(c)} aria-label={d.remove} className="rounded-full bg-white/25 px-2 py-0.5 text-sm font-bold">✕</button>}
                  </div>
                );
              })}
              {now >= win.start && now <= win.end && (
                <div className="pointer-events-none absolute -inset-x-2 z-30 flex items-center" style={{ top: y(now) }}>
                  <span className="h-3 w-3 rounded-full bg-red" /><span className="h-0.5 flex-1 bg-red" /><span className="rounded-full bg-red px-2 text-[10px] font-bold text-white">{fmt(now)}</span>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      <p className="mx-auto mt-3 max-w-4xl text-center text-sm text-ink-2">⭐ {total} · {name}</p>
      <nav className="mx-auto mt-3 flex max-w-4xl gap-2">
        <Link href="/" className="rounded-2xl bg-white px-4 py-3 text-center font-display text-lg font-extrabold">🏠</Link>
        <Link href="/school" className="flex-1 rounded-2xl bg-white py-3 text-center font-display text-lg font-extrabold">📚 {d.schoolApp}</Link>
        <span className="flex-1 rounded-2xl bg-accent py-3 text-center font-display text-lg font-extrabold text-white">🗓️ {d.myDay}</span>
      </nav>

      {gap && (
        <div className="fixed inset-0 z-40 flex items-end justify-center bg-black/40 sm:items-center" onClick={() => { setGap(null); setPick(null); }}>
          <div onClick={(e) => e.stopPropagation()} className="rise max-h-[88dvh] w-full max-w-2xl overflow-y-auto rounded-t-3xl bg-white p-5 shadow-2xl sm:rounded-3xl">
            <div className="flex items-center justify-between">
              <h2 className="font-display text-xl font-extrabold">{pick ? `${pick.icon} ${d.pickLength}` : `🧺 ${d.addToDay}`}</h2>
              <span className="rounded-full bg-paper px-3 py-1 text-sm font-semibold text-ink-2">{fmt(gap.start)} → {fmt(gap.end)}</span>
            </div>
            {!pick ? (
              <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-3">
                {activities.map((a) => {
                  const left = a.max_minutes_per_day != null ? Math.max(0, a.max_minutes_per_day - usedBy(a)) : null;
                  const room = Math.min(gap.end - gap.start, left ?? Infinity);
                  const ok = a.durations.some((m) => m <= room);
                  return (
                    <button key={a.id} disabled={!ok} onClick={() => setPick(a)} className="flex items-center gap-3 rounded-2xl border-2 p-3 text-start disabled:opacity-40" style={{ borderColor: CATEGORY_COLOR[a.category] }}>
                      <span className="grid h-11 w-11 shrink-0 place-items-center rounded-xl text-2xl text-white" style={{ background: CATEGORY_COLOR[a.category] }}>{a.icon}</span>
                      <span className="min-w-0">
                        <span className="block truncate font-display font-extrabold" dir="auto">{lang === "ar" ? a.name_ar : a.name_en}</span>
                        <span className="block text-xs text-ink-2">{a.stars > 0 ? "⭐".repeat(Math.min(a.stars, 3)) : d.cats[a.category]}{left != null && <> · {left} {d.minutes} {d.leftToday}</>}</span>
                      </span>
                    </button>
                  );
                })}
              </div>
            ) : (
              <div className="mt-4">
                <button onClick={() => setPick(null)} className="text-sm font-semibold text-ink-2">← {d.basket}</button>
                <div className="mt-3 flex flex-wrap gap-3">
                  {pick.durations.map((m) => {
                    const left = pick.max_minutes_per_day != null ? pick.max_minutes_per_day - usedBy(pick) : Infinity;
                    const ok = m <= gap.end - gap.start && m <= left;
                    return <button key={m} disabled={!ok} onClick={() => add(pick, m)} className="rounded-2xl px-6 py-4 font-display text-2xl font-extrabold text-white disabled:opacity-30" style={{ background: CATEGORY_COLOR[pick.category] }}>{m} <span className="text-base">{d.minutes}</span></button>;
                  })}
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </main>
  );
}
