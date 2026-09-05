"use client";
import { useEffect, useState } from "react";
import type { Lang } from "./i18n";

// One language per device, shared by the child's side and the parents' side. Changed only in Settings.
const KEY = "lang";
export function useLang(_side?: "kid" | "parent"): [Lang, (l: Lang) => void] {
  const [lang, setLangState] = useState<Lang>("en");
  useEffect(() => {
    try {
      const saved = localStorage.getItem(KEY);
      if (saved === "en" || saved === "ar") setLangState(saved);
    } catch {}
  }, []);
  useEffect(() => {
    document.documentElement.lang = lang;
    document.documentElement.dir = lang === "ar" ? "rtl" : "ltr";
  }, [lang]);
  const setLang = (l: Lang) => {
    setLangState(l);
    try { localStorage.setItem(KEY, l); } catch {}
  };
  return [lang, setLang];
}
