import { NextResponse } from "next/server";
import { supabaseServer } from "@/lib/supabase/server";
import { ReadError, checkFile, storeFile, readTimetable, readPlan, timetableFor } from "@/lib/readers";

export const runtime = "nodejs";
export const maxDuration = 300; // Vercel Hobby allows up to 5 minutes; both readings fit inside it
export const dynamic = "force-dynamic";

/**
 * One request for the whole week: the weekly plan, and the timetable if it changed.
 * Progress is written to the `uploads` row step by step, so the page can show it (and the parent can leave and come back).
 */
export async function POST(req: Request) {
  const sb = await supabaseServer();
  const { data: auth } = await sb.auth.getUser();
  if (!auth.user) return NextResponse.json({ error: "not_signed_in" }, { status: 401 });
  const { data: fam } = await sb.from("family_members").select("user_id").eq("user_id", auth.user.id).maybeSingle();
  if (!fam) return NextResponse.json({ error: "not_family" }, { status: 403 });
  if (!process.env.ANTHROPIC_API_KEY) return NextResponse.json({ error: "no_api_key", message: "ANTHROPIC_API_KEY is not set in Vercel." }, { status: 500 });

  const form = await req.formData();
  let plan: File | null, timetable: File | null;
  try { plan = checkFile(form.get("plan")); timetable = checkFile(form.get("timetable")); }
  catch (e) { return e instanceof ReadError ? NextResponse.json({ error: e.code, message: e.message }, { status: e.status }) : NextResponse.json({ error: "bad_request" }, { status: 400 }); }
  if (!plan) return NextResponse.json({ error: "no_file", message: "Choose the weekly plan first." }, { status: 400 });
  const validFrom = String(form.get("valid_from") || new Date().toISOString().slice(0, 10));

  const { data: job } = await sb.from("uploads").insert({ status: "saving" }).select("id").single();
  const step = (patch: Record<string, unknown>) => job ? sb.from("uploads").update({ ...patch, updated_at: new Date().toISOString() }).eq("id", job.id) : Promise.resolve();

  try {
    const stem = new Date().toISOString().slice(0, 10);
    const p = await storeFile(sb, plan, "plans", stem);
    const tt = timetable ? await storeFile(sb, timetable, "timetables", validFrom) : null;
    await step({ plan_path: p.storagePath, timetable_path: tt?.storagePath ?? null, status: tt ? "timetable" : "plan" });

    const { data: cls } = await sb.from("settings").select("value").eq("key", "school_class").maybeSingle();
    const ttResult = tt ? await readTimetable(sb, tt.doc, tt.storagePath, validFrom, cls?.value || null, tt.hash) : null;
    if (tt) await step({ status: "plan" });

    const week = await readPlan(sb, p.doc, p.storagePath, ttResult?.timetableId ?? await timetableFor(sb, null));
    const problems = [...(ttResult?.issues ?? []), ...week.issues].map((i) => i.en);
    await step({ status: "done", week_id: week.weekId, week_number: week.weekNumber, message: week.what_i_saw, problems });
    return NextResponse.json({ ok: true, ...week, timetable: ttResult });
  } catch (e) {
    const err = e instanceof ReadError ? e : new ReadError("failed", e instanceof Error ? e.message : String(e), [], 500);
    await step({ status: "failed", message: err.message, problems: err.problems });
    return NextResponse.json({ error: err.code, message: err.message, problems: err.problems }, { status: err.status });
  }
}
