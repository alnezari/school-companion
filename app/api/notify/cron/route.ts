import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { sendToAll } from "@/lib/push-send";
import { addDays, todayISO, schoolDay } from "@/lib/schedule";
import { DAY_NAMES } from "@/lib/i18n";
import { runFetch } from "@/lib/fetch-week";

export const runtime = "nodejs";
export const maxDuration = 300;
export const dynamic = "force-dynamic";

// Called once a day by Vercel Cron, early evening Riyadh time. First it looks in the school folders for a new week;
// then it sends a push only if tomorrow is a school day AND there is still no plan for it.
export async function GET(req: Request) {
  const secret = process.env.CRON_SECRET;
  if (secret && req.headers.get("authorization") !== `Bearer ${secret}`) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const sb = supabaseAdmin();
  const fetched = await runFetch(sb, "auto");
  const { data: settingsRows } = await sb.from("settings").select("key,value").in("key", ["notif_no_plan_reminder"]);
  const settings = Object.fromEntries(((settingsRows || []) as { key: string; value: string }[]).map((r) => [r.key, r.value]));
  if (settings.notif_no_plan_reminder === "false") return NextResponse.json({ ok: true, fetched, skipped: "disabled" });

  const tomorrow = addDays(todayISO(), 1);
  const day = schoolDay(tomorrow);
  if (day === null) return NextResponse.json({ ok: true, fetched, skipped: "weekend" });

  const { data: week } = await sb.from("weeks").select("id").lte("start_date", tomorrow).gte("end_date", tomorrow).maybeSingle();
  let hasPlan = false;
  if (week) {
    const { count } = await sb.from("entries").select("id", { count: "exact", head: true }).eq("week_id", week.id).eq("day", day);
    hasPlan = (count || 0) > 0;
  }
  if (hasPlan) return NextResponse.json({ ok: true, fetched, skipped: "has_plan" });

  const { data: subs } = await sb.from("push_subscriptions").select("endpoint,p256dh,auth");
  if (!subs || subs.length === 0) return NextResponse.json({ ok: true, fetched, skipped: "no_subscriptions" });

  const dead = await sendToAll(subs, {
    title: "📄 No plan yet for tomorrow",
    body: `The weekly plan for ${DAY_NAMES.en[day]} hasn't been uploaded yet.`,
    url: "/parent/school",
    tag: `no-plan-${tomorrow}`,
  });
  if (dead.length) await sb.from("push_subscriptions").delete().in("endpoint", dead);
  return NextResponse.json({ ok: true, fetched, sent: subs.length - dead.length });
}
