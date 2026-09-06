// Server only. The two Claude readers (timetable, weekly plan) and the file handling they share.
import Anthropic from "@anthropic-ai/sdk";
import { zodOutputFormat } from "@anthropic-ai/sdk/helpers/zod";
import fs from "node:fs";
import path from "node:path";
import type { SupabaseClient } from "@supabase/supabase-js";
import { PlanOutput, TimetableOutput } from "@/lib/parse-schema";
import { placeWeek, type Period } from "@/lib/placement";
import { SUBJECTS } from "@/lib/subjects";
import { DAY_NAMES } from "@/lib/i18n";

export const MODEL = process.env.PLAN_READER_MODEL || "claude-opus-5";
const ALLOWED: Record<string, "pdf" | "image"> = { "application/pdf": "pdf", "image/jpeg": "image", "image/png": "image", "image/webp": "image" };
const MAX_BYTES = 20 * 1024 * 1024;
const DAY_IDX: Record<string, number> = { sun: 0, mon: 1, tue: 2, wed: 3, thu: 4 };
const HHMM = /^([01]?\d|2[0-3]):[0-5]\d$/;
type SB = SupabaseClient;
export type Issue = { en: string; ar: string };

/** A reading that could not finish. `problems` are the reader's own words, shown to the parent. */
export class ReadError extends Error {
  constructor(public code: string, message: string, public problems: string[] = [], public status = 422) { super(message); }
}

export function checkFile(v: FormDataEntryValue | null): File | null {
  if (!(v instanceof File) || v.size === 0) return null;
  if (!ALLOWED[v.type]) throw new ReadError("bad_type", `Unsupported file type ${v.type}. Use PDF, JPG, PNG or WebP.`, [], 400);
  if (v.size > MAX_BYTES) throw new ReadError("too_big", "File is larger than 20 MB.", [], 400);
  return v;
}

/** Keeps the original in storage first, whatever happens next, and returns the block Claude reads. */
export async function storeFile(sb: SB, file: File, folder: string, stem: string) {
  const kind = ALLOWED[file.type];
  const bytes = Buffer.from(await file.arrayBuffer());
  const ext = file.name.split(".").pop()?.toLowerCase() || (kind === "pdf" ? "pdf" : "jpg");
  const storagePath = `${folder}/${stem}-${crypto.randomUUID().slice(0, 8)}.${ext}`;
  const up = await sb.storage.from("documents").upload(storagePath, bytes, { contentType: file.type, upsert: false });
  if (up.error) throw new ReadError("storage", up.error.message, [], 500);
  const doc = kind === "pdf"
    ? { type: "document" as const, source: { type: "base64" as const, media_type: "application/pdf" as const, data: bytes.toString("base64") } }
    : { type: "image" as const, source: { type: "base64" as const, media_type: file.type as "image/jpeg" | "image/png" | "image/webp", data: bytes.toString("base64") } };
  return { storagePath, doc };
}
type Doc = Awaited<ReturnType<typeof storeFile>>["doc"];

export async function readTimetable(sb: SB, doc: Doc, storagePath: string, validFrom: string) {
  const rules = fs.readFileSync(path.join(process.cwd(), "rules", "timetable-rules.md"), "utf8");
  let parsed: TimetableOutput | null = null;
  try {
    const res = await new Anthropic().messages.parse({
      model: MODEL, max_tokens: 16000, system: rules,
      messages: [{ role: "user", content: [doc, { type: "text", text: "Read this timetable following the rules exactly and return the structured output." }] }],
      output_config: { format: zodOutputFormat(TimetableOutput) },
    });
    if (res.stop_reason === "refusal") throw new ReadError("refused", "The reader declined the timetable.");
    parsed = res.parsed_output ?? null;
  } catch (e) {
    if (e instanceof ReadError) throw e;
    throw new ReadError("reader_failed", e instanceof Error ? e.message : String(e), [], 502);
  }
  if (!parsed) throw new ReadError("unparseable", "The reader returned something the app could not understand.");
  if (!parsed.is_timetable || parsed.periods.length === 0) throw new ReadError("not_a_timetable", parsed.what_i_saw, parsed.problems);

  // Validate in code. Anything odd becomes an issue; nothing is silently fixed.
  const issues: Issue[] = parsed.problems.map((p) => ({ en: p, ar: p }));
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
  if (error) throw new ReadError("db", error.message, [], 500);
  return { timetableId: id as string, count: periods.length, issues, what_i_saw: parsed.what_i_saw };
}

