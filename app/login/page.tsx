"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase/client";

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true); setError(null);
    const { error } = await supabase().auth.signInWithPassword({ email: email.trim(), password });
    setBusy(false);
    if (error) { setError(error.message); return; }
    router.replace("/");
    router.refresh();
  }

  return (
    <main className="min-h-dvh grid place-items-center p-6 bg-kid">
      <form onSubmit={submit} className="w-full max-w-sm bg-white rounded-3xl p-8 shadow-sm border border-line rise">
        <div className="text-5xl mb-3">🎒</div>
        <h1 className="font-display text-2xl font-extrabold">Tomorrow First</h1>
        <p className="text-ink-2 mt-1 mb-6">Family sign in · تسجيل دخول العائلة</p>
        <label className="block text-sm font-medium mb-1">Email</label>
        <input className="w-full border border-line rounded-xl px-3 py-2 mb-4" type="email" autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
        <label className="block text-sm font-medium mb-1">Password</label>
        <input className="w-full border border-line rounded-xl px-3 py-2 mb-4" type="password" autoComplete="current-password" value={password} onChange={(e) => setPassword(e.target.value)} required />
        {error && <p className="text-red text-sm mb-3">{error}</p>}
        <button disabled={busy} className="w-full bg-accent text-white rounded-xl py-3 font-semibold disabled:opacity-60">{busy ? "…" : "Sign in · دخول"}</button>
      </form>
    </main>
  );
}
