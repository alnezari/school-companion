"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useLang } from "@/lib/lang";
import { t, DAY_SHORT } from "@/lib/i18n";
import { todayISO, schoolDay } from "@/lib/schedule";
import { loadLatestTimetable, loadPeriodsFor, signedUrl, updatePeriod, type Timetable } from "@/lib/data";
import type { Period } from "@/lib/placement";
import { SUBJECTS, type SubjectKey } from "@/lib/subjects";
import { LangToggle } from "@/components/LangToggle";
import { isParentUnlocked } from "@/components/ParentGate";
import { ParentNav } from "@/components/ParentNav";

type Result = { ok?: boolean; error?: string; message?: string; problems?: string[]; issues?: { en: string; ar: string }[]; count?: number; what_i_saw?: string; storagePath?: string };

export default function TimetablePage() {
  const router = useRouter();
  const [lang, setLang] = useLang("parent");
  const d = t(lang);
  const [tt, setTt] = useState<Timetable | null>(null);
  const [periods, setPeriods] = useState<Period[]>([]);
  const [day, setDay] = useState(0);
  const [docUrl, setDocUrl] = useState<string | null>(null);
  const [file, setFile] = useState<File | null>(null);
  const [validFrom, setValidFrom] = useState(todayISO());
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<Result | null>(null);
  const [showUpload, setShowUpload] = useState(false);

  useEffect(() => { if (!isParentUnlocked()) router.replace("/"); }, [router]);
  useEffect(() => { setDay(schoolDay(todayISO()) ?? 0); }, []);
  async function load() {
    const t0 = await loadLatestTimetable();
    setTt(t0);
    if (t0) { setPeriods(await loadPeriodsFor(t0.id)); setDocUrl(t0.source_path ? await signedUrl(t0.source_path) : null); }
  }
  useEffect(() => { load(); }, []);

  async function change(p: Period, patch: { subject_key?: string; teacher?: string | null }) {
    if (!tt) return;
    setPeriods((ps) => ps.map((x) => (x.day === p.day && x.slot === p.slot ? { ...x, ...patch } as Period : x)));
    await updatePeriod(tt.id, p.day, p.slot, patch);
  }
  async function upload() {
    if (!file) return;
    setBusy(true); setResult(null);
    const fd = new FormData(); fd.append("file", file); fd.append("valid_from", validFrom);
    try {
      const res = await fetch("/api/parse-timetable", { method: "POST", body: fd });
      const json = (await res.json()) as Result;
      setResult(json);
      if (json.ok) { await load(); setShowUpload(false); }
    } catch (e) { setResult({ error: "network", message: e instanceof Error ? e.message : String(e) }); }
    finally { setBusy(false); }
  }

  const keys = Object.keys(SUBJECTS) as SubjectKey[];
  return (
    <main className="min-h-dvh px-3 pb-10 pt-3 sm:px-6">
      <div className="mx-auto max-w-3xl">
        <div className="flex flex-wrap items-center gap-2">
          <Link href="/parent" className="rounded-full border border-line bg-white px-3 py-1.5 text-sm font-semibold">←</Link>
          <h1 className="font-display text-xl font-extrabold">🗓 {d.timetable}</h1>
          <LangToggle lang={lang} setLang={setLang} className="ms-auto" />
        </div>
        <ParentNav active="timetable" d={d} />
        {tt && (
          <p className="mt-2 text-sm text-ink-2">{tt.name} · {d.validFrom} {tt.valid_from}
            {docUrl && <> · <a href={docUrl} target="_blank" rel="noreferrer" className="font-semibold text-accent underline">📎 {d.original}</a></>}
          </p>
        )}
        {tt && tt.issues.length > 0 && (
          <ul className="mt-2 list-disc rounded-2xl border-s-4 border-orange bg-orange-soft p-3 ps-8 text-sm">{tt.issues.map((i, k) => <li key={k} dir="auto">{i[lang]}</li>)}</ul>
        )}

        <button onClick={() => setShowUpload((v) => !v)} className="mt-3 block w-full rounded-2xl bg-accent px-4 py-3 text-center font-semibold text-white">📄 {d.uploadTimetable}</button>
        {showUpload && (
          <div className="mt-2 rounded-2xl border border-line bg-white p-4">
            <p className="text-sm text-ink-2">{d.ttBody}</p>
            <label className="mt-3 block text-sm font-medium">{d.validFrom}</label>
            <input type="date" value={validFrom} onChange={(e) => setValidFrom(e.target.value)} className="mt-1 rounded-xl border border-line px-3 py-2" />
            <input type="file" accept="application/pdf,image/jpeg,image/png,image/webp" onChange={(e) => setFile(e.target.files?.[0] ?? null)} className="mt-3 block w-full text-sm" />
            <button disabled={!file || busy} onClick={upload} className="mt-3 w-full rounded-xl bg-accent py-3 font-semibold text-white disabled:opacity-50">{busy ? d.ttReading : d.uploadTimetable}</button>
            <p className="mt-2 text-xs text-ink-2">{d.ttNote}</p>
          </div>
        )}
        {result && (
          <div className={`mt-2 rounded-2xl border-s-4 bg-white p-3 text-sm ${result.ok ? "border-green" : "border-red"}`}>
            <b>{result.ok ? `✅ ${d.ttUploaded} · ${result.count} ${d.periodsRead}` : `⛔ ${d.uploadFail}`}</b>
            {result.what_i_saw && <p dir="auto">{result.what_i_saw}</p>}
            {result.message && !result.ok && <p className="text-red">{result.message}</p>}
            {(result.issues ?? []).map((i, k) => <p key={k} dir="auto">• {i[lang]}</p>)}
            {(result.problems ?? []).map((p, k) => <p key={k}>• {p}</p>)}
          </div>
        )}

        <div className="mt-4 grid grid-cols-5 gap-1.5">
          {DAY_SHORT[lang].map((n, i) => (
            <button key={i} onClick={() => setDay(i)} className={`rounded-xl border py-2 text-sm font-semibold ${i === day ? "border-accent bg-accent text-white" : "border-line bg-white"}`}>{n}</button>
          ))}
        </div>
        <div className="mt-2 grid gap-1.5">
          {periods.filter((p) => p.day === day).map((p) => (
            <div key={p.slot} className="grid grid-cols-[24px_64px_1fr_1fr] items-center gap-2 rounded-xl border border-line bg-white px-3 py-2 text-sm tabular-nums">
              <span className="font-bold text-ink-2">{p.slot}</span>
              <span className="text-xs text-ink-2">{p.start_time.slice(0, 5)}–{p.end_time.slice(0, 5)}</span>
              <select value={p.subject_key} onChange={(e) => change(p, { subject_key: e.target.value })} className="rounded-lg border border-line bg-white px-2 py-1" style={{ color: SUBJECTS[p.subject_key]?.color }}>
                {keys.map((k) => <option key={k} value={k}>{SUBJECTS[k].icon} {SUBJECTS[k][lang]}</option>)}
                {!SUBJECTS[p.subject_key] && <option value={p.subject_key}>? {p.subject_key}</option>}
              </select>
              <input defaultValue={p.teacher ?? ""} placeholder={d.teacher} onBlur={(e) => e.target.value !== (p.teacher ?? "") && change(p, { teacher: e.target.value || null })} className="rounded-lg border border-line px-2 py-1" />
            </div>
          ))}
        </div>
      </div>
    </main>
  );
}
