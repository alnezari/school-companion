"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useLang } from "@/lib/lang";
import { t, DAY_SHORT7, type Dict } from "@/lib/i18n";
import { loadSettings, saveSetting } from "@/lib/data";
import { todayISO, formatDate, fmt12, weekday } from "@/lib/schedule";
import { isParentUnlocked } from "@/components/ParentGate";
import {
  PALETTE, catColor, catName, configFrom, deleteActivity, loadActivities, loadCategories, loadSkips, saveActivity, saveCategory, setSkip, showsOn, toMin,
  type Activity, type Category, type DayConfig,
} from "@/lib/day";

type Draft = Omit<Activity, "id" | "sort"> & { id?: string };
const empty = (): Draft => ({ name_en: "", name_ar: "", icon: "⭐", category: "sport", durations: [30, 60], stars: 1, max_minutes_per_day: null, active: true, fixed: false, start_time: "16:00", minutes: 60, days: [0], repeat: "weekly", on_date: null, locked: true });
const input = "mt-1 w-full rounded-xl border border-line bg-white px-3 py-2";
const chip = (on: boolean) => `rounded-full border px-3 py-1 text-sm font-semibold ${on ? "border-ink bg-ink text-white" : "border-line bg-white"}`;

// Small pieces live outside the page so inputs keep focus while typing.
const Field = ({ label, children }: { label: string; children: React.ReactNode }) => <label className="block text-sm font-medium">{label}{children}</label>;
const Switch = ({ on, onChange, label }: { on: boolean; onChange: (v: boolean) => void; label?: string }) => (
  <button type="button" onClick={() => onChange(!on)} className="flex items-center gap-2 text-sm font-medium">
    <span className={`inline-block h-6 w-10 rounded-full p-0.5 transition ${on ? "bg-green" : "bg-line"}`}><span className={`block h-5 w-5 rounded-full bg-white transition ${on ? "translate-x-4 rtl:-translate-x-4" : ""}`} /></span>{label}
  </button>
);
const Sheet = ({ title, d, onClose, onSave, onDelete, children }: { title: string; d: Dict; onClose: () => void; onSave: () => void; onDelete?: () => void; children: React.ReactNode }) => (
  <div className="fixed inset-0 z-40 flex items-end justify-center bg-black/40 sm:items-center" onClick={onClose}>
    <div onClick={(e) => e.stopPropagation()} className="rise max-h-[92dvh] w-full max-w-lg overflow-y-auto rounded-t-3xl bg-white p-5 shadow-2xl sm:rounded-3xl">
      <h2 className="font-display text-lg font-extrabold">{title}</h2>
      <div className="mt-3 grid gap-4">{children}</div>
      <div className="mt-5 flex gap-2">
        {onDelete && <button type="button" onClick={onDelete} className="rounded-xl border border-red px-3 py-2 text-sm font-semibold text-red">{d.delete}</button>}
        <button type="button" onClick={onClose} className="flex-1 rounded-xl border border-line py-2 font-semibold">{d.cancel}</button>
        <button type="button" onClick={onSave} className="flex-1 rounded-xl bg-accent py-2 font-semibold text-white">{d.save}</button>
      </div>
    </div>
  </div>
);

