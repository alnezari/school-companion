import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { SUPABASE_URL, SUPABASE_KEY } from "@/lib/supabase/env";

// Called once a day by Vercel Cron so the free Supabase project never pauses for inactivity.
export const dynamic = "force-dynamic";
export async function GET() {
  const { error } = await createClient(SUPABASE_URL, SUPABASE_KEY).from("settings").select("key").limit(1);
  return NextResponse.json({ ok: !error, at: new Date().toISOString() });
}
