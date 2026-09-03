// One fixed identity per subject: key, colour, icon, labels. Used by both sides of the app.
export type SubjectKey =
  | "science" | "math"
  | "reading" | "reading_comp" | "vocabulary" | "spelling" | "grammar" | "phonics"
  | "writing" | "writing_mech" | "english_fluency"
  | "arabic" | "islamic" | "anoos" | "hero" | "pe" | "art" | "ai";

// The column names used in the school's weekly plan.
export type PlanSubject =
  | "english" | "math" | "science" | "arabic" | "islamic" | "anoos" | "ai" | "hero" | "art" | "pe" | "other";

export const ENGLISH_FAMILY: SubjectKey[] = [
  "reading", "reading_comp", "vocabulary", "spelling", "grammar", "phonics", "writing", "writing_mech", "english_fluency",
];

// Subjects that get one entry for the whole week in the plan.
export const WEEKLY_SUBJECTS: PlanSubject[] = ["ai", "hero", "art", "pe"];

export const PLAN_TO_KEYS: Record<Exclude<PlanSubject, "other">, SubjectKey[]> = {
  english: ENGLISH_FAMILY,
  math: ["math"], science: ["science"], arabic: ["arabic"], islamic: ["islamic"],
  anoos: ["anoos"], ai: ["ai"], hero: ["hero"], art: ["art"], pe: ["pe"],
};

export interface SubjectMeta { en: string; ar: string; color: string; icon: string; family: PlanSubject }

export const SUBJECTS: Record<SubjectKey, SubjectMeta> = {
  science:         { en: "Science",          ar: "العلوم",            color: "#22A06B", icon: "🔬", family: "science" },
  math:            { en: "Math",             ar: "الرياضيات",         color: "#F27D26", icon: "🔢", family: "math" },
  reading:         { en: "Reading",          ar: "القراءة",           color: "#3B7DDD", icon: "📖", family: "english" },
  reading_comp:    { en: "Reading Comp",     ar: "فهم المقروء",       color: "#3B7DDD", icon: "🔍", family: "english" },
  vocabulary:      { en: "Vocabulary",       ar: "المفردات",          color: "#3B7DDD", icon: "🔤", family: "english" },
  spelling:        { en: "Spelling",         ar: "الإملاء",           color: "#3B7DDD", icon: "✏️", family: "english" },
  grammar:         { en: "Grammar",          ar: "القواعد",           color: "#3B7DDD", icon: "🧩", family: "english" },
  phonics:         { en: "Phonics",          ar: "الصوتيات",          color: "#3B7DDD", icon: "🔊", family: "english" },
  writing:         { en: "Writing",          ar: "الكتابة",           color: "#3B7DDD", icon: "✍️", family: "english" },
  writing_mech:    { en: "Writing Mechanism",ar: "آليات الكتابة",     color: "#3B7DDD", icon: "📝", family: "english" },
  english_fluency: { en: "English Fluency",  ar: "الطلاقة الإنجليزية", color: "#3B7DDD", icon: "🗣️", family: "english" },
  arabic:          { en: "Arabic",           ar: "اللغة العربية",     color: "#B8552E", icon: "📜", family: "arabic" },
  islamic:         { en: "Islamic Studies",  ar: "الدراسات الإسلامية", color: "#7A5AF8", icon: "🕌", family: "islamic" },
  anoos:           { en: "Anoos",            ar: "أنوس",              color: "#D9A400", icon: "💛", family: "anoos" },
  hero:            { en: "HERO",             ar: "HERO",              color: "#E0483E", icon: "⭐", family: "hero" },
  pe:              { en: "PE",               ar: "التربية البدنية",   color: "#1FA5A5", icon: "⚽", family: "pe" },
  art:             { en: "Art",              ar: "الفن",              color: "#C74DA0", icon: "🎨", family: "art" },
  ai:              { en: "Computer / AI",    ar: "الحاسب / الذكاء الاصطناعي", color: "#5A6B8C", icon: "💻", family: "ai" },
};

export const PLAN_SUBJECT_LABEL: Record<PlanSubject, { en: string; ar: string }> = {
  english: { en: "English", ar: "الإنجليزية" }, math: { en: "Math", ar: "الرياضيات" }, science: { en: "Science", ar: "العلوم" },
  arabic: { en: "Arabic", ar: "اللغة العربية" }, islamic: { en: "Islamic", ar: "الإسلامية" }, anoos: { en: "Anoos", ar: "أنوس" },
  ai: { en: "AI", ar: "الحاسب" }, hero: { en: "HERO", ar: "HERO" }, art: { en: "Art", ar: "الفن" }, pe: { en: "PE", ar: "البدنية" },
  other: { en: "Other", ar: "أخرى" },
};

export function subjectLabel(key: string, lang: "en" | "ar") {
  const m = SUBJECTS[key as SubjectKey];
  return m ? m[lang] : key;
}

/** Subjects taught in Arabic keep Arabic names; everything else keeps English, whatever the app language. */
export const ARABIC_TAUGHT: SubjectKey[] = ["arabic", "islamic", "anoos"];
export function subjectName(key: string): string {
  const m = SUBJECTS[key as SubjectKey];
  if (!m) return key;
  return ARABIC_TAUGHT.includes(key as SubjectKey) ? m.ar : m.en;
}
