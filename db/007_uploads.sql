-- One row per "upload the weekly plan + timetable" run. The server updates it step by step, so the
-- Applied to the Supabase project as migration "uploads_jobs".
-- parent sees it working (or what went wrong) even after leaving the page and coming back.
create table uploads (
  id uuid primary key default gen_random_uuid(),
  status text not null default 'saving' check (status in ('saving', 'timetable', 'plan', 'done', 'failed')),
  message text,
  problems jsonb not null default '[]',
  plan_path text,
  timetable_path text,
  week_id uuid references weeks(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
alter table uploads enable row level security;
create policy family_uploads on uploads for all to authenticated using (is_family()) with check (is_family());
alter publication supabase_realtime add table uploads;
