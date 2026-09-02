// Seeds Term 1 Week 2 (30 Aug – 3 Sep 2026) from the school's PDF, hand-structured verbatim (no AI call).
// Usage: FAMILY_EMAIL=... FAMILY_PASSWORD=... npx tsx scripts/seed-week2.ts path/to/plan.pdf
//        npx tsx scripts/seed-week2.ts --sql   (prints SQL for the Supabase SQL editor instead of connecting)
import { createClient } from "@supabase/supabase-js";
import fs from "node:fs";
import { SUPABASE_URL, SUPABASE_KEY } from "../lib/supabase/env";
import { placeWeek, type Period } from "../lib/placement";
import type { PlanOutput, PlanItem } from "../lib/parse-schema";

const NOTEBOOKS = "Please ensure students have their notebooks.";
const WORKSHEET = "The worksheet will be given to the students, and it is due on Sunday, September 6.";
const MEMORISE = "حفظ الآيات حفظًا جيدًا";
const base = { specific_period: null, topic: null, lesson: null, pages: null, objectives: null, activity: null, links: [] as string[], homework: null, independent_practice: null, extra: null, needs_parent: false };
const it = (x: Partial<PlanItem> & Pick<PlanItem, "day" | "plan_subject" | "raw_text">): PlanItem => ({ ...base, ...x });

const math11 = { topic: "Topic 1: Fluently Add and Subtract within 20", lesson: "Lesson 1-1\nAddition Fact strategies", pages: "Pp.5-8", objectives: "1- Students will be able to use counting  on to add numbers .\n\n2- Student will be able to add numbers in any order.", raw_text: "Topic 1: Fluently Add and Subtract within 20\n\nLesson 1-1\nAddition Fact strategies \nPp.5-8\n\nObjectives:1- Students will be able to use counting  on to add numbers .\n\n2- Student will be able to add numbers in any order." };
const math12 = { topic: "Topic 1: Fluently Add and Subtract within 20", lesson: "Lesson 1-2 \nDoubles and Near Doubles", pages: "Pp. 9-12", objectives: "Student will be able to Use doubles and Near doubles to add quickly and accurately", raw_text: "Topic 1: Fluently Add and Subtract within 20\n\n Lesson 1-2 \nDoubles and Near Doubles\n\nPp. 9-12\n\nObjectives: \nStudent will be able to Use doubles and Near doubles to add quickly and accurately" };

