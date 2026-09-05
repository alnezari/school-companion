"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { motion } from "motion/react";
import { useLang } from "@/lib/lang";
import { t } from "@/lib/i18n";
import { loadSettings } from "@/lib/data";
import { SPRING, TAP, enter } from "@/lib/motion";
import { ParentGate, UNLOCK_KEY } from "@/components/ParentGate";
import { kidBtn } from "@/components/KidTop";

// The child's launcher: two big "apps" like a store. Tap one and the tile itself grows into its page.
export default function Launcher() {
  const router = useRouter();
  const [lang] = useLang("kid");
  const d = t(lang);
  const [settings, setSettings] = useState<Record<string, string>>({});
  const [gate, setGate] = useState(false);
  useEffect(() => { loadSettings().then(setSettings); }, []);
  useEffect(() => { router.prefetch("/school"); router.prefetch("/day"); }, [router]);
  const name = settings.child_name || "Taym";
  const apps = [
    { href: "/school", icon: "📚", title: d.schoolApp, sub: d.schoolAppSub, bg: "linear-gradient(160deg,#FFB347,#F27D26)" },
    { href: "/day", icon: "🗓️", title: d.dayApp, sub: d.dayAppSub, bg: "linear-gradient(160deg,#5AC8FA,#2457C5)" },
  ];
  // Press, a short squash, then go. The page fades in on the other side.
  function open(href: string) { setTimeout(() => router.push(href), 110); }
  return (
    <main className="min-h-dvh bg-kid px-4 pb-8 pt-4 sm:px-6 lg:px-10">
      <motion.header {...enter(0)} className="mx-auto flex max-w-5xl items-start justify-between gap-3">
        <h1 className="font-display text-3xl font-extrabold sm:text-4xl">{d.hi} {name} 👋</h1>
        <motion.button whileTap={TAP} transition={SPRING.follow} onClick={() => { if (settings.parent_pin_enabled === "false") { try { sessionStorage.setItem(UNLOCK_KEY, "1"); } catch {} router.push("/parent"); } else setGate(true); }} className={`${kidBtn} text-base`}>🔒 {d.parents}</motion.button>
      </motion.header>
      <div className="mx-auto mt-8 grid max-w-5xl grid-cols-1 gap-5 sm:grid-cols-2 sm:gap-8">
        {apps.map((a, i) => (
          <motion.button key={a.href} {...enter(i + 1)} whileTap={{ scale: 0.95 }} onClick={() => open(a.href)}
            className="flex min-h-56 flex-col items-center justify-center rounded-[2rem] p-8 text-center text-white shadow-lg sm:min-h-72" style={{ background: a.bg }}>
            <span className="text-7xl drop-shadow sm:text-8xl">{a.icon}</span>
            <span className="mt-4 font-display text-3xl font-extrabold sm:text-4xl">{a.title}</span>
            <span className="mt-1 text-lg text-white/90">{a.sub}</span>
          </motion.button>
        ))}
      </div>
      <motion.div {...enter(3)} className="mx-auto mt-6 flex max-w-5xl justify-center">
        <motion.a whileTap={TAP} transition={SPRING.follow} href="/stars" className={`${kidBtn} px-6`}>⭐ {d.stars}</motion.a>
      </motion.div>
      {gate && <ParentGate pin={settings.parent_pin || "1234"} d={d} onClose={() => setGate(false)} />}
    </main>
  );
}
