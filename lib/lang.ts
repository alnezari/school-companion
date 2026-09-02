"use client";
import { useEffect, useState } from "react";
import type { Lang } from "./i18n";

// Each device remembers its own choice, separately for the child's side and the parents' side.
export function useLang(side: "kid" | "parent"): [Lang, (l: Lang) => void] {
  const key = `lang:${side}`;
  const fallback: Lang = side === "kid" ? "en" : "ar";
  const [lang, setLangState] = useState<Lang>(fallback);
  useEffect(() => {
    try {
      const saved = localStorage.getItem(key);
      if (saved === "en" || saved === "ar") setLangState(saved);
    } catch {}
  }, [key]);
  useEffect(() => {
    document.documentElement.lang = lang;
    document.documentElement.dir = lang === "ar" ? "rtl" : "ltr";
  }, [lang]);
  const setLang = (l: Lang) => {
    setLangState(l);
    try { localStorage.setItem(key, l); } catch {}
  };
  return [lang, setLang];
}
