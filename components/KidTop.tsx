"use client";
import Link from "next/link";
import type { ReactNode } from "react";
import { motion, AnimatePresence } from "motion/react";
import { SPRING } from "@/lib/motion";

/** The one button style for the child's side: a white pill, big enough for a small hand. */
export const kidBtn = "inline-flex h-12 items-center justify-center gap-1.5 rounded-full border border-line bg-white px-4 font-display text-xl font-extrabold text-ink shadow-sm transition active:scale-95";
export function KidTop({ title, sub, stars, className = "" }: { title: ReactNode; sub?: ReactNode; stars?: number | null; className?: string }) {
  return (
    <header className={`mx-auto flex items-start justify-between gap-3 ${className}`}>
      <div className="min-w-0">
        <h1 className="font-display text-3xl font-extrabold sm:text-4xl">{title}</h1>
        {sub && <p className="text-lg text-ink-2">{sub}</p>}
      </div>
      <div className="flex shrink-0 items-center gap-2">
        <Link href="/" aria-label="Home" className={`${kidBtn} w-12 px-0`}>🏠</Link>
        {stars !== undefined && <Link href="/stars" aria-label="Stars" className={kidBtn}>⭐{stars != null && (
          <AnimatePresence mode="popLayout" initial={false}>
            <motion.span key={stars} initial={{ scale: 0.5, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 1.4, opacity: 0 }} transition={SPRING.bouncy} className="inline-block tabular-nums">{stars}</motion.span>
          </AnimatePresence>
        )}</Link>}
      </div>
    </header>
  );
}
