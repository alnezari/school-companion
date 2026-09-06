import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { runFetch } from "@/lib/fetch-week";

export const runtime = "nodejs";
export const maxDuration = 300;
export const dynamic = "force-dynamic";

/** Vercel Cron, every night at midnight Riyadh time: look in the school folders for a new week. The query also keeps the free Supabase project awake. */
export async function GET(req: Request) {
  if (!process.env.SUPABASE_SERVICE_ROLE_KEY) return NextResponse.json({ error: "no_service_key", message: "SUPABASE_SERVICE_ROLE_KEY is not set in Vercel." }, { status: 500 });
  const secret = process.env.CRON_SECRET;
  if (secret && req.headers.get("authorization") !== `Bearer ${secret}`) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  return NextResponse.json(await runFetch(supabaseAdmin(), "auto"));
}