function timetableText(periods: Period[]) {
  const lines = ["Day | Period | Time | Subject (key)"];
  for (const p of periods)
    lines.push(`${DAY_NAMES.en[p.day]} | ${p.slot} | ${p.start_time.slice(0, 5)}-${p.end_time.slice(0, 5)} | ${SUBJECTS[p.subject_key].en} (${p.subject_key})`);
  return lines.join("\n");
}

/** Reads the weekly plan against the current timetable and writes the week. */
export async function readPlan(sb: SB, doc: Doc, storagePath: string) {
  const { data: tt } = await sb.from("timetables").select("id").order("valid_from", { ascending: false }).order("created_at", { ascending: false }).limit(1).maybeSingle();
  if (!tt) throw new ReadError("no_timetable", "No timetable is stored yet. Upload the timetable together with the plan.", [], 400);
  const { data: periodsRaw } = await sb.from("periods").select("day,slot,start_time,end_time,subject_key,teacher").eq("timetable_id", tt.id).order("day").order("slot");
  const periods = (periodsRaw || []) as Period[];

  const rules = fs.readFileSync(path.join(process.cwd(), "rules", "weekly-plan-rules.md"), "utf8");
  const system = `${rules}\n\n# The current fixed timetable (Sunday to Thursday, 8 periods)\n${timetableText(periods)}\n`;
  let parsed: PlanOutput | null = null;
  let usage: unknown = null;
  try {
    // Streamed: 32k max_tokens trips the SDK's non-streaming 10-minute guard even though this finishes in well under that.
    const stream = new Anthropic().messages.stream({
      model: MODEL, max_tokens: 32000, system,
      messages: [{ role: "user", content: [doc, { type: "text", text: "Read this document following the rules exactly and return the structured output." }] }],
      output_config: { format: zodOutputFormat(PlanOutput) },
    });
    const res = await stream.finalMessage();
    usage = res.usage;
    if (res.stop_reason === "refusal") throw new ReadError("refused", "The reader declined the weekly plan.");
    parsed = res.parsed_output ?? null;
  } catch (e) {
    if (e instanceof ReadError) throw e;
    throw new ReadError("reader_failed", e instanceof Error ? e.message : String(e), [], 502);
  }
  if (!parsed) throw new ReadError("unparseable", "The reader returned something the app could not understand.");
  if (!parsed.is_weekly_plan || parsed.items.length === 0) throw new ReadError("not_a_plan", parsed.what_i_saw, parsed.reading_problems);
  if (!parsed.start_date) throw new ReadError("no_dates", `The reader could not find the week's dates. It saw: ${parsed.what_i_saw}`, parsed.reading_problems);

  const { entries, issues, confidence } = placeWeek(parsed, periods);
  const start = parsed.start_date;
  const end = parsed.end_date || new Date(new Date(start + "T12:00:00Z").getTime() + 4 * 86400000).toISOString().slice(0, 10);
  const week = {
    title: parsed.what_i_saw, grade: parsed.grade, term: parsed.term, week_number: parsed.week_number,
    start_date: start, end_date: end, value_of_week: parsed.value_of_week, source_path: storagePath,
    confidence, issues, dates_mentioned: parsed.dates_mentioned, model: MODEL, usage, timetable_id: tt.id,
  };
  const { data: weekId, error } = await sb.rpc("replace_week", { p_week: week, p_entries: entries });
  if (error) throw new ReadError("db", error.message, [], 500);
  return { weekId: weekId as string, start, end, confidence, issues, what_i_saw: parsed.what_i_saw, counts: { items: parsed.items.length, placed: entries.filter((e) => e.placed).length } };
}
