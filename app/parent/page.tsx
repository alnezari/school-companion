"use client";
import { useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useLang } from "@/lib/lang";
import { t } from "@/lib/i18n";
import { LangToggle } from "@/components/LangToggle";
import { isParentUnlocked } from "@/components/ParentGate";

// The parents' launcher mirrors the child's: one tile per app, plus global settings.
export default function ParentHome() {
  const router = useRouter();
  const [lang, setLang] = useLang("parent");
  const d = t(lang);
  useEffect(() => { if (!isParentUnlocked()) router.replace("/"); }, [router]);
  const apps = [
    { href: "/parent/school", icon: "📚", title: d.schoolApp, sub: `${d.currentWeek} · ${d.weeks} · ${d.calendar}`, bg: "linear-gradient(160deg,#FFB347,#F27D26)" },
    { href: "/parent/day", icon: "🗓️", title: d.dayTitle, sub: `${d.dayWindow} · ${d.activities}`, bg: "linear-gradient(160deg,#5AC8FA,#2457C5)" },
  ];
  return (
    <main className="min-h-dvh px-4 pb-8 pt-4 sm:px-6">
      <header className="mx-auto flex max-w-3xl items-center justify-between gap-3">
        <h1 className="font-display text-2xl font-extrabold">🔒 {d.parentsHome}</h1>
        <div className="flex items-center gap-2">
          <LangToggle lang={lang} setLang={setLang} />
          <Link href="/" className="rounded-full border border-line bg-white px-3 py-1.5 text-sm font-semibold">🎒</Link>
        </div>
      </header>
      <div className="mx-auto mt-6 grid max-w-3xl grid-cols-1 gap-4 sm:grid-cols-2">
        {apps.map((a, i) => (
          <Link key={a.href} href={a.href} className="rise flex min-h-44 flex-col items-center justify-center rounded-3xl p-6 text-center text-white shadow-md transition active:scale-[.98]" style={{ background: a.bg, animationDelay: `${i * 90}ms` }}>
            <span className="text-6xl drop-shadow">{a.icon}</span>
            <span className="mt-3 font-display text-2xl font-extrabold">{a.title}</span>
            <span className="mt-1 text-sm text-white/90">{a.sub}</span>
          </Link>
        ))}
      </div>
      <div className="mx-auto mt-4 max-w-3xl">
        <Link href="/parent/settings" className="flex items-center gap-3 rounded-2xl border border-line bg-white px-4 py-3 font-semibold">⚙ {d.settings}<span className="ms-auto text-ink-2">›</span></Link>
      </div>
    </main>
  );
}
