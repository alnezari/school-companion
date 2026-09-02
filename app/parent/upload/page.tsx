"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useLang } from "@/lib/lang";
import { t } from "@/lib/i18n";
import { signedUrl } from "@/lib/data";
import { isParentUnlocked } from "@/components/ParentGate";
import { LangToggle } from "@/components/LangToggle";

type Result = { ok?: boolean; error?: string; message?: string; problems?: string[]; storagePath?: string; confidence?: string;
  issues?: { en: string; ar: string }[]; what_i_saw?: string; counts?: { items: number; placed: number; unplaced: number };
  dates_mentioned?: { text: string; date: string | null; kind: string }[]; start?: string; end?: string };

export default function UploadPage() {
  const router = useRouter();
  const [lang, setLang] = useLang("parent");
  const d = t(lang);
  const [file, setFile] = useState<File | null>(null);
  const [phase, setPhase] = useState<"idle" | "sending" | "reading" | "done">("idle");
  const [result, setResult] = useState<Result | null>(null);
  const [docUrl, setDocUrl] = useState<string | null>(null);
  useEffect(() => { if (!isParentUnlocked()) router.replace("/"); }, [router]);

  async function go() {
    if (!file) return;
    setPhase("sending"); setResult(null);
    const fd = new FormData(); fd.append("file", file);
    const timer = setTimeout(() => setPhase("reading"), 2500);
    try {
      const res = await fetch("/api/parse-week", { method: "POST", body: fd });
      const json = (await res.json()) as Result;
      setResult(json);
      if (json.storagePath) setDocUrl(await signedUrl(json.storagePath));
    } catch (e) {
      setResult({ error: "network", message: e instanceof Error ? e.message : String(e) });
    } finally { clearTimeout(timer); setPhase("done"); }
  }

  return (
    <main className="min-h-dvh px-4 py-4">
      <div className="mx-auto max-w-xl">
        <div className="flex items-center gap-2">
          <Link href="/parent" className="rounded-full border border-line bg-white px-3 py-1.5 text-sm font-semibold">←</Link>
          <h1 className="font-display text-xl font-extrabold">{d.uploadTitle}</h1>
          <LangToggle lang={lang} setLang={setLang} className="ms-auto" />
        </div>
        <p className="mt-2 text-ink-2">{d.uploadBody}</p>

        {phase === "idle" && (
          <div className="mt-4 rounded-2xl border border-line bg-white p-4">
            <input type="file" accept="application/pdf,image/jpeg,image/png,image/webp" onChange={(e) => setFile(e.target.files?.[0] ?? null)} className="block w-full text-sm" />
            <button disabled={!file} onClick={go} className="mt-4 w-full rounded-xl bg-accent py-3 font-semibold text-white disabled:opacity-50">{d.upload}</button>
          </div>
        )}
        {(phase === "sending" || phase === "reading") && (
          <div className="mt-6 rounded-2xl bg-white p-8 text-center">
            <div className="mx-auto h-10 w-10 animate-spin rounded-full border-4 border-line border-t-accent" />
            <p className="mt-4 font-semibold">{phase === "sending" ? d.stored : d.reading}</p>
          </div>
        )}
        {phase === "done" && result && (
          <div className={`mt-4 rounded-2xl border-s-4 bg-white p-4 ${result.ok ? (result.confidence === "green" ? "border-green" : "border-orange") : "border-red"}`}>
            <h2 className="font-display text-lg font-extrabold">{result.ok ? `✅ ${d.uploadDone}` : `⛔ ${d.uploadFail}`}</h2>
            {result.ok && <p className="text-sm text-ink-2">{result.start} → {result.end} · {result.counts?.placed} / {result.counts?.items} · {d.confidence[(result.confidence ?? "orange") as "green" | "orange" | "red"]}</p>}
            {result.what_i_saw && <p dir="auto" className="mt-2 text-sm"><b>{d.sawInstead}:</b> {result.what_i_saw}</p>}
            {result.message && !result.ok && <p dir="auto" className="mt-2 text-sm text-red">{result.message}</p>}
            {result.problems && result.problems.length > 0 && <ul className="mt-2 list-disc ps-5 text-sm">{result.problems.map((p, i) => <li key={i}>{p}</li>)}</ul>}
            {result.issues && result.issues.length > 0 && (
              <><h3 className="mt-3 text-sm font-bold">{d.issues}</h3><ul className="list-disc ps-5 text-sm">{result.issues.map((i, k) => <li key={k} dir="auto">{i[lang]}</li>)}</ul></>
            )}
            {result.dates_mentioned && result.dates_mentioned.length > 0 && (
              <><h3 className="mt-3 text-sm font-bold">{d.detected}</h3><ul className="list-disc ps-5 text-sm">{result.dates_mentioned.map((x, k) => <li key={k} dir="auto">{x.date ? `${x.date}: ` : ""}{x.text}</li>)}</ul></>
            )}
            {docUrl && <a href={docUrl} target="_blank" rel="noreferrer" className="mt-3 block text-sm font-semibold text-accent underline">📎 {d.original}</a>}
            <div className="mt-4 flex gap-2">
              <Link href="/parent" className="flex-1 rounded-xl bg-accent py-2 text-center font-semibold text-white">{d.backToWeek}</Link>
              <button onClick={() => { setPhase("idle"); setFile(null); setResult(null); }} className="flex-1 rounded-xl border border-line py-2 font-semibold">{d.tryAgain}</button>
            </div>
          </div>
        )}
      </div>
    </main>
  );
}
