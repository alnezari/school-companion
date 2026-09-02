// Deterministic placement: the timetable says WHEN, the plan says WHAT. No AI involved here.
import { ENGLISH_FAMILY, PLAN_TO_KEYS, WEEKLY_SUBJECTS, SUBJECTS, type PlanSubject, type SubjectKey } from "./subjects";
import type { PlanItem, PlanOutput } from "./parse-schema";
import { DAY_NAMES } from "./i18n";

export interface Period { day: number; slot: number; start_time: string; end_time: string; subject_key: SubjectKey; teacher: string | null }
export interface Issue { level: "orange" | "red"; day: number | null; subject: string; en: string; ar: string }
export interface EntryRow {
  day: number | null; slot: number | null; subject_key: string | null; plan_subject: PlanSubject; specific_period: string | null;
  topic: string | null; lesson: string | null; pages: string | null; objectives: string | null; activity: string | null;
  links: string[]; homework: string | null; independent_practice: string | null; extra: string | null; raw_text: string;
  needs_parent: boolean; placed: boolean;
}

const DAY_IDX: Record<string, number> = { sun: 0, mon: 1, tue: 2, wed: 3, thu: 4 };

function row(item: PlanItem, day: number | null, slot: number | null, key: SubjectKey | null, placed: boolean): EntryRow {
  return {
    day, slot, subject_key: key, plan_subject: item.plan_subject, specific_period: item.specific_period,
    topic: item.topic, lesson: item.lesson, pages: item.pages, objectives: item.objectives, activity: item.activity,
    links: item.links, homework: item.homework, independent_practice: item.independent_practice, extra: item.extra,
    raw_text: item.raw_text, needs_parent: item.needs_parent, placed,
  };
}

function isEmptyItem(i: PlanItem) {
  return !i.raw_text.trim() && !i.topic && !i.lesson && !i.pages && !i.objectives && !i.homework && !i.independent_practice && !i.extra && !i.activity;
}

export function placeWeek(out: PlanOutput, periods: Period[]) {
  const entries: EntryRow[] = [];
  const issues: Issue[] = [];
  const subjLabel = (s: PlanSubject, lang: "en" | "ar") =>
    s === "other" ? (lang === "en" ? "Other" : "أخرى") : SUBJECTS[PLAN_TO_KEYS[s][0]][lang];

  for (const item of out.items) {
    if (isEmptyItem(item)) continue; // an empty cell is a correct answer, nothing to store
    const weekly = item.day === "week" || WEEKLY_SUBJECTS.includes(item.plan_subject);

    if (item.plan_subject === "other") {
      entries.push(row(item, item.day === "week" ? null : DAY_IDX[item.day], null, null, false));
      continue;
    }
    const keys = PLAN_TO_KEYS[item.plan_subject];

    if (weekly) {
      const targets = periods.filter((p) => keys.includes(p.subject_key));
      if (targets.length === 0) {
        entries.push(row(item, null, null, null, false));
        issues.push({ level: "orange", day: null, subject: item.plan_subject,
          en: `${subjLabel(item.plan_subject, "en")} has content for the week but no period in the timetable.`,
          ar: `مادة ${subjLabel(item.plan_subject, "ar")} لها محتوى هذا الأسبوع لكن لا توجد لها حصة في الجدول.` });
      } else for (const p of targets) entries.push(row(item, p.day, p.slot, p.subject_key, true));
      continue;
    }

    const day = DAY_IDX[item.day];
    let targets = periods.filter((p) => p.day === day && keys.includes(p.subject_key));
    if (item.plan_subject === "english" && item.specific_period) {
      const specific = periods.filter((p) => p.day === day && p.subject_key === item.specific_period);
      if (specific.length > 0) targets = specific;
      else {
        const sp = SUBJECTS[item.specific_period as SubjectKey];
        const where = periods.filter((p) => p.subject_key === item.specific_period).map((p) => DAY_NAMES.en[p.day]);
        const whereAr = periods.filter((p) => p.subject_key === item.specific_period).map((p) => DAY_NAMES.ar[p.day]);
        entries.push(row(item, day, null, null, false));
        issues.push({ level: "orange", day, subject: item.plan_subject,
          en: `${DAY_NAMES.en[day]}: the plan names "${sp.en}" but ${DAY_NAMES.en[day]} has no ${sp.en} period${where.length ? ` (it is on ${where.join(", ")})` : ""}. Shown under "not matched".`,
          ar: `${DAY_NAMES.ar[day]}: الخطة تذكر "${sp.ar}" لكن لا توجد حصة ${sp.ar} يوم ${DAY_NAMES.ar[day]}${whereAr.length ? ` (هي يوم ${whereAr.join("، ")})` : ""}. تظهر تحت "لم يُطابق أي حصة".` });
        continue;
      }
    }
    if (targets.length === 0) {
      const days = [...new Set(periods.filter((p) => keys.includes(p.subject_key)).map((p) => p.day))];
      entries.push(row(item, day, null, null, false));
      issues.push({ level: "orange", day, subject: item.plan_subject,
        en: `${DAY_NAMES.en[day]}: the plan has ${subjLabel(item.plan_subject, "en")} content, but the timetable has no ${subjLabel(item.plan_subject, "en")} period that day${days.length ? ` (it is on ${days.map((d) => DAY_NAMES.en[d]).join(", ")})` : ""}. Left on ${DAY_NAMES.en[day]} under "not matched".`,
        ar: `${DAY_NAMES.ar[day]}: الخطة فيها محتوى ${subjLabel(item.plan_subject, "ar")}، لكن الجدول لا يحتوي حصة ${subjLabel(item.plan_subject, "ar")} في هذا اليوم${days.length ? ` (هي يوم ${days.map((d) => DAY_NAMES.ar[d]).join("، ")})` : ""}. تُركت في يوم ${DAY_NAMES.ar[day]} تحت "لم يُطابق أي حصة".` });
    } else for (const p of targets) entries.push(row(item, p.day, p.slot, p.subject_key, true));
  }

  for (const p of out.reading_problems) issues.push({ level: "orange", day: null, subject: "reader", en: p, ar: p });

  let confidence: "green" | "orange" | "red" = "green";
  if (!out.is_weekly_plan || out.items.length === 0) confidence = "red";
  else if (issues.length > 0) confidence = "orange";
  return { entries, issues, confidence };
}

export const _test = { ENGLISH_FAMILY };
