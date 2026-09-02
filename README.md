# Tomorrow First

A school companion for Taym (Grade 2) and his parents. The child's side shows tomorrow's classes in period order; the parents' side shows the whole week, the teacher's exact words, homework, and a confidence bar for every uploaded plan.

- **App**: Next.js on Vercel (free Hobby plan). Live at https://tomorrow-first.vercel.app
- **Data**: Supabase (Postgres, Realtime, Storage, one family login). Schema in `db/`.
- **Reader**: one Claude request per uploaded plan or timetable. The fixed rulebooks live in `rules/` and are sent with every request. Placement onto the timetable is done in code (`lib/placement.ts`), never by the AI.

## Running
Only one secret is needed: `ANTHROPIC_API_KEY` (set in Vercel). See `.env.example`.

```
npm install
npm run dev
```

## Where things are
- `app/page.tsx` – child's "tomorrow" screen; `app/stars/page.tsx` – his stars and badges
- `app/parent/` – parents' day view, upload, timetable, settings
- `app/api/parse-week/route.ts`, `app/api/parse-timetable/route.ts` – the readers
- `app/api/ping/route.ts` + `vercel.json` – daily keep-alive so the free Supabase project never pauses
- `lib/subjects.ts` – subject colours, icons, names
- `lib/i18n.ts` – all app labels in Arabic and English
- `db/` – database schema and seeds (applied through the Supabase migration history)
- `scripts/seed-week2.ts` – Week 2 entered by hand from the PDF (also a fixture for placement)
