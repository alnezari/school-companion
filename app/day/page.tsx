"use client";
import { useCallback, useEffect, useMemo, useState } from "react";
import { motion, animate, useMotionValue, AnimatePresence, type PanInfo } from "motion/react";
import { SPRING, enter } from "@/lib/motion";
import { useLang } from "@/lib/lang";
import { t, DAY_NAMES7 } from "@/lib/i18n";
import { todayISO, formatDate, fmt12, TZ } from "@/lib/schedule";
import { loadSettings } from "@/lib/data";
import { KidTop } from "@/components/KidTop";
import {
  addDayItem, catColor, catName, configFrom, dayWindow, fixedFor, loadActivities, loadCategories, loadDayItems, loadDayStars, loadSkips, moveDayItem, removeDayItem,
  setStatus, showsOn, subscribeDayItems, toMin, toTime, type Activity, type Category, type DayConfig, type DayItem, type DayStatus,
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

/** One block on the timeline. Its vertical position is a motion value: the finger drags it, springs settle it, neighbours slide aside. */
function Block({ card: c, top, previewTop, settle, movable, bad, clash, status, arrived, canRemove, burst, lang, d, onDrag, onDragEnd, onJudge, onRemove }: {
  card: Card; top: number; previewTop?: number; settle: number; movable: boolean; bad: boolean; clash: boolean; status: DayStatus; arrived: boolean; canRemove: boolean; burst: boolean;
  lang: "en" | "ar"; d: ReturnType<typeof t>; onDrag: (info: PanInfo) => void; onDragEnd: () => void; onJudge: (s: DayStatus) => void; onRemove: () => void;
}) {
  const yv = useMotionValue(top);
  const [dragging, setDragging] = useState(false);
  useEffect(() => { if (!dragging) animate(yv, previewTop ?? top, previewTop != null ? SPRING.gentle : SPRING.spatial); }, [top, previewTop, settle, dragging, yv]);
  const stop = (e: React.PointerEvent) => e.stopPropagation();
  return (
    <motion.div style={{ y: yv, top: 0, height: c.minutes * PX - 4, background: status ? `${c.color}80` : c.color, borderColor: bad || clash ? "#C8321E" : status ? "transparent" : "rgba(255,255,255,.5)", zIndex: dragging ? 30 : clash ? 10 : undefined }}
      drag={movable ? "y" : false} dragMomentum={false} dragElastic={0.05} onDragStart={() => setDragging(true)} onDrag={(_e, info) => onDrag(info)} onDragEnd={() => { setDragging(false); onDragEnd(); }}
      whileDrag={{ scale: 1.03, boxShadow: "0 18px 30px -14px rgba(0,0,0,.55)" }} whileTap={movable ? { scale: 1.01 } : undefined}
      className={`absolute inset-x-0 flex select-none items-center gap-2 overflow-hidden rounded-xl border-2 px-2.5 text-white shadow-sm ${movable ? "touch-none cursor-grab" : ""}`}>
      <div className={`flex min-w-0 flex-1 items-center gap-2 ${status ? "opacity-70" : ""}`}>
        <span className="text-xl">{c.activity.icon}</span>
        <div className="min-w-0 flex-1 leading-tight">
          <div className="truncate font-display text-sm font-extrabold" dir="auto">{c.name}{c.locked && <span className="ms-1 text-xs opacity-80">🔒</span>}</div>
          <div className="truncate text-[11px] opacity-90">{clash ? <span className="font-bold text-white"><span className="rounded bg-red px-1">{d.needsMove}</span></span> : <>{fmt12(c.start, lang)} · {c.minutes} {d.minutes}{c.activity.stars > 0 && <> · {"⭐".repeat(Math.min(c.activity.stars, 3))}</>}</>}</div>
        </div>
      </div>
      <AnimatePresence mode="popLayout" initial={false}>
        {status === "done" ? (
          <motion.button key="done" initial={{ scale: 0.5 }} animate={{ scale: 1 }} exit={{ scale: 0.5, opacity: 0 }} transition={SPRING.bouncy} onPointerDown={stop} onClick={() => onJudge(null)} aria-label={d.doneStar}
            className="relative grid h-7 w-7 shrink-0 place-items-center rounded-full bg-green text-base font-extrabold text-white">✓
            {burst && <motion.span initial={{ scale: 0.8, opacity: 0.9 }} animate={{ scale: 2, opacity: 0 }} transition={{ duration: 0.5, ease: "easeOut" }} className="absolute inset-0 rounded-full border-2 border-green" />}
          </motion.button>
        ) : status === "not_done" ? (
          <motion.button key="no" initial={{ x: -6 }} animate={{ x: [0, -5, 5, -3, 0] }} transition={{ duration: 0.35 }} onPointerDown={stop} onClick={() => onJudge(null)} aria-label={d.notDone}
            className="grid h-7 w-7 shrink-0 place-items-center rounded-full bg-red text-base font-extrabold text-white">✕</motion.button>
        ) : arrived ? (
          <motion.span key="judge" initial={{ scale: 0.7, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} transition={SPRING.gentle} className="flex shrink-0 gap-1">
            <motion.button whileTap={{ scale: 0.9 }} onPointerDown={stop} onClick={() => onJudge("done")} aria-label={d.doneStar} className="grid h-7 w-7 place-items-center rounded-full bg-white text-base font-extrabold text-green">✓</motion.button>
            <motion.button whileTap={{ scale: 0.9 }} onPointerDown={stop} onClick={() => onJudge("not_done")} aria-label={d.notDone} className="grid h-7 w-7 place-items-center rounded-full bg-white/30 text-base font-extrabold text-white">✕</motion.button>
          </motion.span>
        ) : canRemove ? (
          <motion.button key="rm" whileTap={{ scale: 0.9 }} onPointerDown={stop} onClick={onRemove} aria-label={d.remove} className="rounded-full bg-white/25 px-2 py-0.5 text-sm font-bold">✕</motion.button>
        ) : null}
      </AnimatePresence>
    </motion.div>
  );
}

export default function DayPage() {
  const [lang] = useLang("kid");
  const d = t(lang);
  const [date, setDate] = useState<string | null>(null);
  const [now, setNow] = useState(0);
  useEffect(() => {
    const q = new URLSearchParams(window.location.search);
    const fakeT = q.get("t"), fakeD = q.get("date"); // testing at night: /day?t=16:30 (and optionally &date=YYYY-MM-DD)
    const tick = () => { setDate(fakeD && /^\d{4}-\d{2}-\d{2}$/.test(fakeD) ? fakeD : todayISO()); setNow(fakeT && /^\d{1,2}:\d{2}$/.test(fakeT) ? toMin(fakeT) : nowMinutes()); };
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

  // ----- the red line splits the day: what is above it can only be judged (done / not done); what is below can be moved or deleted -----
  const earliestAddable = win ? Math.max(win.start, Math.ceil(now / SNAP) * SNAP) : 0;
  const [preview, setPreview] = useState<{ key: string; S: number; plan: Map<string, number> | null } | null>(null);
  const [settle, setSettle] = useState(0);
  const immovable = useCallback((o: Card) => o.locked || o.start + o.minutes <= now, [now]); // running items can still move
  /** Where everything ends up if card c is dropped at S. Dropping onto other cards pushes them out of the way, keeping their order. */
  const planMove = useCallback((c: Card, S: number): { card: Card; start: number }[] | null => {
    if (!win) return null;
    const L = c.minutes, P = c.start;
    const others = cards.filter((o) => o.key !== c.key);
    const onTop = others.filter((o) => S < o.start + o.minutes && o.start < S + L);
    let plan: { card: Card; start: number }[];
    if (onTop.length === 0) plan = [{ card: c, start: S }];
    else if (S > P) {
      const chain = others.filter((o) => (o.start >= P + L && o.start < S + L) || onTop.includes(o));
      if (chain.some(immovable)) return null;
      plan = [...chain.map((o) => ({ card: o, start: o.start - L })), { card: c, start: Math.max(...chain.map((o) => o.start + o.minutes)) - L }];
    } else {
      const chain = others.filter((o) => (o.start >= S && o.start < P) || onTop.includes(o));
      if (chain.some(immovable)) return null;
      plan = [...chain.map((o) => ({ card: o, start: o.start + L })), { card: c, start: Math.min(...chain.map((o) => o.start)) }];
    }
    const moved = new Map(plan.map((p) => [p.card.key, p.start]));
    const all = cards.map((o) => ({ key: o.key, start: moved.get(o.key) ?? o.start, minutes: o.minutes }));
    for (const a of all) {
      if (moved.has(a.key) && (a.start < earliestAddable || a.start + a.minutes > win.end)) return null;
      for (const b of all) if (a.key !== b.key && a.start < b.start + b.minutes && b.start < a.start + a.minutes) return null;
    }
    return plan;
  }, [win, cards, earliestAddable, immovable]);
  function onDrag(c: Card, info: PanInfo) {
    const S = c.start + Math.round(info.offset.y / PX / SNAP) * SNAP;
    if (preview && preview.key === c.key && preview.S === S) return;
    const plan = planMove(c, S);
    setPreview({ key: c.key, S, plan: plan ? new Map(plan.filter((p) => p.card.key !== c.key).map((p) => [p.card.key, p.start])) : null });
  }
  async function onDragEnd(c: Card) {
    const S = preview?.key === c.key ? preview.S : c.start;
    const plan = S !== c.start ? planMove(c, S) : null;
    setPreview(null); setSettle((n) => n + 1);
    if (!plan || !date) return;
    const place = async (card: Card, start: number): Promise<DayItem | null> => {
      if (card.item) { await moveDayItem(card.item.id, start); return { ...card.item, start_time: toTime(start) }; }
      return addDayItem(date, card.activity.id, start, card.minutes); // a moved fixed activity remembers its new time for today
    };
    const rows = await Promise.all(plan.map((p) => place(p.card, p.start)));
    setItems((it) => {
      let next = it;
      for (const row of rows) if (row) next = next.some((i) => i.id === row.id) ? next.map((i) => (i.id === row.id ? row : i)) : [...next, row];
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
  async function judge(c: Card, status: DayStatus) {
    if (!date) return;
    let item = c.item;
    if (!item) { item = await addDayItem(date, c.activity.id, c.start, c.minutes); if (!item) return; }
    const stamp = new Date().toISOString();
    const next: DayItem = { ...item, done_at: status === "done" ? stamp : null, not_done_at: status === "not_done" ? stamp : null };
    setItems((it) => (it.some((i) => i.id === next.id) ? it.map((i) => (i.id === next.id ? next : i)) : [...it, next]));
    if (status === "done") { setBurst(c.key); setTimeout(() => setBurst(null), 900); }
    await setStatus(item.id, status);
  }
  async function remove(c: Card) { if (!c.item) return; setItems((it) => it.filter((i) => i.id !== c.item!.id)); await removeDayItem(c.item.id); }

  const stats = useMemo(() => {
    if (!win) return null;
    const occupied = cards.reduce((n, c) => n + c.minutes, 0);
    let done = 0, notDone = 0, remaining = 0;
    for (const c of cards) { if (c.item?.done_at) done++; else if (c.item?.not_done_at) notDone++; else remaining++; }
    const byCat = new Map<string, { planned: number; actual: number; count: number }>();
    for (const c of cards) {
      const e = byCat.get(c.activity.category) ?? { planned: 0, actual: 0, count: 0 };
      e.planned += c.minutes; if (c.item?.done_at) { e.actual += c.minutes; e.count++; }
      byCat.set(c.activity.category, e);
    }
    return { free: Math.max(0, win.end - win.start - occupied), done, notDone, remaining, byCat: [...byCat.entries()].sort((a, b) => b[1].actual - a[1].actual || b[1].planned - a[1].planned) };
  }, [cards, win]);
  const hrs = (m: number) => `${m % 60 === 0 ? m / 60 : (m / 60).toFixed(1)} ${d.hoursShort}`;

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
                <motion.button key={g.start} whileTap={{ scale: 0.98 }} onClick={() => setGap(g)} className="absolute inset-x-0 rounded-2xl border-2 border-dashed border-transparent text-sm font-bold text-accent/70 transition hover:border-accent/40"
                  style={{ top: y(g.start) + 2, height: (g.end - g.start) * PX - 4 }}>
                  {(g.end - g.start) >= 20 && basket.length > 0 && <>＋ {d.addHere}</>}
                </motion.button>
              ))}
              {cards.map((c) => {
                const status: DayStatus = c.item?.done_at ? "done" : c.item?.not_done_at ? "not_done" : null;
                const arrived = c.start <= now; // above the red line
                const previewStart = preview?.plan?.get(c.key);
                const clash = !c.locked && cards.some((o) => o.key !== c.key && o.activity.fixed && c.start < o.start + o.minutes && o.start < c.start + c.minutes);
                return (
                  <Block key={c.key} card={c} top={y(c.start) + 2} previewTop={previewStart != null ? y(previewStart) + 2 : undefined} settle={settle}
                    movable={!immovable(c)} bad={preview?.key === c.key && !preview.plan} clash={clash} status={status} arrived={arrived}
                    canRemove={!arrived && !!c.item && !c.activity.fixed} burst={burst === c.key} lang={lang} d={d}
                    onDrag={(info) => onDrag(c, info)} onDragEnd={() => onDragEnd(c)} onJudge={(st) => judge(c, st)} onRemove={() => remove(c)} />
                );
              })}
              {now >= win.start && now <= win.end && (
                <motion.div layout transition={SPRING.gentle} className="pointer-events-none absolute -inset-x-2 z-30 flex items-center" style={{ top: y(now) }}>
                  <motion.span animate={{ scale: [1, 1.35, 1], opacity: [1, 0.7, 1] }} transition={{ duration: 2.4, repeat: Infinity, ease: "easeInOut" }} className="h-3 w-3 rounded-full bg-red" />
                  <span className="h-0.5 flex-1 bg-red" /><span className="rounded-full bg-red px-2 text-[10px] font-bold text-white">{fmt12(now, lang)}</span>
                </motion.div>
              )}
            </div>
          </div>
        </div>
      )}
      {stats && (
        <div className="mx-auto mt-3 grid max-w-4xl gap-3 sm:grid-cols-2">
          <motion.section {...enter(1)} className="rounded-3xl bg-white p-4 shadow-sm">
            <h2 className="font-display font-extrabold">📊 {d.todayNumbers}</h2>
            <div className="mt-3 grid grid-cols-4 gap-2 text-center">
              {([["⏳", hrs(stats.free), d.freeTime, "text-ink"], ["✅", stats.done, d.doneCount, "text-green"], ["❌", stats.notDone, d.notDoneCount, "text-red"], ["⏭️", stats.remaining, d.remainingCount, "text-accent"]] as const).map(([icon, n, label, cls]) => (
                <div key={label} className="rounded-2xl bg-paper px-1 py-3">
                  <div className="text-lg">{icon}</div>
                  <div className={`font-display text-xl font-extrabold ${cls}`}>{n}</div>
                  <div className="text-[11px] font-semibold text-ink-2">{label}</div>
                </div>
              ))}
            </div>
          </motion.section>
          <motion.section {...enter(2)} className="rounded-3xl bg-white p-4 shadow-sm">
            <h2 className="font-display font-extrabold">🎨 {d.byCategory}</h2>
            {stats.byCat.length === 0 ? <p className="mt-3 text-sm text-ink-2">{d.nothingPlanned}</p> : (
              <ul className="mt-3 space-y-2">
                {stats.byCat.map(([key, v]) => {
                  const max = Math.max(...stats.byCat.map(([, x]) => x.planned));
                  return (
                    <li key={key} className="flex items-center gap-2 text-sm">
                      <span className="h-3 w-3 shrink-0 rounded-full" style={{ background: catColor(cats, key) }} />
                      <span className="w-20 shrink-0 truncate font-semibold" dir="auto">{catName(cats, key, lang)}</span>
                      <span className="relative h-2.5 flex-1 overflow-hidden rounded-full bg-paper">
                        <span className="absolute inset-y-0 start-0 rounded-full opacity-25" style={{ width: `${(v.planned / max) * 100}%`, background: catColor(cats, key) }} />
                        <span className="absolute inset-y-0 start-0 rounded-full" style={{ width: `${(v.actual / max) * 100}%`, background: catColor(cats, key) }} />
                      </span>
                      <span className="w-24 shrink-0 text-end text-xs text-ink-2">{hrs(v.actual)} · {v.count} {d.blocksShort}</span>
                    </li>
                  );
                })}
              </ul>
            )}
          </motion.section>
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
              cats.filter((cat) => basket.some((a) => a.category === cat.key)).map((cat) => (
                <div key={cat.key} className="mt-4">
                  <div className="mb-2 flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-ink-2"><span className="h-2.5 w-2.5 rounded-full" style={{ background: cat.color }} />{catName(cats, cat.key, lang)}</div>
                  <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
                    {basket.filter((a) => a.category === cat.key).map((a) => {
                      const left = a.max_minutes_per_day != null ? Math.max(0, a.max_minutes_per_day - usedBy(a)) : null;
                      const room = Math.min(gap.end - gap.start, left ?? Infinity);
                      const ok = lengths(a).some((m) => m <= room);
                      return (
                        <button key={a.id} disabled={!ok} onClick={() => setPick(a)} className="flex items-center gap-3 rounded-2xl border-2 p-3 text-start disabled:opacity-40" style={{ borderColor: cat.color }}>
                          <span className="grid h-11 w-11 shrink-0 place-items-center rounded-xl text-2xl text-white" style={{ background: cat.color }}>{a.icon}</span>
                          <span className="min-w-0">
                            <span className="block truncate font-display font-extrabold" dir="auto">{nm(a)}</span>
                            <span className="block text-xs text-ink-2">{a.stars > 0 && "⭐".repeat(Math.min(a.stars, 3))}{left != null && <> {left} {d.minutes} {d.leftToday}</>}</span>
                          </span>
                        </button>
                      );
                    })}
                  </div>
                </div>
              ))
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
