"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useLang } from "@/lib/lang";
import { t, DAY_SHORT7, type Dict } from "@/lib/i18n";
import { loadSettings, saveSetting } from "@/lib/data";
import { todayISO, formatDate } from "@/lib/schedule";
import { isParentUnlocked } from "@/components/ParentGate";
import { LangToggle } from "@/components/LangToggle";
import {
  CATEGORIES, CATEGORY_COLOR, configFrom, deleteActivity, deleteBlock, loadActivities, loadBlocks, loadSkips, saveActivity, saveBlock, setSkip,
  type Activity, type Category, type DayConfig, type FixedBlock,
} from "@/lib/day";

const ICONS = ["📖", "🎹", "🎨", "⚽", "🚲", "🧩", "🏠", "😴", "📺", "📱", "🎮", "🥋", "🏊", "👩‍🏫", "📚", "🧠", "🎵", "🌳", "🍎", "🧹"];
type BlockDraft = Omit<FixedBlock, "id" | "active"> & { id?: string };
type ActDraft = Omit<Activity, "id" | "sort"> & { id?: string };
const emptyBlock = (): BlockDraft => ({ name_en: "", name_ar: "", icon: "🥋", category: "sport", start_time: "16:00", minutes: 60, days: [0], repeat: "weekly", on_date: null, stars: 2, opens_school: false });
const emptyAct = (): ActDraft => ({ name_en: "", name_ar: "", icon: "⚽", category: "sport", durations: [10, 20, 30], stars: 1, max_minutes_per_day: null, active: true });

const input = "mt-1 w-full rounded-xl border border-line bg-white px-3 py-2";
// Small building blocks live outside the page so inputs keep focus while typing.
const Field = ({ label, children }: { label: string; children: React.ReactNode }) => <label className="block text-sm font-medium">{label}{children}</label>;
const IconPicker = ({ value, onPick }: { value: string; onPick: (i: string) => void }) => (
  <div className="mt-1 flex flex-wrap gap-1">{ICONS.map((i) => <button type="button" key={i} onClick={() => onPick(i)} className={`rounded-lg border px-2 py-1 text-xl ${i === value ? "border-ink bg-ink/10" : "border-line"}`}>{i}</button>)}</div>
);
const CatPicker = ({ value, onPick, d }: { value: Category; onPick: (c: Category) => void; d: Dict }) => (
  <div className="mt-1 flex flex-wrap gap-1">{CATEGORIES.map((c) => <button type="button" key={c} onClick={() => onPick(c)} className={`rounded-full px-3 py-1 text-sm font-semibold text-white ${c === value ? "ring-2 ring-ink ring-offset-1" : "opacity-60"}`} style={{ background: CATEGORY_COLOR[c] }}>{d.cats[c]}</button>)}</div>
);
const Sheet = ({ title, d, onClose, onSave, onDelete, children }: { title: string; d: Dict; onClose: () => void; onSave: () => void; onDelete?: () => void; children: React.ReactNode }) => (
  <div className="fixed inset-0 z-40 flex items-end justify-center bg-black/40 sm:items-center" onClick={onClose}>
    <div onClick={(e) => e.stopPropagation()} className="rise max-h-[92dvh] w-full max-w-lg overflow-y-auto rounded-t-3xl bg-white p-5 shadow-2xl sm:rounded-3xl">
      <h2 className="font-display text-lg font-extrabold">{title}</h2>
      <div className="mt-3 grid gap-3">{children}</div>
      <div className="mt-4 flex gap-2">
        {onDelete && <button type="button" onClick={onDelete} className="rounded-xl border border-red px-3 py-2 text-sm font-semibold text-red">{d.delete}</button>}
        <button type="button" onClick={onClose} className="flex-1 rounded-xl border border-line py-2 font-semibold">{d.cancel}</button>
        <button type="button" onClick={onSave} className="flex-1 rounded-xl bg-accent py-2 font-semibold text-white">{d.save}</button>
      </div>
    </div>
  </div>
);

