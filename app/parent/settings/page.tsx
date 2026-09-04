"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useLang } from "@/lib/lang";
import { t } from "@/lib/i18n";
import { loadSettings, saveSetting } from "@/lib/data";
import { supabase } from "@/lib/supabase/client";
import { isParentUnlocked } from "@/components/ParentGate";
import { LangToggle } from "@/components/LangToggle";

// Global settings: things that belong to no single app.
export default function SettingsPage() {
  const router = useRouter();
  const [lang, setLang] = useLang("parent");
  const d = t(lang);
  const [name, setName] = useState("");
  const [pin, setPin] = useState("");
  const [saved, setSaved] = useState(false);
  const [email, setEmail] = useState("");
  const [newEmail, setNewEmail] = useState("");
  const [pw, setPw] = useState(""); const [pw2, setPw2] = useState("");
  const [msg, setMsg] = useState<string | null>(null);
  useEffect(() => { if (!isParentUnlocked()) router.replace("/"); }, [router]);
  useEffect(() => {
    loadSettings().then((s) => { setName(s.child_name ?? ""); setPin(s.parent_pin ?? ""); });
    (async () => { const { data } = await supabase().auth.getUser(); setEmail(data.user?.email ?? ""); })();
  }, []);
  async function updateAccount(e: React.FormEvent) {
    e.preventDefault(); setMsg(null);
    if (pw || pw2) {
      if (pw.length < 6) return setMsg(d.passwordShort);
      if (pw !== pw2) return setMsg(d.passwordMismatch);
      const { error } = await supabase().auth.updateUser({ password: pw });
      if (error) return setMsg(error.message);
      setPw(""); setPw2(""); setMsg(d.passwordUpdated);
    }
    if (newEmail.trim() && newEmail.trim() !== email) {
      const { error } = await supabase().auth.updateUser({ email: newEmail.trim() });
      if (error) return setMsg(error.message);
      setNewEmail(""); setMsg(d.emailSent);
    }
  }

  async function save(e: React.FormEvent) {
    e.preventDefault();
    await Promise.all([saveSetting("child_name", name.trim()), saveSetting("parent_pin", pin.trim())]);
    setSaved(true); setTimeout(() => setSaved(false), 1500);
  }
  async function logout() { await supabase().auth.signOut(); router.replace("/login"); router.refresh(); }

  return (
    <main className="min-h-dvh px-4 py-4">
      <div className="mx-auto max-w-sm">
        <div className="flex items-center gap-2">
          <Link href="/parent" className="rounded-full border border-line bg-white px-3 py-1.5 text-sm font-semibold">←</Link>
          <h1 className="font-display text-xl font-extrabold">⚙ {d.settings}</h1>
        </div>
        <form onSubmit={save} className="mt-4 rounded-2xl border border-line bg-white p-4">
          <label className="block text-sm font-medium">{d.childName}</label>
          <input value={name} onChange={(e) => setName(e.target.value)} className="mt-1 w-full rounded-xl border border-line bg-white px-3 py-2" />
          <label className="mt-4 block text-sm font-medium">{d.changePin}</label>
          <input value={pin} onChange={(e) => setPin(e.target.value)} inputMode="numeric" className="mt-1 w-full rounded-xl border border-line bg-white px-3 py-2" />
          <div className="mt-4 flex items-center justify-between"><span className="text-sm font-medium">{d.language}</span><LangToggle lang={lang} setLang={setLang} /></div>
          <button className="mt-4 w-full rounded-xl bg-ink py-2 font-semibold text-white">{saved ? d.saved : d.save}</button>
        </form>
        <form onSubmit={updateAccount} className="mt-3 rounded-2xl border border-line bg-white p-4">
          <h2 className="font-display font-extrabold">👤 {d.account}</h2>
          <p className="mt-1 text-sm text-ink-2">{d.email}: {email || "…"}</p>
          <label className="mt-3 block text-sm font-medium">{d.newEmail}</label>
          <input type="email" value={newEmail} onChange={(e) => setNewEmail(e.target.value)} autoComplete="off" className="mt-1 w-full rounded-xl border border-line bg-white px-3 py-2" />
          <div className="mt-3 grid grid-cols-2 gap-3">
            <label className="block text-sm font-medium">{d.newPassword}<input type="password" value={pw} onChange={(e) => setPw(e.target.value)} autoComplete="new-password" className="mt-1 w-full rounded-xl border border-line bg-white px-3 py-2" /></label>
            <label className="block text-sm font-medium">{d.confirmPassword}<input type="password" value={pw2} onChange={(e) => setPw2(e.target.value)} autoComplete="new-password" className="mt-1 w-full rounded-xl border border-line bg-white px-3 py-2" /></label>
          </div>
          {msg && <p className="mt-2 text-sm font-semibold text-accent">{msg}</p>}
          <button className="mt-4 w-full rounded-xl bg-ink py-2 font-semibold text-white">{d.update}</button>
        </form>
        <button type="button" onClick={logout} className="mt-4 w-full rounded-xl border border-line py-2 text-sm font-semibold text-ink-2">{d.logout}</button>
      </div>
    </main>
  );
}
