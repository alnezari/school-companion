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
import { configFrom, type DayConfig } from "@/lib/day";

const input = "mt-1 w-full rounded-xl border border-line bg-white px-3 py-2";
const Card = ({ title, children }: { title: string; children: React.ReactNode }) => (
  <section className="mt-3 rounded-2xl border border-line bg-white p-4"><h2 className="font-display font-extrabold">{title}</h2>{children}</section>
);
const Switch = ({ on, onChange, label }: { on: boolean; onChange: (v: boolean) => void; label: string }) => (
  <button type="button" onClick={() => onChange(!on)} className="flex w-full items-center justify-between gap-3 text-sm font-medium">
    {label}<span className={`inline-block h-6 w-10 shrink-0 rounded-full p-0.5 transition ${on ? "bg-green" : "bg-line"}`}><span className={`block h-5 w-5 rounded-full bg-white transition ${on ? "translate-x-4 rtl:-translate-x-4" : ""}`} /></span>
  </button>
);

// Global settings, grouped: security, language, notifications, timing.
export default function SettingsPage() {
  const router = useRouter();
  const [lang, setLang] = useLang("parent");
  const d = t(lang);
  const [email, setEmail] = useState("");
  const [newEmail, setNewEmail] = useState("");
  const [pw, setPw] = useState(""); const [pw2, setPw2] = useState("");
  const [pin, setPin] = useState("");
  const [pinOn, setPinOn] = useState(true);
  const [quickPin, setQuickPin] = useState("");
  const [quickPinSet, setQuickPinSet] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [cfg, setCfg] = useState<DayConfig | null>(null);
  const [notifState, setNotifState] = useState<NotifState | null>(null);
  const [notifBusy, setNotifBusy] = useState(false);
  const [notifBagPacked, setNotifBagPacked] = useState(true);
  const [notifNoPlan, setNotifNoPlan] = useState(true);
  useEffect(() => { if (!isParentUnlocked()) router.replace("/"); }, [router]);
  useEffect(() => {
    loadSettings().then((s) => {
      setPin(s.parent_pin ?? ""); setPinOn(s.parent_pin_enabled !== "false"); setCfg(configFrom(s)); setQuickPinSet(!!s.login_pin_hash);
      setNotifBagPacked(s.notif_bag_packed !== "false"); setNotifNoPlan(s.notif_no_plan_reminder !== "false");
    });
    (async () => { const { data } = await supabase().auth.getUser(); setEmail(data.user?.email ?? ""); })();
    getNotifState().then(setNotifState);
  }, []);

  async function saveSecurity(e: React.FormEvent) {
    e.preventDefault(); setMsg(null);
    if (pw || pw2) {
      if (pw.length < 6) return setMsg(d.passwordShort);
      if (pw !== pw2) return setMsg(d.passwordMismatch);
      const { error } = await supabase().auth.updateUser({ password: pw });
      if (error) return setMsg(error.message);
      setPw(""); setPw2("");
    }
    if (newEmail.trim() && newEmail.trim() !== email) {
      const { error } = await supabase().auth.updateUser({ email: newEmail.trim() });
      if (error) return setMsg(error.message);
      setNewEmail(""); setMsg(d.emailSent);
    }
    if (quickPin) {
      if (!/^\d{6}$/.test(quickPin)) return setMsg(d.quickPinBad);
      const { data } = await supabase().auth.getUser();
      const bytes = new TextEncoder().encode(`${quickPin}:${data.user?.id}`);
      const hash = [...new Uint8Array(await crypto.subtle.digest("SHA-256", bytes))].map((b) => b.toString(16).padStart(2, "0")).join("");
      await saveSetting("login_pin_hash", hash); setQuickPin(""); setQuickPinSet(true);
    }
    await Promise.all([saveSetting("parent_pin", pin.trim()), saveSetting("parent_pin_enabled", pinOn ? "true" : "false")]);
    setMsg((m) => m ?? d.saved);
  }
  async function saveCfg(key: keyof DayConfig, v: string) {
    if (!cfg) return; setCfg({ ...cfg, [key]: v });
    await saveSetting({ home: "day_home_time", bed: "day_bed_time", wake: "day_weekend_wake" }[key], v);
  }
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
  async function logout() { await supabase().auth.signOut(); router.replace("/login"); router.refresh(); }

  return (
    <main className="min-h-dvh px-4 py-4">
      <div className="mx-auto max-w-sm">
        <div className="flex items-center gap-2">
          <Link href="/parent" className="rounded-full border border-line bg-white px-3 py-1.5 text-sm font-semibold">←</Link>
          <h1 className="font-display text-xl font-extrabold">⚙ {d.settings}</h1>
        </div>

        <form onSubmit={saveSecurity} className="mt-4 rounded-2xl border border-line bg-white p-4">
          <h2 className="font-display font-extrabold">🔒 {d.security}</h2>
          <p className="mt-1 text-sm text-ink-2">{d.email}: {email || "…"}</p>
          <label className="mt-3 block text-sm font-medium">{d.newEmail}<input type="email" value={newEmail} onChange={(e) => setNewEmail(e.target.value)} autoComplete="off" className={input} /></label>
          <div className="mt-3 grid grid-cols-2 gap-3">
            <label className="block text-sm font-medium">{d.newPassword}<input type="password" value={pw} onChange={(e) => setPw(e.target.value)} autoComplete="new-password" className={input} /></label>
            <label className="block text-sm font-medium">{d.confirmPassword}<input type="password" value={pw2} onChange={(e) => setPw2(e.target.value)} autoComplete="new-password" className={input} /></label>
          </div>
          <div className="mt-4 border-t border-line pt-3">
            <label className="block text-sm font-medium">🔑 {d.quickPin}{quickPinSet && <span className="ms-2 rounded-full bg-green-soft px-2 text-xs text-green">✓</span>}
              <input value={quickPin} onChange={(e) => setQuickPin(e.target.value.replace(/\D/g, "").slice(0, 6))} inputMode="numeric" placeholder="••••••" className={`${input} tracking-[.4em]`} />
            </label>
            <p className="mt-1 text-xs text-ink-2">{d.quickPinHint}</p>
            {quickPinSet && <button type="button" onClick={async () => { await saveSetting("login_pin_hash", ""); setQuickPinSet(false); setMsg(d.saved); }} className="mt-1 text-xs font-semibold text-red">{d.delete}</button>}
          </div>
          <div className="mt-4 border-t border-line pt-3">
            <Switch on={pinOn} onChange={setPinOn} label={`🔢 ${d.pinEnabled}`} />
            {pinOn && <label className="mt-3 block text-sm font-medium">{d.changePin}<input value={pin} onChange={(e) => setPin(e.target.value)} inputMode="numeric" className={input} /></label>}
          </div>
          {msg && <p className="mt-2 text-sm font-semibold text-accent">{msg}</p>}
          <button className="mt-4 w-full rounded-xl bg-ink py-2 font-semibold text-white">{d.save}</button>
        </form>

        <Card title={`🌐 ${d.language}`}>
          <div className="mt-2 flex items-center justify-between gap-3"><span className="text-sm text-ink-2">{d.thisDeviceOnly}</span><LangToggle lang={lang} setLang={setLang} /></div>
        </Card>

        <Card title={`🔔 ${d.notifications}`}>
          {notifState === "unsupported" ? <p className="mt-2 text-sm text-ink-2">{d.notifUnsupported}</p>
            : notifState === "ios_not_installed" ? <p className="mt-2 text-sm text-ink-2">{d.notifIosHint}</p>
            : notifState === "denied" ? <p className="mt-2 text-sm text-ink-2">{d.notifDenied}</p>
            : (
              <>
                <div className="mt-2 flex items-center justify-between gap-3">
                  <span className="text-sm text-ink-2">{notifState === "on" ? d.notifOn : d.notifOff}</span>
                  <button type="button" onClick={toggleNotifications} disabled={notifBusy || notifState === null}
                    className={`shrink-0 rounded-xl px-3 py-1.5 text-sm font-semibold text-white disabled:opacity-50 ${notifState === "on" ? "bg-red" : "bg-accent"}`}>
                    {notifState === "on" ? d.notifDisable : d.notifEnable}
                  </button>
                </div>
                <div className="mt-4 space-y-3 border-t border-line pt-3">
                  <Switch on={notifBagPacked} onChange={(v) => setNotifPref("notif_bag_packed", v, setNotifBagPacked)} label={d.notifBagPacked} />
                  <Switch on={notifNoPlan} onChange={(v) => setNotifPref("notif_no_plan_reminder", v, setNotifNoPlan)} label={d.notifNoPlan} />
                </div>
              </>
            )}
        </Card>

        {cfg && (
          <Card title={`🕑 ${d.timing}`}>
            <div className="mt-2 grid grid-cols-3 gap-3">
              <label className="block text-sm font-medium">{d.schoolDays}: {d.homeAt}<input type="time" value={cfg.home} onChange={(e) => saveCfg("home", e.target.value)} className={input} /></label>
              <label className="block text-sm font-medium">{d.weekend}: {d.wakeAt}<input type="time" value={cfg.wake} onChange={(e) => saveCfg("wake", e.target.value)} className={input} /></label>
              <label className="block text-sm font-medium">{d.bedAt}<input type="time" value={cfg.bed} onChange={(e) => saveCfg("bed", e.target.value)} className={input} /></label>
            </div>
          </Card>
        )}

        <button type="button" onClick={logout} className="mt-4 w-full rounded-xl border border-line py-2 text-sm font-semibold text-ink-2">{d.logout}</button>
      </div>
    </main>
  );
}
