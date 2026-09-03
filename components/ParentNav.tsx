"use client";
import Link from "next/link";
import type { Dict } from "@/lib/i18n";

export function ParentNav({ active, d }: { active: "week" | "weeks" | "calendar"; d: Dict }) {
  const items: [typeof active, string, string][] = [
    ["week", "/parent/school", `📅 ${d.currentWeek}`], ["weeks", "/parent/school/weeks", `🗂 ${d.weeks}`], ["calendar", "/parent/school/calendar", `📆 ${d.calendar}`],
  ];
  return (
    <nav className="mt-2 grid grid-cols-3 gap-1.5">
      {items.map(([k, href, label]) => (
        <Link key={k} href={href} className={`rounded-xl border px-1 py-2 text-center text-xs font-semibold sm:text-sm ${k === active ? "border-ink bg-ink text-white" : "border-line bg-white"}`}>{label}</Link>
      ))}
    </nav>
  );
}
