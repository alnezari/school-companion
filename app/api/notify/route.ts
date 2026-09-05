import { NextResponse } from "next/server";
import { supabaseServer } from "@/lib/supabase/server";
import { sendToAll } from "@/lib/push-send";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// One entry per notification type the app can send. Keep the wording short — it's a phone notification, not a page.
const MESSAGES: Record<string, (name: string) => { title: string; body: string; url: string }> = {
  bag_packed: (name) => ({
    title: `🎒 ${name} packed his bag!`,
    body: "All of tonight's homework is done and ready for tomorrow.",
    url: "/parent/school",
  }),
};

export async function POST(req: Request) {
  const sb = await supabaseServer();
  const { data: auth } = await sb.auth.getUser();
  if (!auth.user) return NextResponse.json({ error: "not_signed_in" }, { status: 401 });

  const { type, date } = (await req.json().catch(() => ({}))) as { type?: string; date?: string };
  const build = type ? MESSAGES[type] : undefined;
  if (!build || !type) return NextResponse.json({ error: "unknown_type" }, { status: 400 });

  const [{ data: settingsRows }, { data: subs }] = await Promise.all([
    sb.from("settings").select("key,value").in("key", [`notif_${type}`, "child_name"]),
    sb.from("push_subscriptions").select("endpoint,p256dh,auth"),
  ]);
  const settings = Object.fromEntries(((settingsRows || []) as { key: string; value: string }[]).map((r) => [r.key, r.value]));
  if (settings[`notif_${type}`] === "false") return NextResponse.json({ ok: true, skipped: "disabled" });
  if (!subs || subs.length === 0) return NextResponse.json({ ok: true, skipped: "no_subscriptions" });

  const msg = build(settings.child_name || "Taym");
  const dead = await sendToAll(subs, { ...msg, tag: `${type}-${date || ""}` });
  if (dead.length) await sb.from("push_subscriptions").delete().in("endpoint", dead);
  return NextResponse.json({ ok: true, sent: subs.length - dead.length });
}