export default function ParentDayPage() {
  const router = useRouter();
  const [lang] = useLang("parent");
  const d = t(lang);
  const [cfg, setCfg] = useState<DayConfig | null>(null);
  const [cats, setCats] = useState<Category[]>([]);
  const [acts, setActs] = useState<Activity[]>([]);
  const [skips, setSkips] = useState<Set<string>>(new Set());
  const [today, setToday] = useState("");
  const [edit, setEdit] = useState<Draft | null>(null);
  const [newCat, setNewCat] = useState<{ name_en: string; name_ar: string; color: string } | null>(null);
  const [problem, setProblem] = useState<string | null>(null);
  useEffect(() => { if (!isParentUnlocked()) router.replace("/"); }, [router]);
  useEffect(() => {
    const iso = todayISO(); setToday(iso);
    Promise.all([loadSettings(), loadCategories(), loadActivities(), loadSkips(iso)]).then(([s, c, a, sk]) => { setCfg(configFrom(s)); setCats(c); setActs(a); setSkips(sk); });
  }, []);
  const nm = (o: { name_en: string; name_ar: string }) => (lang === "ar" ? o.name_ar : o.name_en) || o.name_en;

  async function saveCfg(key: keyof DayConfig, v: string) {
    if (!cfg) return; setCfg({ ...cfg, [key]: v });
    await saveSetting({ home: "day_home_time", bed: "day_bed_time", wake: "day_weekend_wake" }[key], v);
  }
  /** A fixed activity must sit inside his day window and never on top of another fixed one. */
  function check(e: Draft): string | null {
    if (!e.fixed || !cfg || !e.start_time) return null;
    const start = toMin(e.start_time), end = start + (e.minutes ?? 30), bed = toMin(cfg.bed);
    const dayList = e.repeat === "once" ? [weekday(e.on_date || today)] : e.days;
    for (const wd of dayList) {
      const from = toMin(wd >= 5 ? cfg.wake : cfg.home);
      if (start < from || end > bed) return d.outsideWindow;
      for (const o of acts) {
        if (o.id === e.id || !o.fixed || !o.active || !o.start_time) continue;
        const onDay = o.repeat === "once" ? (e.repeat === "once" ? o.on_date === (e.on_date || today) : o.on_date != null && weekday(o.on_date) === wd) : o.days.includes(wd);
        const os = toMin(o.start_time), oe = os + (o.minutes ?? 30);
        if (onDay && start < oe && os < end) return `${d.clashesWith} ${nm(o)} · ${DAY_SHORT7[lang][wd]}`;
      }
    }
    return null;
  }
  async function submit() {
    if (!edit || !edit.name_en.trim()) return;
    const bad = check(edit); setProblem(bad); if (bad) return;
    const row = await saveActivity({ ...edit, icon: edit.icon.trim() || "⭐", name_ar: edit.name_ar.trim() || edit.name_en.trim(), durations: edit.durations.length ? edit.durations : [20], on_date: edit.repeat === "once" ? edit.on_date || today : null });
    if (row) setActs((a) => (a.some((x) => x.id === row.id) ? a.map((x) => (x.id === row.id ? row : x)) : [...a, row]));
    setEdit(null);
  }
  async function addCategory() {
    if (!newCat || !newCat.name_en.trim() || !edit) return;
    const c: Category = { key: newCat.name_en.trim().toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "") || `c${Date.now()}`, name_en: newCat.name_en.trim(), name_ar: newCat.name_ar.trim() || newCat.name_en.trim(), color: newCat.color, sort: cats.length + 1 };
    if (await saveCategory(c)) { setCats((x) => [...x.filter((y) => y.key !== c.key), c]); setEdit({ ...edit, category: c.key }); }
    setNewCat(null);
  }
  async function toggleSkip(a: Activity) {
    const skip = !skips.has(a.id);
    setSkips((s) => { const n = new Set(s); if (skip) n.add(a.id); else n.delete(a.id); return n; });
    await setSkip(a.id, today, skip);
  }
  async function toggleActive(a: Activity) { setActs((x) => x.map((y) => (y.id === a.id ? { ...y, active: !a.active } : y))); await saveActivity({ ...a, active: !a.active }); }

  return (
    <main className="min-h-dvh px-4 py-4">
      <div className="mx-auto max-w-2xl">
        <div className="flex items-center gap-2">
          <Link href="/parent" className="rounded-full border border-line bg-white px-3 py-1.5 text-sm font-semibold">🏠</Link>
          <h1 className="font-display text-xl font-extrabold">🗓️ {d.dayTitle}</h1>
        </div>

        {cfg && (
          <section className="mt-4 rounded-2xl border border-line bg-white p-4">
            <h2 className="font-display font-extrabold">🕑 {d.dayWindow}</h2>
            <div className="mt-2 grid grid-cols-3 gap-3">
              <Field label={`${d.schoolDays}: ${d.homeAt}`}><input type="time" value={cfg.home} onChange={(e) => saveCfg("home", e.target.value)} className={input} /></Field>
              <Field label={`${d.weekend}: ${d.wakeAt}`}><input type="time" value={cfg.wake} onChange={(e) => saveCfg("wake", e.target.value)} className={input} /></Field>
              <Field label={d.bedAt}><input type="time" value={cfg.bed} onChange={(e) => saveCfg("bed", e.target.value)} className={input} /></Field>
            </div>
          </section>
        )}

        <section className="mt-3 rounded-2xl border border-line bg-white p-4">
          <div className="flex items-center justify-between gap-3">
            <div><h2 className="font-display font-extrabold">🧺 {d.activities}</h2><p className="text-sm text-ink-2">{d.activitiesSub}</p></div>
            <button onClick={() => setEdit(empty())} className="shrink-0 rounded-xl bg-accent px-3 py-1.5 text-sm font-semibold text-white">＋ {d.addActivity}</button>
          </div>
          {([["fixedSection", true, "🔒"], ["basketSection", false, "🧺"]] as const).map(([label, fixed, icon]) => (
            <div key={label} className="mt-3">
              <h3 className="text-xs font-bold uppercase tracking-wider text-ink-2">{icon} {d[label]}</h3>
              <ul className="divide-y divide-line">
                {acts.filter((a) => a.fixed === fixed).map((a) => {
                  const color = catColor(cats, a.category), skipped = skips.has(a.id), onToday = showsOn(a, today);
                  return (
                    <li key={a.id} className={`flex items-center gap-3 py-2.5 ${a.active ? "" : "opacity-50"}`}>
                      <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl text-xl text-white" style={{ background: color }}>{a.icon}</span>
                      <button onClick={() => setEdit({ ...a })} className="min-w-0 flex-1 text-start">
                        <div className="truncate font-semibold" dir="auto">{nm(a)} {a.stars > 0 && <span className="text-xs">{"⭐".repeat(Math.min(a.stars, 3))}</span>}</div>
                        <div className="truncate text-xs text-ink-2">
                          {a.fixed && a.start_time ? <>{a.locked ? "🔒" : "↕"} {fmt12(toMin(a.start_time), lang)} · {a.minutes} {d.minutes} · {a.repeat === "once" ? (a.on_date ? formatDate(a.on_date, lang) : d.once) : a.days.map((x) => DAY_SHORT7[lang][x]).join(" ")}</>
                            : <>{catName(cats, a.category, lang)} · {a.durations.join("/")} {d.minutes}{a.max_minutes_per_day != null && <> · ⏱ {a.max_minutes_per_day}</>}</>}
                          {skipped && <span className="ms-1 rounded-full bg-orange-soft px-2 text-orange">{d.skipped}</span>}
                        </div>
                      </button>
                      {onToday && a.active && <button onClick={() => toggleSkip(a)} className="shrink-0 rounded-full border border-line px-2.5 py-1 text-xs font-semibold">{skipped ? d.unskip : d.skipToday}</button>}
                      <Switch on={a.active} onChange={() => toggleActive(a)} />
                    </li>
                  );
                })}
              </ul>
            </div>
          ))}
        </section>
      </div>

      {edit && (
        <Sheet d={d} title={edit.id ? nm(edit) : d.addActivity} onClose={() => { setEdit(null); setNewCat(null); setProblem(null); }} onSave={submit}
          onDelete={edit.id ? async () => { await deleteActivity(edit.id!); setActs((a) => a.filter((x) => x.id !== edit.id)); setEdit(null); } : undefined}>
          <div className="grid grid-cols-[64px_1fr_1fr] gap-3">
            <Field label={d.icon}><input value={edit.icon} maxLength={4} onChange={(e) => setEdit({ ...edit, icon: e.target.value })} className={`${input} text-center text-2xl`} /></Field>
            <Field label="EN"><input value={edit.name_en} onChange={(e) => setEdit({ ...edit, name_en: e.target.value })} className={input} /></Field>
            <Field label="AR"><input dir="rtl" value={edit.name_ar} onChange={(e) => setEdit({ ...edit, name_ar: e.target.value })} className={input} /></Field>
          </div>
          <Field label={d.category}>
            <div className="mt-1 flex flex-wrap gap-1">
              {cats.map((c) => <button type="button" key={c.key} onClick={() => setEdit({ ...edit, category: c.key })} className={`rounded-full px-3 py-1 text-sm font-semibold text-white ${c.key === edit.category ? "ring-2 ring-ink ring-offset-1" : "opacity-60"}`} style={{ background: c.color }}>{nm(c)}</button>)}
              <button type="button" onClick={() => setNewCat({ name_en: "", name_ar: "", color: PALETTE[0] })} className="rounded-full border border-dashed border-ink-2 px-3 py-1 text-sm font-semibold">＋</button>
            </div>
            {newCat && (
              <div className="mt-2 rounded-xl bg-paper p-3">
                <div className="grid grid-cols-2 gap-2">
                  <input placeholder="EN" value={newCat.name_en} onChange={(e) => setNewCat({ ...newCat, name_en: e.target.value })} className={input} />
                  <input placeholder="AR" dir="rtl" value={newCat.name_ar} onChange={(e) => setNewCat({ ...newCat, name_ar: e.target.value })} className={input} />
                </div>
                <div className="mt-2 flex items-center gap-2">
                  {PALETTE.map((c) => <button type="button" key={c} onClick={() => setNewCat({ ...newCat, color: c })} className={`h-7 w-7 rounded-full ${newCat.color === c ? "ring-2 ring-ink ring-offset-1" : ""}`} style={{ background: c }} />)}
                  <button type="button" onClick={addCategory} className="ms-auto rounded-lg bg-ink px-3 py-1 text-sm font-semibold text-white">{d.addIt}</button>
                </div>
              </div>
            )}
          </Field>
          <Field label={d.starsLabel}>
            <div className="mt-1 flex flex-wrap gap-1">{[0, 1, 2, 3].map((n) => <button type="button" key={n} onClick={() => setEdit({ ...edit, stars: n })} className={chip(edit.stars === n)}>{n === 0 ? d.none : "⭐".repeat(n)}</button>)}</div>
          </Field>
          <Switch on={edit.fixed} onChange={(v) => setEdit({ ...edit, fixed: v })} label={`🔒 ${d.fixedTime}`} />
          {edit.fixed ? (
            <>
              <div className="grid grid-cols-2 gap-3">
                <Field label={d.start}><input type="time" step={1800} value={edit.start_time ?? "16:00"} onChange={(e) => setEdit({ ...edit, start_time: e.target.value })} className={input} /></Field>
                <Field label={`${d.length} (${d.minutes})`}><input type="number" min={30} step={30} value={edit.minutes ?? 60} onChange={(e) => setEdit({ ...edit, minutes: Math.max(30, Math.ceil(Number(e.target.value) / 30) * 30) })} className={input} /></Field>
              </div>
              <Field label={d.repeat}>
                <div className="mt-1 flex flex-wrap gap-1">
                  {(["weekly", "once"] as const).map((r) => <button type="button" key={r} onClick={() => setEdit({ ...edit, repeat: r })} className={chip(edit.repeat === r)}>{d[r]}</button>)}
                  {edit.repeat === "once" && <input type="date" value={edit.on_date ?? today} onChange={(e) => setEdit({ ...edit, on_date: e.target.value })} className="rounded-xl border border-line px-2 py-1 text-sm" />}
                </div>
                {edit.repeat === "weekly" && (
                  <div className="mt-2 flex flex-wrap gap-1">
                    {DAY_SHORT7[lang].map((n, i) => <button type="button" key={i} onClick={() => setEdit({ ...edit, days: edit.days.includes(i) ? edit.days.filter((x) => x !== i) : [...edit.days, i].sort() })} className={chip(edit.days.includes(i))}>{n}</button>)}
                  </div>
                )}
              </Field>
              <Switch on={!edit.locked} onChange={(v) => setEdit({ ...edit, locked: !v })} label={`↕ ${d.kidCanMove}`} />
              {problem && <p className="rounded-xl bg-red-soft px-3 py-2 text-sm font-semibold text-red">⚠ {problem}</p>}
            </>
          ) : (
            <>
              <Field label={`${d.length} (${d.minutes})`}>
                <div className="mt-1 flex flex-wrap gap-1">
                  {[30, 60, 90, 120].map((m) => <button type="button" key={m} onClick={() => setEdit({ ...edit, durations: edit.durations.includes(m) ? edit.durations.filter((x) => x !== m) : [...edit.durations, m].sort((a, b) => a - b) })} className={chip(edit.durations.includes(m))}>{m}</button>)}
                </div>
              </Field>
              <Field label={`⏱ ${d.dailyLimit}`}>
                <div className="mt-1 flex flex-wrap gap-1">
                  {[null, 30, 60, 90, 120].map((m) => <button type="button" key={m ?? "none"} onClick={() => setEdit({ ...edit, max_minutes_per_day: m })} className={chip(edit.max_minutes_per_day === m)}>{m == null ? d.none : `${m} ${d.minutes}`}</button>)}
                </div>
              </Field>
            </>
          )}
        </Sheet>
      )}
    </main>
  );
}
