"use client";
import Link from "next/link";
import type { ReactNode } from "react";

const btn = "grid h-11 min-w-11 place-items-center rounded-full bg-white px-3 font-display text-lg font-extrabold shadow-sm transition active:scale-95";
export function KidTop({ title, sub, stars, className = "" }: { title: ReactNode; sub?: ReactNode; stars?: number | null; className?: string }) {
  return (
    <header className={`mx-auto flex items-start justify-between gap-3 ${className}`}>
      <div className="min-w-0">
        <h1 className="font-display text-3xl font-extrabold sm:text-4xl">{title}</h1>
        {sub && <p className="text-lg text-ink-2">{sub}</p>}
      </div>
      <div className="flex shrink-0 items-center gap-2">
        <Link href="/" aria-label="Home" className={btn}>🏠</Link>
        {stars !== undefined && <Link href="/stars" aria-label="Stars" className={btn}>⭐{stars != null && <span className="ms-1">{stars}</span>}</Link>}
      </div>
    </header>
  );
}
