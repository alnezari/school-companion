import { z } from "zod";

// What Claude must return. Every field is required (strict schema); "null" means the teacher wrote nothing there.
export const PlanItem = z.object({
  day: z.enum(["sun", "mon", "tue", "wed", "thu", "week"]),
  plan_subject: z.enum(["english", "math", "science", "arabic", "islamic", "anoos", "ai", "hero", "art", "pe", "other"]),
  specific_period: z.enum(["reading", "reading_comp", "vocabulary", "spelling", "grammar", "phonics", "writing", "writing_mech", "english_fluency"]).nullable(),
  topic: z.string().nullable(),
  lesson: z.string().nullable(),
  pages: z.string().nullable(),
  objectives: z.string().nullable(),
  activity: z.string().nullable(),
  links: z.array(z.string()),
  homework: z.string().nullable(),
  independent_practice: z.string().nullable(),
  extra: z.string().nullable(),
  raw_text: z.string(),
  needs_parent: z.boolean(),
});
export type PlanItem = z.infer<typeof PlanItem>;

export const PlanOutput = z.object({
  is_weekly_plan: z.boolean(),
  what_i_saw: z.string(),
  grade: z.string().nullable(),
  term: z.string().nullable(),
  week_number: z.number().nullable(),
  start_date: z.string().nullable(),
  end_date: z.string().nullable(),
  value_of_week: z.object({ arabic: z.string().nullable(), english: z.string().nullable(), source: z.string().nullable() }).nullable(),
  items: z.array(PlanItem),
  dates_mentioned: z.array(z.object({ text: z.string(), date: z.string().nullable(), kind: z.enum(["exam", "due", "event", "other"]) })),
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
