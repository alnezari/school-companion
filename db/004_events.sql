-- Calendar: holidays, exams, due dates and the family's own events. Plan-detected dates carry week_id and source 'plan'.
-- Applied to the Supabase project as migration "events_calendar".
create table events (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  date date not null,
  end_date date,
  kind text not null check (kind in ('holiday','exam','due','event')),
  subject_key text,
  note text,
  source text not null default 'manual' check (source in ('manual','plan','school')),
  week_id uuid references weeks(id) on delete cascade,
  created_at timestamptz not null default now()
);
create index events_date on events (date);
alter table events enable row level security;
create policy family_events on events for all to authenticated using (is_family()) with check (is_family());
