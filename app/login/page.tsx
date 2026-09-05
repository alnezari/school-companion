"use client";
import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase/client";
import { useLang } from "@/lib/lang";
import { t } from "@/lib/i18n";

export default function LoginPage() {
  const router = useRouter();
  const [lang] = useLang();
  const d = t(lang);
  const [pinEnabled, setPinEnabled] = useState<boolean | null>(null);
  const [usePin, setUsePin] = useState(true);
  const [pin, setPin] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const pinRef = useRef<HTMLInputElement>(null);
  useEffect(() => { fetch("/api/pin-login").then((r) => r.json()).then((j) => setPinEnabled(!!j.enabled)).catch(() => setPinEnabled(false)); }, []);
  useEffect(() => { if (pinEnabled && usePin) pinRef.current?.focus(); }, [pinEnabled, usePin]);

  function done() { router.replace("/"); router.refresh(); }
  async function submitPin(value: string) {
    setBusy(true); setError(null);
    const res = await fetch("/api/pin-login", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ pin: value }) });
    setBusy(false);
    if (res.ok) return done();
    const j = await res.json().catch(() => ({}));
    setPin("");
    setError(j.error === "locked" ? d.lockedOut : j.error === "wrong" ? d.pinWrong : j.message || d.notifError);
  }
  async function submitPassword(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true); setError(null);
    const { error } = await supabase().auth.signInWithPassword({ email: email.trim(), password });
    setBusy(false);
    if (error) { setError(error.message); return; }
    done();
  }
  const showPin = pinEnabled && usePin;

  return (
    <main className="min-h-dvh grid place-items-center p-6 bg-kid">
      <div className="w-full max-w-sm bg-white rounded-3xl p-8 shadow-sm border border-line rise">
        <div className="text-5xl mb-3">🎒</div>
        <h1 className="font-display text-2xl font-extrabold">Tomorrow First</h1>
        {pinEnabled === null ? <p className="mt-6 text-center text-ink-2">…</p> : showPin ? (
          <>
            <p className="text-ink-2 mt-1 mb-6">{d.pinLoginTitle}</p>
            <input ref={pinRef} value={pin} inputMode="numeric" autoComplete="one-time-code" type="password" maxLength={6} disabled={busy}
              onChange={(e) => { const v = e.target.value.replace(/\D/g, "").slice(0, 6); setPin(v); if (v.length === 6) submitPin(v); }}
              className="w-full rounded-2xl border border-line px-3 py-4 text-center font-display text-3xl tracking-[.5em]" />
            <div className="mt-3 flex justify-center gap-2">{[0, 1, 2, 3, 4, 5].map((i) => <span key={i} className={`h-2.5 w-2.5 rounded-full ${i < pin.length ? "bg-accent" : "bg-line"}`} />)}</div>
            {error && <p className="text-red text-sm mt-3 text-center">{error}</p>}
            <button type="button" onClick={() => { setUsePin(false); setError(null); }} className="mt-6 w-full text-sm font-semibold text-ink-2">{d.useEmail}</button>
          </>
        ) : (
          <form onSubmit={submitPassword}>
            <p className="text-ink-2 mt-1 mb-6">Family sign in · تسجيل دخول العائلة</p>
            <label className="block text-sm font-medium mb-1">Email</label>
            <input className="w-full border border-line rounded-xl px-3 py-2 mb-4" type="email" autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
            <label className="block text-sm font-medium mb-1">Password</label>
            <input className="w-full border border-line rounded-xl px-3 py-2 mb-4" type="password" autoComplete="current-password" value={password} onChange={(e) => setPassword(e.target.value)} required />
            {error && <p className="text-red text-sm mb-3">{error}</p>}
            <button disabled={busy} className="w-full bg-accent text-white rounded-xl py-3 font-semibold disabled:opacity-60">{busy ? "…" : "Sign in · دخول"}</button>
            {pinEnabled && <button type="button" onClick={() => { setUsePin(true); setError(null); }} className="mt-4 w-full text-sm font-semibold text-ink-2">{d.usePin}</button>}
          </form>
        )}
      </div>
    </main>
  );
}
