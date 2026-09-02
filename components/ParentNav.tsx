"use client";
import Link from "next/link";
import type { Dict } from "@/lib/i18n";

export function ParentNav({ active, d }: { active: "week" | "weeks" | "calendar" | "timetable"; d: Dict }) {
  const items: [typeof active, string, string][] = [
    ["week", "/parent", `📅 ${d.currentWeek}`], ["weeks", "/parent/weeks", `🗂 ${d.weeks}`],
    ["calendar", "/parent/calendar", `📆 ${d.calendar}`], ["timetable", "/parent/timetable", `🗓 ${d.timetable}`],
  ];
  return (
    <nav className="mt-2 grid grid-cols-4 gap-1.5">
      {items.map(([k, href, label]) => (
        <Link key={k} href={href} className={`rounded-xl border px-1 py-2 text-center text-xs font-semibold sm:text-sm ${k === active ? "border-ink bg-ink text-white" : "border-line bg-white"}`}>{label}</Link>
      ))}
    </nav>
  );
}
