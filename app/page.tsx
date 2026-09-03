"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { useLang } from "@/lib/lang";
import { t } from "@/lib/i18n";
import { loadSettings } from "@/lib/data";
import { LangToggle } from "@/components/LangToggle";
import { ParentGate } from "@/components/ParentGate";

// The child's launcher: two big "apps" like a store. More can be added here later.
export default function Launcher() {
  const [lang, setLang] = useLang("kid");
  const d = t(lang);
  const [settings, setSettings] = useState<Record<string, string>>({});
  const [gate, setGate] = useState(false);
  useEffect(() => { loadSettings().then(setSettings); }, []);
  const name = settings.child_name || "Taym";
  const apps = [
    { href: "/school", icon: "📚", title: d.schoolApp, sub: d.schoolAppSub, bg: "linear-gradient(160deg,#FFB347,#F27D26)" },
    { href: "/day", icon: "🗓️", title: d.dayApp, sub: d.dayAppSub, bg: "linear-gradient(160deg,#5AC8FA,#2457C5)" },
  ];
  return (
    <main className="min-h-dvh bg-kid px-4 pb-8 pt-4 sm:px-6 lg:px-10">
      <header className="mx-auto flex max-w-5xl items-start justify-between gap-3">
        <h1 className="font-display text-3xl font-extrabold sm:text-4xl">{d.hi} {name} 👋</h1>
        <div className="flex items-center gap-2">
          <LangToggle lang={lang} setLang={setLang} />
          <button onClick={() => setGate(true)} className="rounded-full border border-line bg-white px-3 py-1.5 text-sm font-semibold text-ink-2">🔒 {d.parents}</button>
        </div>
      </header>
      <div className="mx-auto mt-8 grid max-w-5xl grid-cols-1 gap-5 sm:grid-cols-2 sm:gap-8">
        {apps.map((a, i) => (
          <Link key={a.href} href={a.href} className="rise flex min-h-56 flex-col items-center justify-center rounded-[2rem] p-8 text-center text-white shadow-lg transition active:scale-[.97] sm:min-h-72"
            style={{ background: a.bg, animationDelay: `${i * 90}ms` }}>
            <span className="text-7xl drop-shadow sm:text-8xl">{a.icon}</span>
            <span className="mt-4 font-display text-3xl font-extrabold sm:text-4xl">{a.title}</span>
            <span className="mt-1 text-lg text-white/90">{a.sub}</span>
          </Link>
        ))}
      </div>
      <div className="mx-auto mt-6 flex max-w-5xl justify-center">
        <Link href="/stars" className="rounded-2xl bg-white px-6 py-3 font-display text-lg font-extrabold shadow-sm">⭐ {d.stars}</Link>
      </div>
      {gate && <ParentGate pin={settings.parent_pin || "1234"} d={d} onClose={() => setGate(false)} />}
    </main>
  );
}
