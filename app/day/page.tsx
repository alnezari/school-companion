"use client";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useLang } from "@/lib/lang";
import { t, DAY_NAMES7 } from "@/lib/i18n";
import { todayISO, formatDate, fmt12, TZ } from "@/lib/schedule";
import { loadSettings } from "@/lib/data";
import { KidTop } from "@/components/KidTop";
import {
  addDayItem, catColor, configFrom, dayWindow, fixedFor, loadActivities, loadCategories, loadDayItems, loadDayStars, loadSkips, moveDayItem, removeDayItem,
  setDone, showsOn, subscribeDayItems, toMin, toTime, type Activity, type Category, type DayConfig, type DayItem,
} from "@/lib/day";

const PX = 1.5; // pixels per minute: a 30-minute block is 45px, two lines
const SNAP = 30; // everything moves in half-hour blocks
/** One card on the timeline. A fixed activity is placed by itself; anything else is a card he added. */
interface Card { key: string; activity: Activity; item: DayItem | null; start: number; minutes: number; locked: boolean; name: string; color: string }

function nowMinutes() {
  const p = new Intl.DateTimeFormat("en-GB", { timeZone: TZ, hour: "2-digit", minute: "2-digit", hour12: false }).formatToParts(new Date());
  const h = Number(p.find((x) => x.type === "hour")?.value ?? 0), m = Number(p.find((x) => x.type === "minute")?.value ?? 0);
  return (h % 24) * 60 + m;
}
/** Where the light changes: a small sun or moon next to the hour, nothing more. */
const MARKS: [number, string][] = [[6 * 60, "🌅"], [12 * 60, "☀️"], [17 * 60, "🌇"], [18 * 60 + 30, "🌙"]];
const markFor = (m: number) => MARKS.find(([at]) => at === m)?.[1];
/** One soft gradient behind the timeline: warm by day, cool at night. */
function skyGradient(start: number, end: number) {
  const pct = (m: number) => `${Math.min(100, Math.max(0, ((m - start) / (end - start)) * 100)).toFixed(1)}%`;
  return `linear-gradient(to bottom, #FFFBEA ${pct(start)}, #FFF4DF ${pct(17 * 60)}, #EEF1F9 ${pct(18 * 60 + 30)}, #E6EAF6 ${pct(end)})`;
}

