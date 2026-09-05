"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useLang } from "@/lib/lang";
import { t } from "@/lib/i18n";
import { loadSettings, saveSetting } from "@/lib/data";
import { supabase } from "@/lib/supabase/client";
import { isParentUnlocked } from "@/components/ParentGate";
import { LangToggle } from "@/components/LangToggle";
import { enableNotifications, disableNotifications, getNotifState, type NotifState } from "@/lib/notifications";

// Global settings: things that belong to no single app.
export default function SettingsPage() {
  const router = useRouter();
  const [lang, setLang] = useLang("parent");
  const d = t(lang);
  const [name, setName] = useState("");
  const [pin, setPin] = useState("");
  const [saved, setSaved] = useState(false);
  const [email, setEmail] = useState("");
  const [newEmail, setNewEmail] = useState("");
  const [pw, setPw] = useState(""); const [pw2, setPw2] = useState("");
  const [msg, setMsg] = useState<string | null>(null);
  const [notifState, setNotifState] = useState<NotifState | null>(null);
  const [notifBusy, setNotifBusy] = useState(false);
  const [notifBagPacked, setNotifBagPacked] = useState(true);
  const [notifNoPlan, setNotifNoPlan] = useState(true);
  useEffect(() => { if (!isParentUnlocked()) router.replace("/"); }, [router]);
  useEffect(() => {
    loadSettings().then((s) => {
      setName(s.child_name ?? ""); setPin(s.parent_pin ?? "");
      setNotifBagPacked(s.notif_bag_packed !== "false"); setNotifNoPlan(s.notif_no_plan_reminder !== "false");
    });
    (async () => { const { data } = await supabase().auth.getUser(); setEmail(data.user?.email ?? ""); })();
    getNotifState().then(setNotifState);
  }, []);

  async function toggleNotifications() {
    setNotifBusy(true);
    try {
      if (notifState === "on") { await disableNotifications(); setNotifState("off"); }
      else { setNotifState(await enableNotifications()); }
    } catch { setMsg(d.notifError); } finally { setNotifBusy(false); }
  }
  async function setNotifPref(key: "notif_bag_packed" | "notif_no_plan_reminder", value: boolean, setter: (v: boolean) => void) {
    setter(value);
    await saveSetting(key, value ? "true" : "false");
  }
  async function updateAccount(e: React.FormEvent) {
    e.preventDefault(); setMsg(null);
    if (pw || pw2) {
      if (pw.length < 6) return setMsg(d.passwordShort);
      if (pw !== pw2) return setMsg(d.passwordMismatch);
      const { error } = await supabase().auth.updateUser({ password: pw });
      if (error) return setMsg(error.message);
      setPw(""); setPw2(""); setMsg(d.passwordUpdated);
    }
    if (newEmail.trim() && newEmail.trim() !== email) {
      const { error } = await supabase().auth.updateUser({ email: newEmail.trim() });
      if (error) return setMsg(error.message);
      setNewEmail(""); setMsg(d.emailSent);
    }
  }

  async function save(e: React.FormEvent) {
    e.preventDefault();
    await Promise.all([saveSetting("child_name", name.trim()), saveSetting("parent_pin", pin.trim())]);
    setSaved(true); setTimeout(() => setSaved(false), 1500);
  }
  async function logout() { await supabase().auth.signOut(); router.replace("/login"); router.refresh(); }

  return (
    <main className="min-h-dvh px-4 py-4">
      <div className="mx-auto max-w-sm">
        <div className="flex items-center gap-2">
          <Link href="/parent" className="rounded-full border border-line bg-white px-3 py-1.5 text-sm font-semibold">←</Link>
          <h1 className="font-display text-xl font-extrabold">⚙ {d.settings}</h1>
        </div>
        <form onSubmit={save} className="mt-4 rounded-2xl border border-line bg-white p-4">
          <label className="block text-sm font-medium">{d.childName}</label>
          <input value={name} onChange={(e) => setName(e.target.value)} className="mt-1 w-full rounded-xl border border-line bg-white px-3 py-2" />
          <label className="mt-4 block text-sm font-medium">{d.changePin}</label>
          <input value={pin} onChange={(e) => setPin(e.target.value)} inputMode="numeric" className="mt-1 w-full rounded-xl border border-line bg-white px-3 py-2" />
          <div className="mt-4 flex items-center justify-between"><span className="text-sm font-medium">{d.language}</span><LangToggle lang={lang} setLang={setLang} /></div>
          <button className="mt-4 w-full rounded-xl bg-ink py-2 font-semibold text-white">{saved ? d.saved : d.save}</button>
        </form>
        <form onSubmit={updateAccount} className="mt-3 rounded-2xl border border-line bg-white p-4">
          <h2 className="font-display font-extrabold">👤 {d.account}</h2>
          <p className="mt-1 text-sm text-ink-2">{d.email}: {email || "…"}</p>
          <label className="mt-3 block text-sm font-medium">{d.newEmail}</label>
          <input type="email" value={newEmail} onChange={(e) => setNewEmail(e.target.value)} autoComplete="off" className="mt-1 w-full rounded-xl border border-line bg-white px-3 py-2" />
          <div className="mt-3 grid grid-cols-2 gap-3">
            <label className="block text-sm font-medium">{d.newPassword}<input type="password" value={pw} onChange={(e) => setPw(e.target.value)} autoComplete="new-password" className="mt-1 w-full rounded-xl border border-line bg-white px-3 py-2" /></label>
            <label className="block text-sm font-medium">{d.confirmPassword}<input type="password" value={pw2} onChange={(e) => setPw2(e.target.value)} autoComplete="new-password" className="mt-1 w-full rounded-xl border border-line bg-white px-3 py-2" /></label>
          </div>
          {msg && <p className="mt-2 text-sm font-semibold text-accent">{msg}</p>}
          <button className="mt-4 w-full rounded-xl bg-ink py-2 font-semibold text-white">{d.update}</button>
        </form>
        <section className="mt-3 rounded-2xl border border-line bg-white p-4">
          <h2 className="font-display font-extrabold">🔔 {d.notifications}</h2>
          {notifState === "unsupported" ? (
            <p className="mt-2 text-sm text-ink-2">{d.notifUnsupported}</p>
          ) : notifState === "ios_not_installed" ? (
            <p className="mt-2 text-sm text-ink-2">{d.notifIosHint}</p>
          ) : notifState === "denied" ? (
            <p className="mt-2 text-sm text-ink-2">{d.notifDenied}</p>
          ) : (
            <>
              <div className="mt-2 flex items-center justify-between gap-3">
                <span className="text-sm text-ink-2">{notifState === "on" ? d.notifOn : d.notifOff}</span>
                <button type="button" onClick={toggleNotifications} disabled={notifBusy || notifState === null}
                  className={`shrink-0 rounded-xl px-3 py-1.5 text-sm font-semibold text-white disabled:opacity-50 ${notifState === "on" ? "bg-red" : "bg-accent"}`}>
                  {notifState === "on" ? d.notifDisable : d.notifEnable}
                </button>
              </div>
              <div className="mt-4 space-y-2 border-t border-line pt-3">
                <label className="flex items-center justify-between gap-3 text-sm font-medium">
                  {d.notifBagPacked}
                  <input type="checkbox" checked={notifBagPacked} onChange={(e) => setNotifPref("notif_bag_packed", e.target.checked, setNotifBagPacked)} className="h-5 w-5" />
                </label>
                <label className="flex items-center justify-between gap-3 text-sm font-medium">
                  {d.notifNoPlan}
                  <input type="checkbox" checked={notifNoPlan} onChange={(e) => setNotifPref("notif_no_plan_reminder", e.target.checked, setNotifNoPlan)} className="h-5 w-5" />
                </label>
              </div>
            </>
          )}
        </section>
        <button type="button" onClick={logout} className="mt-4 w-full rounded-xl border border-line py-2 text-sm font-semibold text-ink-2">{d.logout}</button>
      </div>
    </main>
  );
}
