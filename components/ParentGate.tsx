"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import type { Dict } from "@/lib/i18n";

export const UNLOCK_KEY = "parent_unlocked";
export function isParentUnlocked() {
  try { return sessionStorage.getItem(UNLOCK_KEY) === "1"; } catch { return false; }
}

export function ParentGate({ pin, d, onClose }: { pin: string; d: Dict; onClose: () => void }) {
  const router = useRouter();
  const [value, setValue] = useState("");
  const [wrong, setWrong] = useState(false);
  function submit(e: React.FormEvent) {
    e.preventDefault();
    if (value === pin) {
      try { sessionStorage.setItem(UNLOCK_KEY, "1"); } catch {}
      router.push("/parent");
    } else { setWrong(true); setValue(""); }
  }
  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-black/40 p-4" onClick={onClose}>
      <form onSubmit={submit} onClick={(e) => e.stopPropagation()} className="w-full max-w-xs rounded-3xl bg-white p-6 shadow-xl rise">
        <h2 className="font-display text-xl font-extrabold">{d.pinTitle}</h2>
        <p className="text-ink-2 mb-4">{d.pinBody}</p>
        <input autoFocus inputMode="numeric" type="password" value={value} onChange={(e) => { setValue(e.target.value); setWrong(false); }}
          className="w-full rounded-xl border border-line px-3 py-3 text-center text-2xl tracking-[.4em]" />
        {wrong && <p className="mt-2 text-sm text-red">{d.pinWrong}</p>}
        <div className="mt-4 flex gap-2">
          <button type="button" onClick={onClose} className="flex-1 rounded-xl border border-line py-2 font-semibold">{d.cancel}</button>
          <button type="submit" className="flex-1 rounded-xl bg-accent py-2 font-semibold text-white">{d.enter}</button>
        </div>
      </form>
    </div>
  );
}