export default function DayPage() {
  const [lang] = useLang("kid");
  const d = t(lang);
  const [date, setDate] = useState<string | null>(null);
  const [now, setNow] = useState(0);
  useEffect(() => {
    const tick = () => { setDate(todayISO()); setNow(nowMinutes()); };
    tick(); const id = setInterval(tick, 30_000); return () => clearInterval(id);
  }, []);

  const [cfg, setCfg] = useState<DayConfig | null>(null);
  const [cats, setCats] = useState<Category[]>([]);
  const [acts, setActs] = useState<Activity[]>([]);
  const [skips, setSkips] = useState<Set<string>>(new Set());
  const [items, setItems] = useState<DayItem[]>([]);
  const [total, setTotal] = useState<number | null>(null);
  const [gap, setGap] = useState<{ start: number; end: number } | null>(null);
  const [pick, setPick] = useState<Activity | null>(null);
  const [burst, setBurst] = useState<string | null>(null);

  const refresh = useCallback(async (iso: string) => {
    const [it, tot] = await Promise.all([loadDayItems(iso), loadDayStars()]);
    setItems(it); setTotal(tot);
  }, []);
  useEffect(() => {
    if (!date) return;
    (async () => {
      const [s, c, a, sk] = await Promise.all([loadSettings(), loadCategories(), loadActivities(), loadSkips(date)]);
      setCfg(configFrom(s)); setCats(c); setActs(a.filter((x) => x.active)); setSkips(sk);
      await refresh(date);
    })();
    return subscribeDayItems(date, () => refresh(date));
  }, [date, refresh]);

  const win = cfg && date ? dayWindow(cfg, date) : null;
  const nm = useCallback((a: Activity) => (lang === "ar" ? a.name_ar : a.name_en) || a.name_en, [lang]);
  const cards = useMemo<Card[]>(() => {
    if (!date) return [];
    const out: Card[] = [];
    for (const a of fixedFor(acts, date, skips)) {
      const item = items.find((i) => i.activity_id === a.id) ?? null;
      out.push({ key: a.id, activity: a, item, start: toMin(item?.start_time ?? a.start_time!), minutes: a.minutes ?? 30, locked: a.locked, name: nm(a), color: catColor(cats, a.category) });
    }
    for (const i of items) {
      const a = acts.find((x) => x.id === i.activity_id);
      if (!a || showsOn(a, date)) continue;
      out.push({ key: i.id, activity: a, item: i, start: toMin(i.start_time), minutes: i.minutes, locked: false, name: nm(a), color: catColor(cats, a.category) });
    }
    return out.sort((x, y) => x.start - y.start);
  }, [date, acts, skips, items, cats, nm]);
  const todayStars = cards.reduce((n, c) => n + (c.item?.done_at ? c.activity.stars : 0), 0);
  const usedBy = (a: Activity) => items.filter((i) => i.activity_id === a.id).reduce((n, i) => n + i.minutes, 0);
  const basket = acts.filter((a) => !a.fixed);
  const lengths = (a: Activity) => { const l = a.durations.filter((m) => m >= SNAP && m % SNAP === 0); return l.length ? l : [SNAP]; };

  // ----- time already gone: nothing new can be placed there, but two same-length past cards can swap places -----
  const earliestAddable = win ? Math.max(win.start, Math.ceil(now / SNAP) * SNAP) : 0;
  const drag = useRef<{ key: string; y0: number; start0: number } | null>(null);
  const [ghost, setGhost] = useState<{ key: string; start: number } | null>(null);
  const fits = useCallback((key: string, start: number, minutes: number) => {
    if (!win || start < win.start || start + minutes > win.end) return false;
    const overlapping = cards.filter((o) => o.key !== key && start < o.start + o.minutes && o.start < start + minutes);
    if (overlapping.length === 0) return start >= earliestAddable;
    if (overlapping.length === 1) {
      const other = overlapping[0];
      return start < earliestAddable && other.start < earliestAddable && other.minutes === minutes && !other.locked && !other.item?.done_at;
    }
    return false;
  }, [win, cards, earliestAddable]);
  function onDown(e: React.PointerEvent, c: Card) {
    if (c.locked || c.item?.done_at) return;
    drag.current = { key: c.key, y0: e.clientY, start0: c.start };
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
  }
  function onMove(e: React.PointerEvent) {
    if (!drag.current) return;
    setGhost({ key: drag.current.key, start: drag.current.start0 + Math.round((e.clientY - drag.current.y0) / PX / SNAP) * SNAP });
  }
  async function onUp() {
    const g = ghost; drag.current = null; setGhost(null);
    if (!g || !date) return;
    const c = cards.find((x) => x.key === g.key);
    if (!c || g.start === c.start || !fits(c.key, g.start, c.minutes)) return;
    const other = cards.find((o) => o.key !== c.key && g.start < o.start + o.minutes && o.start < g.start + c.minutes);
    const place = async (card: Card, start: number): Promise<DayItem | null> => {
      if (card.item) { await moveDayItem(card.item.id, start); return { ...card.item, start_time: toTime(start) }; }
      return addDayItem(date, card.activity.id, start, card.minutes); // a moved fixed activity remembers its new time for today
    };
    const updated = other ? await Promise.all([place(c, g.start), place(other, c.start)]) : [await place(c, g.start)];
    setItems((it) => {
      let next = it;
      for (const row of updated) if (row) next = next.some((i) => i.id === row.id) ? next.map((i) => (i.id === row.id ? row : i)) : [...next, row];
      return next;
    });
  }

  // ----- gaps: tap a free stretch to add from the basket. Never into time that has already gone. -----
  const gaps = useMemo(() => {
    if (!win) return [];
    const out: { start: number; end: number }[] = []; let cur = win.start;
    for (const c of cards) { if (c.start - cur >= SNAP) out.push({ start: cur, end: c.start }); cur = Math.max(cur, c.start + c.minutes); }
    if (win.end - cur >= SNAP) out.push({ start: cur, end: win.end });
    return out.map((g) => ({ start: Math.max(g.start, earliestAddable), end: g.end })).filter((g) => g.end - g.start >= SNAP);
  }, [cards, win, earliestAddable]);
  async function add(a: Activity, minutes: number) {
    if (!date || !gap) return;
    const row = await addDayItem(date, a.id, gap.start, minutes);
    if (row) setItems((it) => [...it, row]);
    setGap(null); setPick(null);
  }
  async function done(c: Card) {
    if (!date) return;
    let item = c.item;
    if (!item) { item = await addDayItem(date, c.activity.id, c.start, c.minutes); if (!item) return; }
    const stamped = { ...item, done_at: new Date().toISOString() };
    setItems((it) => (it.some((i) => i.id === stamped.id) ? it.map((i) => (i.id === stamped.id ? stamped : i)) : [...it, stamped]));
    setBurst(c.key); setTimeout(() => setBurst(null), 900);
    await setDone(item.id, true);
  }
  async function undo(c: Card) {
    if (!c.item) return;
    setItems((it) => it.map((i) => (i.id === c.item!.id ? { ...i, done_at: null } : i)));
    await setDone(c.item.id, false);
  }
  async function remove(c: Card) { if (!c.item) return; setItems((it) => it.filter((i) => i.id !== c.item!.id)); await removeDayItem(c.item.id); }

  const H = win ? (win.end - win.start) * PX : 0;
  const y = (m: number) => (win ? (m - win.start) * PX : 0);
  const labels = useMemo(() => { if (!win) return []; const out: number[] = []; for (let m = Math.ceil(win.start / 30) * 30; m <= win.end; m += 30) out.push(m); return out; }, [win]);
  const weekday = date ? new Date(date + "T12:00:00Z").getUTCDay() : 0;

  return (
    <main className="min-h-dvh bg-[#EAF4FF] px-4 pb-8 pt-4 sm:px-6 lg:px-10">
      <KidTop className="max-w-4xl" title={<>🗓️ {d.myDay}</>} stars={todayStars} sub={date && <><b className="text-ink">{DAY_NAMES7[lang][weekday]}</b>, {formatDate(date, lang)}</>} />

      {!win ? <p className="mx-auto mt-10 max-w-4xl text-center text-ink-2">…</p> : (
        <div className="mx-auto mt-4 max-w-4xl rounded-3xl bg-white p-3 shadow-sm sm:p-5">
          {cards.every((c) => c.locked) && basket.length > 0 && <p className="mb-2 rounded-2xl bg-[#EAF4FF] px-4 py-2 text-center font-display font-bold text-accent">{d.nothingPlanned}</p>}
          <div className="relative rounded-2xl" style={{ height: H + 12, background: skyGradient(win.start, win.end) }}>
            {labels.map((m) => (
              <div key={m} className="absolute inset-x-0 flex -translate-y-1/2 items-center gap-2" style={{ top: y(m) }}>
                <span className={`w-16 shrink-0 text-end tabular-nums ${m % 60 === 0 ? "text-xs font-bold text-ink" : "text-[10px] text-ink-2"}`}>{markFor(m) && <span className="me-1">{markFor(m)}</span>}{m % 60 === 0 ? fmt12(m, lang, true) : ":30"}</span>
                <span className={`h-px flex-1 ${m % 60 === 0 ? "bg-ink/15" : "bg-ink/5"}`} />
              </div>
            ))}
            <div className="absolute inset-y-0 start-[4.5rem] end-2">
              {gaps.map((g) => (
                <button key={g.start} onClick={() => setGap(g)} className="absolute inset-x-0 rounded-2xl border-2 border-dashed border-transparent text-sm font-bold text-accent/70 transition hover:border-accent/40"
                  style={{ top: y(g.start) + 2, height: (g.end - g.start) * PX - 4 }}>
                  {(g.end - g.start) >= 20 && basket.length > 0 && <>＋ {d.addHere}</>}
                </button>
              ))}
              {cards.map((c) => {
                const start = ghost?.key === c.key ? ghost.start : c.start;
                const isDone = !!c.item?.done_at, canDo = now >= c.start && !isDone, bad = ghost?.key === c.key && !fits(c.key, start, c.minutes);
                const clash = !c.locked && cards.some((o) => o.key !== c.key && o.activity.fixed && start < o.start + o.minutes && o.start < start + c.minutes);
                const gone = !isDone && now >= c.start + c.minutes; // its time passed without being done — stays as-is, just "to do" or delete
                const canRemove = !!c.item && !c.activity.fixed;
                return (
                  <div key={c.key} onPointerDown={(e) => onDown(e, c)} onPointerMove={onMove} onPointerUp={onUp} onPointerCancel={onUp}
                    className={`absolute inset-x-0 flex select-none items-center gap-2 overflow-hidden rounded-xl border-2 px-2.5 text-white shadow-sm ${c.locked ? "" : "touch-none"} ${ghost?.key === c.key ? "z-20 scale-[1.02] shadow-xl" : ""} ${isDone ? "opacity-55" : ""}`}
                    style={{ top: y(start) + 2, height: c.minutes * PX - 4, background: c.color, borderColor: bad || clash ? "#C8321E" : "rgba(255,255,255,.5)", transition: ghost?.key === c.key ? "none" : "top .15s", zIndex: clash ? 10 : undefined }}>
                    <span className="text-xl">{c.activity.icon}</span>
                    <div className="min-w-0 flex-1 leading-tight">
                      <div className="truncate font-display text-sm font-extrabold" dir="auto">{c.name}{c.locked && <span className="ms-1 text-xs opacity-80">🔒</span>}</div>
                      <div className="truncate text-[11px] opacity-90">{clash ? <span className="font-bold text-white"><span className="rounded bg-red px-1">{d.needsMove}</span></span> : gone ? <span className="font-bold">{d.gone}</span> : <>{fmt12(c.start, lang)} · {c.minutes} {d.minutes}{c.activity.stars > 0 && <> · {"⭐".repeat(Math.min(c.activity.stars, 3))}</>}</>}</div>
                    </div>
                    {isDone ? <button onPointerDown={(e) => e.stopPropagation()} onClick={() => undo(c)} aria-label={d.notYet} className={`grid h-7 w-7 shrink-0 place-items-center rounded-full bg-green text-base font-extrabold text-white ${burst === c.key ? "pop" : ""}`}>✓</button>
                      : <>
                        {canDo && !gone && <button onPointerDown={(e) => e.stopPropagation()} onClick={() => done(c)} className="rounded-full bg-white px-2.5 py-0.5 font-display text-xs font-extrabold" style={{ color: c.color }}>✓ {d.doneStar}</button>}
                        {canRemove && <button onPointerDown={(e) => e.stopPropagation()} onClick={() => remove(c)} aria-label={d.remove} className="rounded-full bg-white/25 px-2 py-0.5 text-sm font-bold">✕</button>}
                      </>}
                  </div>
                );
              })}
              {now >= win.start && now <= win.end && (
                <div className="pointer-events-none absolute -inset-x-2 z-30 flex items-center" style={{ top: y(now) }}>
                  <span className="h-3 w-3 rounded-full bg-red" /><span className="h-0.5 flex-1 bg-red" /><span className="rounded-full bg-red px-2 text-[10px] font-bold text-white">{fmt12(now, lang)}</span>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
      {total != null && <p className="mx-auto mt-3 max-w-4xl text-center text-sm text-ink-2">⭐ {total} · {d.dayStars}</p>}

      {gap && (
        <div className="fixed inset-0 z-40 flex items-end justify-center bg-black/40 sm:items-center" onClick={() => { setGap(null); setPick(null); }}>
          <div onClick={(e) => e.stopPropagation()} className="rise max-h-[88dvh] w-full max-w-2xl overflow-y-auto rounded-t-3xl bg-white p-5 shadow-2xl sm:rounded-3xl">
            <div className="flex items-center justify-between">
              <h2 className="font-display text-xl font-extrabold">{pick ? `${pick.icon} ${d.pickLength}` : `🧺 ${d.addToDay}`}</h2>
              <span className="rounded-full bg-paper px-3 py-1 text-sm font-semibold text-ink-2">{fmt12(gap.start, lang)} → {fmt12(gap.end, lang)}</span>
            </div>
            {!pick ? (
              <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-3">
                {basket.map((a) => {
                  const color = catColor(cats, a.category);
                  const left = a.max_minutes_per_day != null ? Math.max(0, a.max_minutes_per_day - usedBy(a)) : null;
                  const room = Math.min(gap.end - gap.start, left ?? Infinity);
                  const ok = lengths(a).some((m) => m <= room);
                  return (
                    <button key={a.id} disabled={!ok} onClick={() => setPick(a)} className="flex items-center gap-3 rounded-2xl border-2 p-3 text-start disabled:opacity-40" style={{ borderColor: color }}>
                      <span className="grid h-11 w-11 shrink-0 place-items-center rounded-xl text-2xl text-white" style={{ background: color }}>{a.icon}</span>
                      <span className="min-w-0">
                        <span className="block truncate font-display font-extrabold" dir="auto">{nm(a)}</span>
                        <span className="block text-xs text-ink-2">{a.stars > 0 && "⭐".repeat(Math.min(a.stars, 3))}{left != null && <> {left} {d.minutes} {d.leftToday}</>}</span>
                      </span>
                    </button>
                  );
                })}
              </div>
            ) : (
              <div className="mt-4">
                <button onClick={() => setPick(null)} className="text-sm font-semibold text-ink-2">← {d.basket}</button>
                <div className="mt-3 flex flex-wrap gap-3">
                  {lengths(pick).map((m) => {
                    const left = pick.max_minutes_per_day != null ? pick.max_minutes_per_day - usedBy(pick) : Infinity;
                    const ok = m <= gap.end - gap.start && m <= left;
                    return <button key={m} disabled={!ok} onClick={() => add(pick, m)} className="rounded-2xl px-6 py-4 font-display text-2xl font-extrabold text-white disabled:opacity-30" style={{ background: catColor(cats, pick.category) }}>{m} <span className="text-base">{d.minutes}</span></button>;
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