const out: PlanOutput = {
  is_weekly_plan: true,
  what_i_saw: "GRADE 2 TERM 1 WEEK 2 PLAN, August 30, 2026 - September 3, 2026 (entered by hand from the PDF; page 5 is an image)",
  grade: "GRADE 2", term: "TERM 1", week_number: 2, start_date: "2026-08-30", end_date: "2026-09-03",
  value_of_week: null,
  items: [
    // ENGLISH
    it({ day: "sun", plan_subject: "english", topic: "English diagnostic test writing and grammar", objectives: "Grammar: Assess students’ prior knowledge of basic Grade 2 grammar skills. Writing: Assess students’ ability to write clear and complete sentences independently.", independent_practice: NOTEBOOKS, needs_parent: true, raw_text: "English diagnostic test writing and grammar \n\nOutcome: Grammar: Assess students’ prior knowledge of basic Grade 2 grammar skills. Writing: Assess students’ ability to write clear and complete sentences independently.\n\nIndependent Practice\nPlease ensure students have their notebooks." }),
    it({ day: "mon", plan_subject: "english", specific_period: "writing", topic: "Writing task- Invitation letter", objectives: "Students will be able to write a simple invitation letter using the correct format and include important details such as who, what, when, and where.", independent_practice: NOTEBOOKS, needs_parent: true, raw_text: "Writing task- Invitation letter\n\nOutcome: Students will be able to write a simple invitation letter using the correct format and include important details such as who, what, when, and where. \n\nIndependent Practice\nPlease ensure students have their notebooks." }),
    it({ day: "tue", plan_subject: "english", specific_period: "reading_comp", topic: "Reading comprehension- characters, setting, plot and main idea.", objectives: "By the end of the lesson, students will be able to identify the characters, setting, and plot (beginning, middle, and end) of a story and determine the main idea to show their understanding of the text.", independent_practice: NOTEBOOKS, needs_parent: true, raw_text: "Reading comprehension- characters, setting, plot and main idea.  \n\nOutcome: By the end of the lesson, students will be able to identify the characters, setting, and plot (beginning, middle, and end) of a story and determine the main idea to show their understanding of the text. \n\nIndependent Practice\nPlease ensure students have their notebooks." }),
    it({ day: "wed", plan_subject: "english", specific_period: "grammar", topic: "Grammar (adjectives)", objectives: "Students will be able to identify and use adjectives correctly in simple sentences and when speaking.", independent_practice: NOTEBOOKS, needs_parent: true, raw_text: "Grammar (adjectives)\n\nOutcome: Students will be able to identify and use adjectives correctly in simple sentences and when speaking. \n\nIndependent Practice\nPlease ensure students have their notebooks." }),
    it({ day: "thu", plan_subject: "english", specific_period: "phonics", topic: "Phonics short vowels", objectives: "Students will be able to recognize, pronounce, read, and spell words containing short vowel sounds: a, e, i, o, and u.", independent_practice: WORKSHEET, homework: WORKSHEET, raw_text: "Phonics short vowels\nOutcome: Students will be able to recognize, pronounce, read, and spell words containing short vowel sounds: a, e, i, o, and u. \n\nIndependent Practice\nThe worksheet will be given to the students, and it is due on Sunday, September 6." }),
    // MATH
    it({ day: "sun", plan_subject: "math", ...math11, independent_practice: NOTEBOOKS, needs_parent: true }),
    it({ day: "mon", plan_subject: "math", ...math11, independent_practice: NOTEBOOKS, needs_parent: true }),
    it({ day: "tue", plan_subject: "math", ...math12, independent_practice: NOTEBOOKS, needs_parent: true }),
    it({ day: "wed", plan_subject: "math", ...math12, independent_practice: NOTEBOOKS, needs_parent: true }),
    it({ day: "thu", plan_subject: "math", topic: "Topic 1: Fluently Add and Subtract within 20", lesson: "Lesson 1-3 \nMake a 10 to add", pages: "Pp.13-16", objectives: "Student will be able to use the strategy of making ten to add quickly and accurately.", independent_practice: WORKSHEET, homework: WORKSHEET, raw_text: "Topic 1: Fluently Add and Subtract within 20\n\nLesson 1-3 \nMake a 10 to add\n\nPp.13-16\n\nObjectives:\nStudent will be able to use the strategy of making ten to add quickly and accurately.\n\nIndependent Practice\nThe worksheet will be given to the students, and it is due on Sunday, September 6." }),
    // SCIENCE
    it({ day: "sun", plan_subject: "science", topic: "Science Diagnostic test", objectives: "Assess student’s prior knowledge of basic skills for grade 2.", independent_practice: NOTEBOOKS, needs_parent: true, raw_text: "Science Diagnostic test\n\nObjectives: Assess student’s prior knowledge of basic skills for grade 2.\n\nIndependent Practice\nPlease ensure students have their notebooks." }),
    it({ day: "mon", plan_subject: "science", topic: "Topic 1: Properties of Matter", lesson: "Topic 1 Launch:Quest Kickoff: Toy Building Kit.", pages: "Pg. 1", objectives: "Students will be introduced to the Quest challenge of choosing materials for a toy building kit, activating prior knowledge about solids, liquids, and gases and how different materials can be used.", independent_practice: NOTEBOOKS, needs_parent: true, raw_text: "Topic 1: Properties of Matter\n\nTopic 1 Launch:Quest Kickoff: Toy Building Kit.\n\nObjectives: Students will be introduced to the Quest challenge of choosing materials for a toy building kit, activating prior knowledge about solids, liquids, and gases and how different materials can be used.\n\nPg. 1\n\nIndependent Practice\nPlease ensure students have their notebooks." }),
    it({ day: "tue", plan_subject: "science", topic: "Topic 1: Properties of Matter", activity: "uConnect Lab: Which Object Is Bigger? (Hands-On) + Literacy Connection (Cause and Effect – Magnets)", pages: "Pg. 4,5", objectives: "Students will plan and conduct a simple investigation to compare and measure two objects, and will practice identifying cause-and-effect relationships in a science text about magnets.", independent_practice: NOTEBOOKS, needs_parent: true, raw_text: "Topic 1: Properties of Matter\n\nuConnect Lab: Which Object Is Bigger? (Hands-On) + Literacy Connection (Cause and Effect – Magnets)\n\nObjectives: Students will plan and conduct a simple investigation to compare and measure two objects, and will practice identifying cause-and-effect relationships in a science text about magnets.\n\nPg. 4,5\n\nIndependent Practice\nPlease ensure students have their notebooks." }),
    it({ day: "thu", plan_subject: "science", topic: "Topic 1: Properties of Matter", lesson: "Lesson 1: Describe Matter", activity: "Jumpstart discovery.\n uInvestigate Lab – What is Different?", pages: "Pg. 6, 7", objectives: "Students will sort objects in multiple ways and learn that matter is anything that has weight and takes up space, described through its properties.", independent_practice: WORKSHEET, homework: WORKSHEET, raw_text: "Topic 1: Properties of Matter\n\nLesson 1: Describe Matter\n\nJumpstart discovery.\n uInvestigate Lab – What is Different? \n\nObjectives: Students will sort objects in multiple ways and learn that matter is anything that has weight and takes up space, described through its properties.\n\nPg. 6, 7\n\nIndependent Practice\nThe worksheet will be given to the students, and it is due on Sunday, September 6." }),
    // SPECIAL SUBJECTS (whole week)
    it({ day: "week", plan_subject: "ai", lesson: "Lesson #1 \nBeyond the Basic - Exploring Copmuters Further", activity: "-​Software Exploration \n-​Hardware Explration", homework: "Home Work : in the Classera .", raw_text: "Lesson #1 \nBeyond the Basic - Exploring Copmuters Further \n-​Software Exploration \n-​Hardware Explration \n\nHome Work : in the Classera ." }),
    it({ day: "week", plan_subject: "hero", topic: "What is HERO ?", objectives: "An introduction to HERO. By the end of the lesson students will learn and demonstrate our HERO values by being Harmless, Eager to Learn, Respectful, and Organized through positive choices and responsible behaviour in the classroom.", raw_text: "What is HERO ? \n\nOutcome : An introduction to HERO. By the end of the lesson students will learn and demonstrate our HERO values by being Harmless, Eager to Learn, Respectful, and Organized through positive choices and responsible behaviour in the classroom." }),
    it({ day: "week", plan_subject: "art", topic: "_Introduction to lines and shapes", lesson: "_The garden  page 10", pages: "page 10", raw_text: "_Introduction to lines and shapes \n\n_The garden  page 10" }),
    it({ day: "week", plan_subject: "pe", topic: "Boys: Soccer : Quick Ball Control: A Smart First Touch\nGirls: Gymnastics : Fun Dynamic Warm-Up: Jump and Stretch", objectives: "This lesson builds on previously acquired skills to confidently guide students to \"Fast Ball Control: Smart First Touch\" with a progressively increasing level of difficulty.\n\nThis lesson includes a specific warm-up followed by focused practical training on “Fun Dynamic Warm-Up: Jump and Stretch,”, with continuous performance correction.", raw_text: "Boys: \nSoccer : Quick Ball Control: A Smart First Touch \n\nThis lesson builds on previously acquired skills to confidently guide students to \"Fast Ball Control: Smart First Touch\" with a progressively increasing level of difficulty. \nGirls: \nGymnastics : Fun Dynamic Warm-Up: Jump and Stretch \n\nThis lesson includes a specific warm-up followed by focused practical training on “Fun Dynamic Warm-Up: Jump and Stretch,”, with continuous performance correction." }),
    // ARABIC LANGUAGE
    it({ day: "sun", plan_subject: "arabic", topic: "الوحدة الأولى\n\nوحدة : أقاربي", lesson: "نشاطات التهيئة + أنجز مشروعي", pages: "صفحة : 19 - 20 - 21", independent_practice: "أنجز مشروعي :\nأن يرسم الطالب شجرة العائلة بشكل مبسط يعبر فيه عن أفراد أسرته", homework: "أنجز مشروعي :\nأن يرسم الطالب شجرة العائلة بشكل مبسط يعبر فيه عن أفراد أسرته", raw_text: "الوحدة الأولى\n\nوحدة : أقاربي\nنشاطات التهيئة + أنجز مشروعي\n\nصفحة : 19 - 20 - 21\n\nIndependent Practice\nأنجز مشروعي :\nأن يرسم الطالب شجرة العائلة بشكل مبسط يعبر فيه عن أفراد أسرته" }),
    it({ day: "mon", plan_subject: "arabic", topic: "الوحدة الأولى\n\nوحدة : أقاربي", lesson: "مكون : نص الاستماع", pages: "صفحة : 22 - 23 - 24 - 25", raw_text: "الوحدة الأولى\n\nوحدة : أقاربي\n\nمكون : نص الاستماع\n\nصفحة : 22 - 23 - 24 - 25" }),
    it({ day: "tue", plan_subject: "arabic", topic: "الوحدة الأولى\n\nوحدة : أقاربي", lesson: "مكون : النشيد : جدتي", pages: "صفحة : 26", raw_text: "الوحدة الأولى\n\nوحدة : أقاربي\n\nمكون : النشيد : جدتي\n\nصفحة : 26" }),
    it({ day: "wed", plan_subject: "arabic", topic: "الوحدة الأولى\n\nوحدة : أقاربي", lesson: "مكون : نص قرائي :\n\nالدرس الأول : صلة الرحم", pages: "صفحة : 27 - 28 - 29", independent_practice: "أن يقرأ الطالب النص قراءة صحيحة ويتدرب على الكلمات الجديدة", homework: "أن يقرأ الطالب النص قراءة صحيحة ويتدرب على الكلمات الجديدة", raw_text: "الوحدة الأولى\n\nوحدة : أقاربي\n\nمكون : نص قرائي :\n\nالدرس الأول : صلة الرحم\n\nصفحة : 27 - 28 - 29\n\nIndependent Practice\nأن يقرأ الطالب النص قراءة صحيحة ويتدرب على الكلمات الجديدة" }),
    it({ day: "thu", plan_subject: "arabic", topic: "الوحدة الأولى\n\nوحدة : أقاربي", lesson: "تابع الدرس الأول : صلة الرحم", activity: "التدريب على قراءة النص في الصف", raw_text: "الوحدة الأولى\n\nوحدة : أقاربي\nتابع الدرس الأول : صلة الرحم\n\nالتدريب على قراءة النص في الصف" }),
    // ISLAMIC STUDIES
    it({ day: "sun", plan_subject: "islamic", topic: "القرآن الكريم", lesson: "العنوان : سورة الليل .\n\nالآيات: 1-3", extra: "الوحدة /الأولى/\n\nالدرس /الأول/\n\n(1)", independent_practice: MEMORISE, homework: MEMORISE, raw_text: "القرآن الكريم\n\nالعنوان : سورة الليل .\n\nالآيات: 1-3\n\nالوحدة /الأولى/\n\nالدرس /الأول/\n\n(1)\n\nIndependent Practice\nحفظ الآيات حفظًا جيدًا" }),
    it({ day: "mon", plan_subject: "islamic", topic: "القرآن الكريم", lesson: "العنوان : سورة الليل .\n\nالآيات: 4-6", independent_practice: MEMORISE, homework: MEMORISE, raw_text: "القرآن الكريم\n\nالعنوان : سورة الليل .\n\nالآيات: 4-6\n\nIndependent Practice\nحفظ الآيات حفظًا جيدًا" }),
    it({ day: "tue", plan_subject: "islamic", topic: "الفقه", lesson: "الدرس: (1)", extra: "الوحدة /الأولى/\n\nالدرس /الأول/\n\n(2)", raw_text: "الفقه\n\nالدرس: (1)\n\nالوحدة /الأولى/\n\nالدرس /الأول/\n\n(2)" }),
    it({ day: "wed", plan_subject: "islamic", topic: "القرآن الكريم", lesson: "العنوان : سورة الليل .\n\nالآيات: 4-6", independent_practice: MEMORISE, homework: MEMORISE, raw_text: "القرآن الكريم\n\nالعنوان : سورة الليل .\n\nالآيات: 4-6\n\nIndependent Practice\nحفظ الآيات حفظًا جيدًا" }),
    it({ day: "thu", plan_subject: "islamic", topic: "تقييم تسميع سورة الليل من 1 إلى 6", homework: "تقييم تسميع سورة الليل من 1 إلى 6", raw_text: "تقييم تسميع سورة الليل من 1 إلى 6" }),
  ],
  dates_mentioned: [
    { text: "The worksheet will be given to the students, and it is due on Sunday, September 6.", date: "2026-09-06", kind: "due" },
    { text: "تقييم تسميع سورة الليل من 1 إلى 6", date: "2026-09-03", kind: "exam" },
  ],
  reading_problems: ["Page 5 of the PDF is an image with no text layer; the value of the week was not entered. Open the original to read it."],
};

