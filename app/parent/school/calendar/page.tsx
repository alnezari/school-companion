"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useLang } from "@/lib/lang";
import { t } from "@/lib/i18n";
import { todayISO, formatDate, weekday } from "@/lib/schedule";
import { deleteEvent, loadEvents, saveEvent, type EventRow } from "@/lib/data";
import { SUBJECTS, type SubjectKey } from "@/lib/subjects";
import { ParentNav } from "@/components/ParentNav";
import { isParentUnlocked } from "@/components/ParentGate";

const KIND_STYLE: Record<EventRow["kind"], string> = {
  holiday: "bg-green-soft text-green border-green", exam: "bg-red-soft text-red border-red",
  due: "bg-orange-soft text-orange border-orange", event: "bg-accent-soft text-accent border-accent",
};
const KIND_ICON: Record<EventRow["kind"], string> = { holiday: "🏖️", exam: "📝", due: "📌", event: "📍" };
const empty = { title: "", date: "", kind: "event" as EventRow["kind"], subject_key: "" };

export default function CalendarPage() {
  const router = useRouter();
  const [lang] = useLang("parent");
  const d = t(lang);
  const [events, setEvents] = useState<EventRow[] | null>(null);
  const [today, setToday] = useState("");
  const [form, setForm] = useState<typeof empty & { id?: string }>(empty);
  const [showForm, setShowForm] = useState(false);
  const [showPast, setShowPast] = useState(false);
  useEffect(() => { if (!isParentUnlocked()) router.replace("/"); }, [router]);
  useEffect(() => { setToday(todayISO()); loadEvents().then(setEvents); }, []);

  const daysAway = (date: string) => Math.round((new Date(date + "T12:00:00Z").getTime() - new Date(today + "T12:00:00Z").getTime()) / 86400000);
  const label = (n: number) => (n === 0 ? d.todayLabel : n === 1 ? d.tomorrowLabel : n < 0 ? "" : `${n} ${d.daysAway}`);
  const dayName = (date: string) => new Intl.DateTimeFormat(lang === "ar" ? "ar-SA-u-nu-latn-ca-gregory" : "en-GB", { timeZone: "UTC", weekday: "long" }).format(new Date(date + "T12:00:00Z"));

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!form.title.trim() || !form.date) return;
    const saved = await saveEvent({ id: form.id, title: form.title.trim(), date: form.date, kind: form.kind, subject_key: form.subject_key || null });
    if (saved) setEvents((ev) => [...(ev ?? []).filter((x) => x.id !== saved.id), saved].sort((a, b) => (a.date < b.date ? -1 : 1)));
    setForm(empty); setShowForm(false);
  }
  async function remove(id: string) {
    if (!confirm(d.confirmDelete)) return;
    if (await deleteEvent(id)) setEvents((ev) => (ev ?? []).filter((x) => x.id !== id));
  }
  function edit(ev: EventRow) { setForm({ id: ev.id, title: ev.title, date: ev.date, kind: ev.kind, subject_key: ev.subject_key ?? "" }); setShowForm(true); }

  const upcoming = (events ?? []).filter((e) => e.date >= today);
  const past = (events ?? []).filter((e) => e.date < today).reverse();

  const Row = ({ ev }: { ev: EventRow }) => {
    const n = daysAway(ev.date);
    const subj = ev.subject_key ? SUBJECTS[ev.subject_key as SubjectKey] : null;
    return (
      <div className={`rounded-2xl border-s-4 bg-white p-3 ${KIND_STYLE[ev.kind].split(" ")[2]} border border-line`}>
        <div className="flex items-start gap-2">
          <span className="text-xl">{KIND_ICON[ev.kind]}</span>
          <div className="min-w-0 flex-1">
            <div dir="auto" className="font-semibold">{ev.title}</div>
            <div className="text-xs text-ink-2">
              {dayName(ev.date)} {formatDate(ev.date, lang)}{ev.end_date ? ` – ${formatDate(ev.end_date, lang)}` : ""}
              {subj && <> · {subj.icon} {subj[lang]}</>}
              {ev.source === "plan" && <> · {d.fromPlan}</>}
            </div>
          </div>
          <div className="flex flex-col items-end gap-1">
            <span className={`rounded-full px-2 py-0.5 text-[11px] font-bold ${KIND_STYLE[ev.kind].split(" ").slice(0, 2).join(" ")}`}>{d.kinds[ev.kind]}</span>
            {n >= 0 && <span className="text-xs font-semibold tabular-nums">{label(n)}</span>}
          </div>
        </div>
        <div className="mt-2 flex gap-3 text-xs">
          <button onClick={() => edit(ev)} className="text-accent underline">{d.editEvent}</button>
          <button onClick={() => remove(ev.id)} className="text-red underline">{d.deleteEvent}</button>
        </div>
      </div>
    );
  };

  return (
    <main className="min-h-dvh px-3 pb-10 pt-3 sm:px-6">
      <div className="mx-auto max-w-3xl">
        <div className="flex items-center gap-2">
          <h1 className="font-display text-xl font-extrabold">📆 {d.calendar}</h1>
          <span className="ms-auto"><Link href="/parent" className="rounded-full border border-line bg-white px-3 py-1.5 text-sm font-semibold">🏠</Link></span>
        </div>
        <ParentNav active="calendar" d={d} />

        <button onClick={() => { setForm(empty); setShowForm((v) => !v); }} className="mt-3 block w-full rounded-2xl bg-accent px-4 py-3 text-center font-semibold text-white">＋ {d.addEvent}</button>
        {showForm && (
          <form onSubmit={submit} className="mt-2 grid gap-2 rounded-2xl border border-line bg-white p-4">
            <label className="text-sm font-medium">{d.title}<input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} required className="mt-1 w-full rounded-xl border border-line px-3 py-2" /></label>
            <div className="grid grid-cols-2 gap-2">
              <label className="text-sm font-medium">{d.date}<input type="date" value={form.date} onChange={(e) => setForm({ ...form, date: e.target.value })} required className="mt-1 w-full rounded-xl border border-line px-3 py-2" /></label>
              <label className="text-sm font-medium">{d.kind}
                <select value={form.kind} onChange={(e) => setForm({ ...form, kind: e.target.value as EventRow["kind"] })} className="mt-1 w-full rounded-xl border border-line bg-white px-3 py-2">
                  {(["event", "exam", "due", "holiday"] as const).map((k) => <option key={k} value={k}>{KIND_ICON[k]} {d.kinds[k]}</option>)}
                </select>
              </label>
            </div>
            <label className="text-sm font-medium">{d.subject}
              <select value={form.subject_key} onChange={(e) => setForm({ ...form, subject_key: e.target.value })} className="mt-1 w-full rounded-xl border border-line bg-white px-3 py-2">
                <option value="">{d.noSubject}</option>
                {(Object.keys(SUBJECTS) as SubjectKey[]).map((k) => <option key={k} value={k}>{SUBJECTS[k].icon} {SUBJECTS[k][lang]}</option>)}
              </select>
            </label>
            <div className="flex gap-2">
              <button type="button" onClick={() => setShowForm(false)} className="flex-1 rounded-xl border border-line py-2 font-semibold">{d.cancel}</button>
              <button type="submit" className="flex-1 rounded-xl bg-accent py-2 font-semibold text-white">{d.save}</button>
            </div>
          </form>
        )}

        {!events ? <p className="mt-6 text-center text-ink-2">…</p> : (
          <>
            <h2 className="mt-4 text-sm font-bold uppercase tracking-wider text-ink-2">{d.upcoming}</h2>
            {upcoming.length === 0 && <p className="mt-2 rounded-2xl bg-white p-4 text-center text-sm text-ink-2">{d.noEvents}</p>}
            <div className="mt-2 grid gap-2">{upcoming.map((ev) => <Row key={ev.id} ev={ev} />)}</div>
            {past.length > 0 && (
              <>
                <button onClick={() => setShowPast((v) => !v)} className="mt-4 text-sm font-bold uppercase tracking-wider text-ink-2">{showPast ? "▾" : "▸"} {d.past} ({past.length})</button>
                {showPast && <div className="mt-2 grid gap-2 opacity-70">{past.map((ev) => <Row key={ev.id} ev={ev} />)}</div>}
              </>
            )}
          </>
        )}
      </div>
    </main>
  );
}
