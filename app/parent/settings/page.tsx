"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useLang } from "@/lib/lang";
import { t } from "@/lib/i18n";
import { loadLatestTimetable, loadSettings, loadWeeks, saveSetting, signedUrl, type Timetable, type WeekSummary } from "@/lib/data";
import { formatDate } from "@/lib/schedule";
import { supabase } from "@/lib/supabase/client";
import { isParentUnlocked } from "@/components/ParentGate";
import { ParentNav } from "@/components/ParentNav";
import { LangToggle } from "@/components/LangToggle";

// Settings hub: the two uploads live together here, plus the child's day, name, PIN and sign-out.
export default function SettingsPage() {
  const router = useRouter();
  const [lang, setLang] = useLang("parent");
  const d = t(lang);
  const [name, setName] = useState("");
  const [pin, setPin] = useState("");
  const [saved, setSaved] = useState(false);
  const [week, setWeek] = useState<WeekSummary | null>(null);
  const [tt, setTt] = useState<Timetable | null>(null);
  const [ttUrl, setTtUrl] = useState<string | null>(null);
  useEffect(() => { if (!isParentUnlocked()) router.replace("/"); }, [router]);
  useEffect(() => {
    loadSettings().then((s) => { setName(s.child_name ?? ""); setPin(s.parent_pin ?? ""); });
    loadWeeks().then((w) => setWeek(w[0] ?? null));
    loadLatestTimetable().then(async (x) => { setTt(x); if (x?.source_path) setTtUrl(await signedUrl(x.source_path)); });
  }, []);

  async function save(e: React.FormEvent) {
    e.preventDefault();
    await Promise.all([saveSetting("child_name", name.trim()), saveSetting("parent_pin", pin.trim())]);
    setSaved(true); setTimeout(() => setSaved(false), 1500);
  }
  async function logout() { await supabase().auth.signOut(); router.replace("/login"); router.refresh(); }

  const Card = ({ icon, title, body, href, cta }: { icon: string; title: string; body: React.ReactNode; href: string; cta: string }) => (
    <section className="rounded-2xl border border-line bg-white p-4">
      <div className="flex items-start gap-3">
        <span className="text-2xl">{icon}</span>
        <div className="min-w-0 flex-1">
          <h2 className="font-display font-extrabold">{title}</h2>
          <div className="mt-0.5 text-sm text-ink-2">{body}</div>
        </div>
      </div>
      <Link href={href} className="mt-3 block rounded-xl bg-accent py-2 text-center text-sm font-semibold text-white">{cta}</Link>
    </section>
  );

  return (
    <main className="min-h-dvh px-4 py-4">
      <div className="mx-auto max-w-2xl">
        <div className="flex items-center justify-between">
          <h1 className="font-display text-xl font-extrabold">⚙ {d.settings}</h1>
          <LangToggle lang={lang} setLang={setLang} />
        </div>
        <ParentNav active="settings" d={d} />
        <div className="mt-4 grid gap-3 sm:grid-cols-2">
          <Card icon="📄" title={d.upload} href="/parent/upload" cta={d.upload}
            body={week ? <>{week.title || `Week ${week.week_number ?? ""}`} · {formatDate(week.start_date, lang)}</> : d.noWeek} />
          <Card icon="🗓" title={d.timetable} href="/parent/timetable" cta={d.uploadTimetable}
            body={tt ? <>{tt.name}{tt.class_name && <> · {tt.class_name}</>} · {formatDate(tt.valid_from, lang)}{ttUrl && <> · <a href={ttUrl} target="_blank" rel="noreferrer" className="text-accent underline">{d.original}</a></>}</> : "—"} />
          <Card icon="🧺" title={d.dayTitle} href="/parent/day" cta={d.dayTitle} body={<>{d.fixedBlocks} · {d.basket} · {d.dayWindow}</>} />
        </div>
        <form onSubmit={save} className="mt-3 rounded-2xl border border-line bg-white p-4">
          <label className="block text-sm font-medium">{d.childName}</label>
          <input value={name} onChange={(e) => setName(e.target.value)} className="mt-1 w-full rounded-xl border border-line bg-white px-3 py-2" />
          <label className="mt-4 block text-sm font-medium">{d.changePin}</label>
          <input value={pin} onChange={(e) => setPin(e.target.value)} inputMode="numeric" className="mt-1 w-full rounded-xl border border-line bg-white px-3 py-2" />
          <button className="mt-4 w-full rounded-xl bg-ink py-2 font-semibold text-white">{saved ? d.saved : d.save}</button>
        </form>
        <button type="button" onClick={logout} className="mt-4 w-full rounded-xl border border-line py-2 text-sm font-semibold text-ink-2">{d.logout}</button>
      </div>
    </main>
  );
}