// Offline mode: print the SQL to run in the Supabase SQL editor instead of connecting.
const GRID: [number, number, string][] = [
  [0,1,"science"],[0,2,"pe"],[0,3,"islamic"],[0,4,"math"],[0,5,"vocabulary"],[0,6,"arabic"],[0,7,"spelling"],[0,8,"arabic"],
  [1,1,"reading"],[1,2,"reading_comp"],[1,3,"math"],[1,4,"arabic"],[1,5,"writing_mech"],[1,6,"writing"],[1,7,"science"],[1,8,"anoos"],
  [2,1,"math"],[2,2,"arabic"],[2,3,"islamic"],[2,4,"english_fluency"],[2,5,"english_fluency"],[2,6,"art"],[2,7,"arabic"],[2,8,"science"],
  [3,1,"grammar"],[3,2,"islamic"],[3,3,"science"],[3,4,"hero"],[3,5,"math"],[3,6,"arabic"],[3,7,"anoos"],[3,8,"phonics"],
  [4,1,"arabic"],[4,2,"math"],[4,3,"pe"],[4,4,"islamic"],[4,5,"ai"],[4,6,"ai"],[4,7,"science"],
];
function offlineSql() {
  const periods = GRID.map(([day, slot, subject_key]) => ({ day, slot, start_time: "00:00", end_time: "00:00", subject_key, teacher: null })) as Period[];
  const { entries, issues, confidence } = placeWeek(out, periods);
  console.error(`confidence=${confidence} entries=${entries.length} placed=${entries.filter((e) => e.placed).length}`);
  for (const i of issues) console.error(" -", i.en);
  const week = { title: out.what_i_saw, grade: out.grade, term: out.term, week_number: out.week_number, start_date: out.start_date, end_date: out.end_date,
    value_of_week: out.value_of_week, source_path: "plans/2026-08-30-week2-original.pdf", confidence, issues, dates_mentioned: out.dates_mentioned, model: "manual", usage: null };
  const lit = (o: unknown) => "$json$" + JSON.stringify(o) + "$json$::jsonb";
  console.log(`select replace_week(${lit(week)}, ${lit(entries)});`);
}

