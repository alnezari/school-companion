"use client";
import type { Lang } from "@/lib/i18n";
// A small two-letter pill: the active language is filled, one tap flips it.
export function LangToggle({ lang, setLang, className = "" }: { lang: Lang; setLang: (l: Lang) => void; className?: string }) {
  const Seg = ({ l, label }: { l: Lang; label: string }) => (
    <span className={`grid h-full min-w-8 place-items-center rounded-full px-2 text-sm font-extrabold ${lang === l ? "bg-ink text-white" : "text-ink-2"}`}>{label}</span>
  );
  return (
    <button type="button" onClick={() => setLang(lang === "en" ? "ar" : "en")} aria-label="Switch language"
      className={`flex h-9 items-center gap-0.5 rounded-full border border-line bg-white p-1 ${className}`}>
      <Seg l="en" label="EN" /><Seg l="ar" label="ع" />
    </button>
  );
}
