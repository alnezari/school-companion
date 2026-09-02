import Anthropic from "@anthropic-ai/sdk";
import { zodOutputFormat } from "@anthropic-ai/sdk/helpers/zod";
import { NextResponse } from "next/server";
import fs from "node:fs";
import path from "node:path";
import { supabaseServer } from "@/lib/supabase/server";
import { TimetableOutput } from "@/lib/parse-schema";
import { SUBJECTS } from "@/lib/subjects";

export const runtime = "nodejs";
export const maxDuration = 300;
export const dynamic = "force-dynamic";

const MODEL = process.env.PLAN_READER_MODEL || "claude-opus-5";
const ALLOWED: Record<string, "pdf" | "image"> = { "application/pdf": "pdf", "image/jpeg": "image", "image/png": "image", "image/webp": "image" };
const DAY_IDX: Record<string, number> = { sun: 0, mon: 1, tue: 2, wed: 3, thu: 4 };
const HHMM = /^([01]?\d|2[0-3]):[0-5]\d$/;

export async function POST(req: Request) {
  const sb = await supabaseServer();
  const { data: auth } = await sb.auth.getUser();
  if (!auth.user) return NextResponse.json({ error: "not_signed_in" }, { status: 401 });
  const { data: fam } = await sb.from("family_members").select("user_id").eq("user_id", auth.user.id).maybeSingle();
  if (!fam) return NextResponse.json({ error: "not_family" }, { status: 403 });
  if (!process.env.ANTHROPIC_API_KEY) return NextResponse.json({ error: "no_api_key", message: "ANTHROPIC_API_KEY is not set in Vercel." }, { status: 500 });

  const form = await req.formData();
  const file = form.get("file");
  const validFrom = String(form.get("valid_from") || new Date().toISOString().slice(0, 10));
  if (!(file instanceof File)) return NextResponse.json({ error: "no_file" }, { status: 400 });
  const kind = ALLOWED[file.type];
  if (!kind) return NextResponse.json({ error: "bad_type", message: `Unsupported file type ${file.type}.` }, { status: 400 });
  if (file.size > 20 * 1024 * 1024) return NextResponse.json({ error: "too_big", message: "File is larger than 20 MB." }, { status: 400 });

  const bytes = Buffer.from(await file.arrayBuffer());
  const ext = file.name.split(".").pop()?.toLowerCase() || (kind === "pdf" ? "pdf" : "jpg");
  const storagePath = `timetables/${validFrom}-${crypto.randomUUID().slice(0, 8)}.${ext}`;
  const up = await sb.storage.from("documents").upload(storagePath, bytes, { contentType: file.type, upsert: false });
  if (up.error) return NextResponse.json({ error: "storage", message: up.error.message }, { status: 500 });

  const rules = fs.readFileSync(path.join(process.cwd(), "rules", "timetable-rules.md"), "utf8");
  const doc = kind === "pdf"
    ? { type: "document" as const, source: { type: "base64" as const, media_type: "application/pdf" as const, data: bytes.toString("base64") } }
    : { type: "image" as const, source: { type: "base64" as const, media_type: file.type as "image/jpeg" | "image/png" | "image/webp", data: bytes.toString("base64") } };

  let parsed: TimetableOutput | null = null;
  try {
    const res = await new Anthropic().messages.parse({
      model: MODEL, max_tokens: 16000, system: rules,
      messages: [{ role: "user", content: [doc, { type: "text", text: "Read this timetable following the rules exactly and return the structured output." }] }],
      output_config: { format: zodOutputFormat(TimetableOutput) },
    });
    if (res.stop_reason === "refusal") return NextResponse.json({ error: "refused", message: "The reader declined this document.", storagePath }, { status: 422 });
    parsed = res.parsed_output ?? null;
  } catch (e) {
    return NextResponse.json({ error: "reader_failed", message: e instanceof Error ? e.message : String(e), storagePath }, { status: 502 });
  }
  if (!parsed) return NextResponse.json({ error: "unparseable", message: "The reader returned something the app could not understand.", storagePath }, { status: 422 });
  if (!parsed.is_timetable || parsed.periods.length === 0)
    return NextResponse.json({ error: "not_a_timetable", message: parsed.what_i_saw, problems: parsed.problems, storagePath }, { status: 422 });

  // Validate in code. Anything odd becomes an issue; nothing is silently fixed.
  const issues: { en: string; ar: string }[] = parsed.problems.map((p) => ({ en: p, ar: p }));
  const seen = new Set<string>();
  const periods: { day: number; slot: number; start_time: string; end_time: string; subject_key: string; teacher: string | null }[] = [];
  for (const p of parsed.periods) {
    const day = DAY_IDX[p.day];
    const key = `${day}-${p.slot}`;
    if (p.slot < 1 || p.slot > 8 || !HHMM.test(p.start_time) || !HHMM.test(p.end_time) || seen.has(key)) {
      issues.push({ en: `Skipped an unreadable cell: ${p.day} period ${p.slot} "${p.subject_text}" ${p.start_time}-${p.end_time}.`, ar: `تم تجاهل خلية غير مقروءة: ${p.day} حصة ${p.slot} "${p.subject_text}" ${p.start_time}-${p.end_time}.` });
      continue;
    }
    if (p.subject_key === "other") issues.push({ en: `${p.day} period ${p.slot}: unknown subject "${p.subject_text}". Fix it by hand on the timetable page.`, ar: `${p.day} حصة ${p.slot}: مادة غير معروفة "${p.subject_text}". صحّحها يدويًا في صفحة الجدول.` });
    seen.add(key);
    periods.push({ day, slot: p.slot, start_time: p.start_time, end_time: p.end_time, subject_key: p.subject_key in SUBJECTS ? p.subject_key : "other", teacher: p.teacher });
  }
  if (periods.length < 20) issues.push({ en: `Only ${periods.length} periods were read; a full week has about 39. Check the original.`, ar: `قُرئت ${periods.length} حصة فقط؛ الأسبوع الكامل فيه نحو 39. راجع المستند الأصلي.` });

  const tt = { name: `${parsed.class_name ?? "Timetable"} from ${validFrom}`, valid_from: validFrom, source_path: storagePath, notes: parsed.what_i_saw, class_name: parsed.class_name, issues, model: MODEL };
  const { data: id, error } = await sb.rpc("replace_timetable", { p_tt: tt, p_periods: periods });
  if (error) return NextResponse.json({ error: "db", message: error.message, storagePath }, { status: 500 });
  return NextResponse.json({ ok: true, timetableId: id, count: periods.length, issues, what_i_saw: parsed.what_i_saw, class_name: parsed.class_name, storagePath });
}
