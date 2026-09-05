import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { sendToAll } from "@/lib/push-send";
import { addDays, todayISO, schoolDay } from "@/lib/schedule";
import { DAY_NAMES } from "@/lib/i18n";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Called once a day by Vercel Cron. Only ever sends a push when tomorrow is a school day AND
// nothing has been uploaded for it yet — otherwise it does nothing, silently.
export async function GET(req: Request) {
  const secret = process.env.CRON_SECRET;
  if (secret && req.headers.get("authorization") !== `Bearer ${secret}`) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const sb = supabaseAdmin();
  const { data: settingsRows } = await sb.from("settings").select("key,value").in("key", ["notif_no_plan_reminder"]);
  const settings = Object.fromEntries(((settingsRows || []) as { key: string; value: string }[]).map((r) => [r.key, r.value]));
  if (settings.notif_no_plan_reminder === "false") return NextResponse.json({ ok: true, skipped: "disabled" });

  const tomorrow = addDays(todayISO(), 1);
  const day = schoolDay(tomorrow);
  if (day === null) return NextResponse.json({ ok: true, skipped: "weekend" });

  const { data: week } = await sb.from("weeks").select("id").lte("start_date", tomorrow).gte("end_date", tomorrow).maybeSingle();
  let hasPlan = false;
  if (week) {
    const { count } = await sb.from("entries").select("id", { count: "exact", head: true }).eq("week_id", week.id).eq("day", day);
    hasPlan = (count || 0) > 0;
  }
  if (hasPlan) return NextResponse.json({ ok: true, skipped: "has_plan" });

  const { data: subs } = await sb.from("push_subscriptions").select("endpoint,p256dh,auth");
  if (!subs || subs.length === 0) return NextResponse.json({ ok: true, skipped: "no_subscriptions" });

  const dead = await sendToAll(subs, {
    title: "📄 No plan yet for tomorrow",
    body: `The weekly plan for ${DAY_NAMES.en[day]} hasn't been uploaded yet.`,
    url: "/parent/school/upload",
    tag: `no-plan-${tomorrow}`,
  });
  if (dead.length) await sb.from("push_subscriptions").delete().in("endpoint", dead);
  return NextResponse.json({ ok: true, sent: subs.length - dead.length });
}
