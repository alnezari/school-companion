"use client";
import Link from "next/link";
import type { Dict } from "@/lib/i18n";

export function ParentNav({ active, d }: { active: "week" | "weeks"; d: Dict }) {
  const items: [typeof active, string, string][] = [["week", "/parent/school", `📅 ${d.currentWeek}`], ["weeks", "/parent/school/weeks", `🗂 ${d.weeks}`]];
  return (
    <nav className="mt-2 grid grid-cols-2 gap-1.5">
      {items.map(([k, href, label]) => (
        <Link key={k} href={href} className={`rounded-xl border px-1 py-1.5 text-center text-sm font-semibold ${k === active ? "border-ink bg-ink text-white" : "border-line bg-white"}`}>{label}</Link>
      ))}
    </nav>
  );
}
