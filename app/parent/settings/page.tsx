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
  useEffect(() => { if (!isParentUnlocked()) router.replace("/"); }, [router]);
  useEffect(() => { loadSettings().then((s) => { setName(s.child_name ?? ""); setPin(s.parent_pin ?? ""); }); }, []);

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
        <button type="button" onClick={logout} className="mt-4 w-full rounded-xl border border-line py-2 text-sm font-semibold text-ink-2">{d.logout}</button>
      </div>
    </main>
  );
}