async function main() {
  const [pdfPath] = process.argv.slice(2);
  if (pdfPath === "--sql") return offlineSql();
  const sb = createClient(SUPABASE_URL, SUPABASE_KEY);
  const { error: authErr } = await sb.auth.signInWithPassword({ email: process.env.FAMILY_EMAIL!, password: process.env.FAMILY_PASSWORD! });
  if (authErr) throw authErr;
  const storagePath = "plans/2026-08-30-week2-original.pdf";
  if (pdfPath) {
    const up = await sb.storage.from("documents").upload(storagePath, fs.readFileSync(pdfPath), { contentType: "application/pdf", upsert: true });
    if (up.error) throw up.error;
  }
  const { data: tt } = await sb.from("timetables").select("id").order("valid_from", { ascending: false }).limit(1).single();
  const { data: periods } = await sb.from("periods").select("day,slot,start_time,end_time,subject_key,teacher").eq("timetable_id", tt!.id);
  const { entries, issues, confidence } = placeWeek(out, periods as Period[]);
  console.log(`confidence=${confidence} entries=${entries.length} placed=${entries.filter((e) => e.placed).length}`);
  for (const i of issues) console.log(" -", i.en);
  const week = { title: out.what_i_saw, grade: out.grade, term: out.term, week_number: out.week_number, start_date: out.start_date, end_date: out.end_date,
    value_of_week: out.value_of_week, source_path: storagePath, confidence, issues, dates_mentioned: out.dates_mentioned, model: "manual", usage: null, timetable_id: tt!.id };
  const { data, error } = await sb.rpc("replace_week", { p_week: week, p_entries: entries });
  if (error) throw error;
  console.log("week id", data);
}
main().catch((e) => { console.error(e); process.exit(1); });
