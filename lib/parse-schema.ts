import { z } from "zod";

// What Claude must return. Every field is required (strict schema); "null" means the teacher wrote nothing there.
export const PlanItem = z.object({
  day: z.enum(["sun", "mon", "tue", "wed", "thu", "week"]),
  plan_subject: z.enum(["english", "math", "science", "arabic", "islamic", "anoos", "ai", "hero", "art", "pe", "other"]),
  // Nullable is kept only for this one field (an enum choice, not free text); everything else uses "" for "not given" to
  // keep the number of nullable/union fields in the schema well under Anthropic's structured-output limit.
  specific_period: z.enum(["reading", "reading_comp", "vocabulary", "spelling", "grammar", "phonics", "writing", "writing_mech", "english_fluency"]).nullable(),
  topic: z.string(),
  lesson: z.string(),
  pages: z.string(),
  objectives: z.string(),
  activity: z.string(),
  links: z.array(z.string()),
  homework: z.string(),
  independent_practice: z.string(),
  extra: z.string(),
  raw_text: z.string(),
  needs_parent: z.boolean(),
});
export type PlanItem = z.infer<typeof PlanItem>;

export const PlanOutput = z.object({
  is_weekly_plan: z.boolean(),
  what_i_saw: z.string(),
  grade: z.string(),
  term: z.string(),
  week_number: z.number().nullable(),
  start_date: z.string(),
  end_date: z.string(),
  value_of_week: z.object({ arabic: z.string(), english: z.string(), source: z.string() }),
  items: z.array(PlanItem),
  dates_mentioned: z.array(z.object({ text: z.string(), date: z.string(), kind: z.enum(["exam", "due", "event", "other"]) })),
  reading_problems: z.array(z.string()),
});
export type PlanOutput = z.infer<typeof PlanOutput>;

export const TimetableOutput = z.object({
  is_timetable: z.boolean(),
  what_i_saw: z.string(),
  class_name: z.string().nullable(),
  periods: z.array(z.object({
    day: z.enum(["sun", "mon", "tue", "wed", "thu"]),
    slot: z.number(),
    start_time: z.string(),
    end_time: z.string(),
    subject_key: z.enum(["science", "math", "reading", "reading_comp", "vocabulary", "spelling", "grammar", "phonics", "writing", "writing_mech", "english_fluency", "arabic", "islamic", "anoos", "hero", "pe", "art", "ai", "other"]),
    subject_text: z.string(),
    teacher: z.string().nullable(),
  })),
  problems: z.array(z.string()),
});
export type TimetableOutput = z.infer<typeof TimetableOutput>;