export default function ParentDayPage() {
  const router = useRouter();
  const [lang, setLang] = useLang("parent");
  const d = t(lang);
  const [cfg, setCfg] = useState<DayConfig | null>(null);
  const [blocks, setBlocks] = useState<FixedBlock[]>([]);
  const [acts, setActs] = useState<Activity[]>([]);
  const [skips, setSkips] = useState<Set<string>>(new Set());
  const [today, setToday] = useState("");
  const [editB, setEditB] = useState<BlockDraft | null>(null);
  const [editA, setEditA] = useState<ActDraft | null>(null);
  useEffect(() => { if (!isParentUnlocked()) router.replace("/"); }, [router]);
  useEffect(() => {
    const iso = todayISO(); setToday(iso);
    Promise.all([loadSettings(), loadBlocks(), loadActivities(), loadSkips(iso)]).then(([s, b, a, sk]) => { setCfg(configFrom(s)); setBlocks(b); setActs(a); setSkips(sk); });
  }, []);
  const nm = (o: { name_en: string; name_ar: string }) => (lang === "ar" ? o.name_ar : o.name_en) || o.name_en;

  async function saveCfg(key: keyof DayConfig, v: string) {
    if (!cfg) return; setCfg({ ...cfg, [key]: v });
    await saveSetting({ home: "day_home_time", bed: "day_bed_time", wake: "day_weekend_wake" }[key], v);
  }
  async function submitBlock() {
    if (!editB || !editB.name_en.trim()) return;
    const row = await saveBlock({ ...editB, name_ar: editB.name_ar.trim() || editB.name_en.trim(), on_date: editB.repeat === "once" ? editB.on_date : null });
    if (row) setBlocks((b) => (b.some((x) => x.id === row.id) ? b.map((x) => (x.id === row.id ? row : x)) : [...b, row]).sort((x, y) => x.start_time.localeCompare(y.start_time)));
    setEditB(null);
  }
  async function submitAct() {
    if (!editA || !editA.name_en.trim()) return;
    const row = await saveActivity({ ...editA, name_ar: editA.name_ar.trim() || editA.name_en.trim(), durations: editA.durations.length ? editA.durations : [20] });
    if (row) setActs((a) => (a.some((x) => x.id === row.id) ? a.map((x) => (x.id === row.id ? row : x)) : [...a, row]));
    setEditA(null);
  }
  async function toggleSkip(b: FixedBlock) {
    const skip = !skips.has(b.id);
    setSkips((s) => { const n = new Set(s); if (skip) n.add(b.id); else n.delete(b.id); return n; });
    await setSkip(b.id, today, skip);
  }
  async function toggleActive(b: FixedBlock) { setBlocks((x) => x.map((y) => (y.id === b.id ? { ...y, active: !b.active } : y))); await saveBlock({ ...b, active: !b.active }); }
  async function toggleActActive(a: Activity) { setActs((x) => x.map((y) => (y.id === a.id ? { ...y, active: !a.active } : y))); await saveActivity({ ...a, active: !a.active }); }

  return (
    <main className="min-h-dvh px-4 py-4">
      <div className="mx-auto max-w-2xl">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2"><Link href="/parent/settings" className="rounded-full border border-line bg-white px-3 py-1.5 text-sm font-semibold">←</Link><h1 className="font-display text-xl font-extrabold">🧺 {d.dayTitle}</h1></div>
          <LangToggle lang={lang} setLang={setLang} />
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
          <div className="flex items-center justify-between">
            <div><h2 className="font-display font-extrabold">🔒 {d.fixedBlocks}</h2><p className="text-sm text-ink-2">{d.fixedSub}</p></div>
            <button onClick={() => setEditB(emptyBlock())} className="rounded-xl bg-accent px-3 py-1.5 text-sm font-semibold text-white">＋ {d.addBlock}</button>
          </div>
          <ul className="mt-3 divide-y divide-line">
            {blocks.map((b) => {
              const skipped = skips.has(b.id), showsToday = b.repeat === "once" ? b.on_date === today : b.days.includes(new Date(today + "T12:00:00Z").getUTCDay());
              return (
                <li key={b.id} className={`flex items-center gap-3 py-2.5 ${b.active ? "" : "opacity-50"}`}>
                  <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl text-xl text-white" style={{ background: CATEGORY_COLOR[b.category] }}>{b.icon}</span>
                  <button onClick={() => setEditB({ ...b })} className="min-w-0 flex-1 text-start">
                    <div className="truncate font-semibold" dir="auto">{nm(b)} {b.stars > 0 && <span className="text-xs text-ink-2">{"⭐".repeat(Math.min(b.stars, 3))}</span>}{b.opens_school && " 📚"}</div>
                    <div className="text-xs text-ink-2">{b.start_time} · {b.minutes} {d.minutes} · {b.repeat === "once" ? (b.on_date ? formatDate(b.on_date, lang) : d.once) : b.days.map((x) => DAY_SHORT7[lang][x]).join(" ")}{skipped && <span className="ms-1 rounded-full bg-orange-soft px-2 text-orange">{d.skipped}</span>}</div>
                  </button>
                  {showsToday && b.active && <button onClick={() => toggleSkip(b)} className="rounded-full border border-line px-2.5 py-1 text-xs font-semibold">{skipped ? d.unskip : d.skipToday}</button>}
                  <button onClick={() => toggleActive(b)} aria-label="toggle" className={`h-6 w-10 rounded-full p-0.5 transition ${b.active ? "bg-green" : "bg-line"}`}><span className={`block h-5 w-5 rounded-full bg-white transition ${b.active ? "translate-x-4 rtl:-translate-x-4" : ""}`} /></button>
                </li>
              );
            })}
          </ul>
        </section>

        <section className="mt-3 rounded-2xl border border-line bg-white p-4">
          <div className="flex items-center justify-between">
            <div><h2 className="font-display font-extrabold">🧺 {d.basket}</h2><p className="text-sm text-ink-2">{d.basketSub}</p></div>
            <button onClick={() => setEditA(emptyAct())} className="rounded-xl bg-accent px-3 py-1.5 text-sm font-semibold text-white">＋ {d.addActivity}</button>
          </div>
          <ul className="mt-3 divide-y divide-line">
            {acts.map((a) => (
              <li key={a.id} className={`flex items-center gap-3 py-2.5 ${a.active ? "" : "opacity-50"}`}>
                <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl text-xl text-white" style={{ background: CATEGORY_COLOR[a.category] }}>{a.icon}</span>
                <button onClick={() => setEditA({ ...a })} className="min-w-0 flex-1 text-start">
                  <div className="truncate font-semibold" dir="auto">{nm(a)} {a.stars > 0 && <span className="text-xs text-ink-2">{"⭐".repeat(Math.min(a.stars, 3))}</span>}</div>
                  <div className="text-xs text-ink-2">{d.cats[a.category]} · {a.durations.join("/")} {d.minutes}{a.max_minutes_per_day != null && <> · {d.maxPerDay}: {a.max_minutes_per_day}</>}</div>
                </button>
                <button onClick={() => toggleActActive(a)} aria-label="toggle" className={`h-6 w-10 rounded-full p-0.5 transition ${a.active ? "bg-green" : "bg-line"}`}><span className={`block h-5 w-5 rounded-full bg-white transition ${a.active ? "translate-x-4 rtl:-translate-x-4" : ""}`} /></button>
              </li>
            ))}
          </ul>
        </section>
      </div>

      {editB && (
        <Sheet d={d} title={editB.id ? nm(editB) : d.addBlock} onClose={() => setEditB(null)} onSave={submitBlock}
          onDelete={editB.id ? async () => { await deleteBlock(editB.id!); setBlocks((b) => b.filter((x) => x.id !== editB.id)); setEditB(null); } : undefined}>
          <div className="grid grid-cols-2 gap-3">
            <Field label={`${d.name} (EN)`}><input value={editB.name_en} onChange={(e) => setEditB({ ...editB, name_en: e.target.value })} className={input} /></Field>
            <Field label={`${d.name} (AR)`}><input dir="rtl" value={editB.name_ar} onChange={(e) => setEditB({ ...editB, name_ar: e.target.value })} className={input} /></Field>
          </div>
          <Field label={d.icon}><IconPicker value={editB.icon} onPick={(icon) => setEditB({ ...editB, icon })} /></Field>
          <Field label={d.category}><CatPicker d={d} value={editB.category} onPick={(category) => setEditB({ ...editB, category })} /></Field>
          <div className="grid grid-cols-3 gap-3">
            <Field label={d.start}><input type="time" value={editB.start_time} onChange={(e) => setEditB({ ...editB, start_time: e.target.value })} className={input} /></Field>
            <Field label={`${d.length} (${d.minutes})`}><input type="number" min={5} step={5} value={editB.minutes} onChange={(e) => setEditB({ ...editB, minutes: Number(e.target.value) })} className={input} /></Field>
            <Field label={d.starsLabel}><input type="number" min={0} max={5} value={editB.stars} onChange={(e) => setEditB({ ...editB, stars: Number(e.target.value) })} className={input} /></Field>
          </div>
          <Field label={d.repeat}>
            <div className="mt-1 flex gap-2">
              {(["weekly", "once"] as const).map((r) => <button type="button" key={r} onClick={() => setEditB({ ...editB, repeat: r })} className={`rounded-full border px-3 py-1 text-sm font-semibold ${editB.repeat === r ? "border-ink bg-ink text-white" : "border-line"}`}>{d[r]}</button>)}
              {editB.repeat === "once" && <input type="date" value={editB.on_date ?? today} onChange={(e) => setEditB({ ...editB, on_date: e.target.value })} className="rounded-xl border border-line px-2 py-1 text-sm" />}
            </div>
          </Field>
          {editB.repeat === "weekly" && (
            <Field label={d.days}>
              <div className="mt-1 flex flex-wrap gap-1">
                {DAY_SHORT7[lang].map((n, i) => <button type="button" key={i} onClick={() => setEditB({ ...editB, days: editB.days.includes(i) ? editB.days.filter((x) => x !== i) : [...editB.days, i].sort() })} className={`rounded-full border px-3 py-1 text-sm font-semibold ${editB.days.includes(i) ? "border-ink bg-ink text-white" : "border-line"}`}>{n}</button>)}
              </div>
            </Field>
          )}
          <label className="flex items-center gap-2 text-sm font-medium"><input type="checkbox" checked={editB.opens_school} onChange={(e) => setEditB({ ...editB, opens_school: e.target.checked })} /> 📚 {d.opensSchoolLabel}</label>
        </Sheet>
      )}
      {editA && (
        <Sheet d={d} title={editA.id ? nm(editA) : d.addActivity} onClose={() => setEditA(null)} onSave={submitAct}
          onDelete={editA.id ? async () => { await deleteActivity(editA.id!); setActs((a) => a.filter((x) => x.id !== editA.id)); setEditA(null); } : undefined}>
          <div className="grid grid-cols-2 gap-3">
            <Field label={`${d.name} (EN)`}><input value={editA.name_en} onChange={(e) => setEditA({ ...editA, name_en: e.target.value })} className={input} /></Field>
            <Field label={`${d.name} (AR)`}><input dir="rtl" value={editA.name_ar} onChange={(e) => setEditA({ ...editA, name_ar: e.target.value })} className={input} /></Field>
          </div>
          <Field label={d.icon}><IconPicker value={editA.icon} onPick={(icon) => setEditA({ ...editA, icon })} /></Field>
          <Field label={d.category}><CatPicker d={d} value={editA.category} onPick={(category) => setEditA({ ...editA, category })} /></Field>
          <Field label={d.durationsLabel}>
            <div className="mt-1 flex flex-wrap gap-1">
              {[5, 10, 15, 20, 30, 45, 60].map((m) => <button type="button" key={m} onClick={() => setEditA({ ...editA, durations: editA.durations.includes(m) ? editA.durations.filter((x) => x !== m) : [...editA.durations, m].sort((a, b) => a - b) })} className={`rounded-full border px-3 py-1 text-sm font-semibold ${editA.durations.includes(m) ? "border-ink bg-ink text-white" : "border-line"}`}>{m}</button>)}
            </div>
          </Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label={d.starsLabel}><input type="number" min={0} max={5} value={editA.stars} onChange={(e) => setEditA({ ...editA, stars: Number(e.target.value) })} className={input} /></Field>
            <Field label={`${d.maxPerDay} (${d.noLimit}: 0)`}><input type="number" min={0} step={5} value={editA.max_minutes_per_day ?? 0} onChange={(e) => setEditA({ ...editA, max_minutes_per_day: Number(e.target.value) > 0 ? Number(e.target.value) : null })} className={input} /></Field>
          </div>
        </Sheet>
      )}
    </main>
  );
}
