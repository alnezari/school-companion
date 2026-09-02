import Anthropic from "@anthropic-ai/sdk";
import { zodOutputFormat } from "@anthropic-ai/sdk/helpers/zod";
import { NextResponse } from "next/server";
import fs from "node:fs";
import path from "node:path";
import { supabaseServer } from "@/lib/supabase/server";
import { PlanOutput } from "@/lib/parse-schema";
import { placeWeek, type Period } from "@/lib/placement";
import { SUBJECTS } from "@/lib/subjects";
import { DAY_NAMES } from "@/lib/i18n";

export const runtime = "nodejs";
export const maxDuration = 300; // Vercel Hobby allows up to 5 minutes
export const dynamic = "force-dynamic";

const MODEL = process.env.PLAN_READER_MODEL || "claude-opus-5";
const MAX_BYTES = 20 * 1024 * 1024;
const ALLOWED: Record<string, "pdf" | "image"> = {
  "application/pdf": "pdf", "image/jpeg": "image", "image/png": "image", "image/webp": "image",
};

function timetableText(periods: Period[]) {
  const lines = ["Day | Period | Time | Subject (key)"];
  for (const p of periods)
    lines.push(`${DAY_NAMES.en[p.day]} | ${p.slot} | ${p.start_time.slice(0, 5)}-${p.end_time.slice(0, 5)} | ${SUBJECTS[p.subject_key].en} (${p.subject_key})`);
  return lines.join("\n");
}

export async function POST(req: Request) {
  const sb = await supabaseServer();
  const { data: auth } = await sb.auth.getUser();
  if (!auth.user) return NextResponse.json({ error: "not_signed_in" }, { status: 401 });
  const { data: fam } = await sb.from("family_members").select("user_id").eq("user_id", auth.user.id).maybeSingle();
  if (!fam) return NextResponse.json({ error: "not_family" }, { status: 403 });
  if (!process.env.ANTHROPIC_API_KEY) return NextResponse.json({ error: "no_api_key", message: "ANTHROPIC_API_KEY is not set in Vercel." }, { status: 500 });

  const form = await req.formData();
  const file = form.get("file");
  if (!(file instanceof File)) return NextResponse.json({ error: "no_file" }, { status: 400 });
  const kind = ALLOWED[file.type];
  if (!kind) return NextResponse.json({ error: "bad_type", message: `Unsupported file type ${file.type}. Use PDF, JPG, PNG or WebP.` }, { status: 400 });
  if (file.size > MAX_BYTES) return NextResponse.json({ error: "too_big", message: "File is larger than 20 MB." }, { status: 400 });

  // 1. Keep the original first, whatever happens next.
  const bytes = Buffer.from(await file.arrayBuffer());
  const ext = file.name.split(".").pop()?.toLowerCase() || (kind === "pdf" ? "pdf" : "jpg");
  const storagePath = `plans/${new Date().toISOString().slice(0, 10)}-${crypto.randomUUID().slice(0, 8)}.${ext}`;
  const up = await sb.storage.from("documents").upload(storagePath, bytes, { contentType: file.type, upsert: false });
  if (up.error) return NextResponse.json({ error: "storage", message: up.error.message }, { status: 500 });

  // 2. Current timetable.
  const { data: tt } = await sb.from("timetables").select("id").order("valid_from", { ascending: false }).order("created_at", { ascending: false }).limit(1).maybeSingle();
  if (!tt) return NextResponse.json({ error: "no_timetable", message: "No timetable is stored yet." }, { status: 500 });
  const { data: periodsRaw } = await sb.from("periods").select("day,slot,start_time,end_time,subject_key,teacher").eq("timetable_id", tt.id).order("day").order("slot");
  const periods = (periodsRaw || []) as Period[];

  // 3. One request to Claude: fixed rules + timetable + the document.
  const rules = fs.readFileSync(path.join(process.cwd(), "rules", "weekly-plan-rules.md"), "utf8");
  const system = `${rules}\n\n# The current fixed timetable (Sunday to Thursday, 8 periods)\n${timetableText(periods)}\n`;
  const doc = kind === "pdf"
    ? { type: "document" as const, source: { type: "base64" as const, media_type: "application/pdf" as const, data: bytes.toString("base64") } }
    : { type: "image" as const, source: { type: "base64" as const, media_type: file.type as "image/jpeg" | "image/png" | "image/webp", data: bytes.toString("base64") } };

  const client = new Anthropic();
  let parsed: PlanOutput | null = null;
  let usage: unknown = null;
  try {
    const res = await client.messages.parse({
      model: MODEL,
      max_tokens: 32000,
      system,
      messages: [{ role: "user", content: [doc, { type: "text", text: "Read this document following the rules exactly and return the structured output." }] }],
      output_config: { format: zodOutputFormat(PlanOutput) },
    });
    usage = res.usage;
    if (res.stop_reason === "refusal") return NextResponse.json({ error: "refused", message: "The reader declined this document.", storagePath }, { status: 422 });
    parsed = res.parsed_output ?? null;
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return NextResponse.json({ error: "reader_failed", message: msg, storagePath }, { status: 502 });
  }
  if (!parsed) return NextResponse.json({ error: "unparseable", message: "The reader returned something the app could not understand.", storagePath }, { status: 422 });
  if (!parsed.is_weekly_plan || parsed.items.length === 0)
    return NextResponse.json({ error: "not_a_plan", message: parsed.what_i_saw, problems: parsed.reading_problems, storagePath }, { status: 422 });

  // 4. Place lessons on periods deterministically.
  const { entries, issues, confidence } = placeWeek(parsed, periods);
  if (!parsed.start_date)
    return NextResponse.json({ error: "no_dates", message: `The reader could not find the week's dates. It saw: ${parsed.what_i_saw}`, storagePath }, { status: 422 });
  const start = parsed.start_date;
  const end = parsed.end_date || new Date(new Date(start + "T12:00:00Z").getTime() + 4 * 86400000).toISOString().slice(0, 10);

  // 5. Write the week in one transaction (replaces an earlier upload of the same week).
  const week = {
    title: parsed.what_i_saw, grade: parsed.grade, term: parsed.term, week_number: parsed.week_number,
    start_date: start, end_date: end, value_of_week: parsed.value_of_week, source_path: storagePath,
    confidence, issues, dates_mentioned: parsed.dates_mentioned, model: MODEL, usage, timetable_id: tt.id,
  };
  const { data: weekId, error } = await sb.rpc("replace_week", { p_week: week, p_entries: entries });
  if (error) return NextResponse.json({ error: "db", message: error.message, storagePath }, { status: 500 });

  return NextResponse.json({
    ok: true, weekId, start, end, confidence, issues, what_i_saw: parsed.what_i_saw,
    counts: { items: parsed.items.length, placed: entries.filter((e) => e.placed).length, unplaced: entries.filter((e) => !e.placed).length },
    dates_mentioned: parsed.dates_mentioned, storagePath, usage,
  });
}
