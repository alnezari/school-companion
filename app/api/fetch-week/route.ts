import { NextResponse } from "next/server";
import { supabaseServer } from "@/lib/supabase/server";
import { runFetch } from "@/lib/fetch-week";

export const runtime = "nodejs";
export const maxDuration = 300;
export const dynamic = "force-dynamic";

/** The refresh button in Settings: look in the school folders now and read the earliest missing week. Runs as the signed-in parent. */
export async function POST(req: Request) {
  const sb = await supabaseServer();
  const { data: auth } = await sb.auth.getUser();
  if (!auth.user) return NextResponse.json({ error: "not_signed_in" }, { status: 401 });
  const { data: fam } = await sb.from("family_members").select("user_id").eq("user_id", auth.user.id).maybeSingle();
  if (!fam) return NextResponse.json({ error: "not_family" }, { status: 403 });
  if (!process.env.ANTHROPIC_API_KEY) return NextResponse.json({ error: "no_api_key", message: "ANTHROPIC_API_KEY is not set in Vercel." }, { status: 500 });
  const body = (await req.json().catch(() => ({}))) as { week?: unknown };
  const week = Number.isInteger(body.week) && (body.week as number) > 0 ? (body.week as number) : undefined;
  try { return NextResponse.json(await runFetch(sb, "refresh", { week })); }
  catch (e) { return NextResponse.json({ error: "failed", message: e instanceof Error ? e.message : String(e) }, { status: 500 }); }
}
