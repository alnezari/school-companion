"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "motion/react";
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
  const [opening, setOpening] = useState<{ href: string; bg: string; icon: string; x: number; y: number; w: number; h: number } | null>(null);
  useEffect(() => { loadSettings().then(setSettings); }, []);
  useEffect(() => { router.prefetch("/school"); router.prefetch("/day"); }, [router]);
  const name = settings.child_name || "Taym";
  const apps = [
    { href: "/school", icon: "📚", title: d.schoolApp, sub: d.schoolAppSub, bg: "linear-gradient(160deg,#FFB347,#F27D26)" },
    { href: "/day", icon: "🗓️", title: d.dayApp, sub: d.dayAppSub, bg: "linear-gradient(160deg,#5AC8FA,#2457C5)" },
  ];
  function open(e: React.MouseEvent<HTMLElement>, a: (typeof apps)[number]) {
    const r = e.currentTarget.getBoundingClientRect();
    setOpening({ href: a.href, bg: a.bg, icon: a.icon, x: r.left, y: r.top, w: r.width, h: r.height });
  }
  return (
    <main className="min-h-dvh bg-kid px-4 pb-8 pt-4 sm:px-6 lg:px-10">
      <motion.header {...enter(0)} className="mx-auto flex max-w-5xl items-start justify-between gap-3">
        <h1 className="font-display text-3xl font-extrabold sm:text-4xl">{d.hi} {name} 👋</h1>
        <motion.button whileTap={TAP} transition={SPRING.follow} onClick={() => { if (settings.parent_pin_enabled === "false") { try { sessionStorage.setItem(UNLOCK_KEY, "1"); } catch {} router.push("/parent"); } else setGate(true); }} className={`${kidBtn} text-base`}>🔒 {d.parents}</motion.button>
      </motion.header>
      <div className="mx-auto mt-8 grid max-w-5xl grid-cols-1 gap-5 sm:grid-cols-2 sm:gap-8">
        {apps.map((a, i) => (
          <motion.button key={a.href} {...enter(i + 1)} whileTap={{ scale: 0.97 }} onClick={(e) => open(e, a)}
            className="flex min-h-56 flex-col items-center justify-center rounded-[2rem] p-8 text-center text-white shadow-lg sm:min-h-72" style={{ background: a.bg, opacity: opening?.href === a.href ? 0 : undefined }}>
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
      <AnimatePresence>
        {opening && (
          <motion.div key="expander" className="fixed z-50 grid place-items-center text-8xl text-white"
            initial={{ left: opening.x, top: opening.y, width: opening.w, height: opening.h, borderRadius: 32 }}
            animate={{ left: 0, top: 0, width: "100vw", height: "100dvh", borderRadius: 0 }}
            transition={{ duration: 0.36, ease: [0.165, 0.84, 0.44, 1] }}
            onAnimationComplete={() => router.push(opening.href)}
            style={{ background: opening.bg }}>
            <motion.span initial={{ scale: 1 }} animate={{ scale: 1.25, opacity: 0.9 }} transition={SPRING.gentle}>{opening.icon}</motion.span>
          </motion.div>
        )}
      </AnimatePresence>
    </main>
  );
}
