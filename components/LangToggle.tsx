"use client";
import type { Lang } from "@/lib/i18n";
export function LangToggle({ lang, setLang, className = "" }: { lang: Lang; setLang: (l: Lang) => void; className?: string }) {
  return (
    <button type="button" onClick={() => setLang(lang === "en" ? "ar" : "en")} aria-label="Switch language"
      className={`rounded-full border border-line bg-white px-3 py-1.5 text-sm font-semibold ${className}`}>
      {lang === "en" ? "عربي" : "English"}
    </button>
  );
}
