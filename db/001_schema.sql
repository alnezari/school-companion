-- Tomorrow First: schema. One family, Row Level Security on everything.
-- Applied to the Supabase project as migration "school_companion_schema".
create extension if not exists pgcrypto;

create table family_members (
  user_id uuid primary key references auth.users(id) on delete cascade,
  created_at timestamptz not null default now()
);
create or replace function is_family() returns boolean
language sql stable security definer set search_path = public as
$$ select exists (select 1 from family_members where user_id = auth.uid()) $$;

create table settings (key text primary key, value text not null);

create table timetables (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  valid_from date not null,
  source_path text,
  notes text,
  created_at timestamptz not null default now()
);
create table periods (
  id uuid primary key default gen_random_uuid(),
  timetable_id uuid not null references timetables(id) on delete cascade,
  day smallint not null check (day between 0 and 4),
  slot smallint not null check (slot between 1 and 8),
  start_time time not null,
  end_time time not null,
  subject_key text not null,
  teacher text,
  unique (timetable_id, day, slot)
);
create table weeks (
  id uuid primary key default gen_random_uuid(),
  title text,
  grade text,
  term text,
  week_number int,
  start_date date not null unique,
  end_date date not null,
  value_of_week jsonb,
  source_path text not null,
  confidence text not null check (confidence in ('green','orange','red')),
  issues jsonb not null default '[]',
  dates_mentioned jsonb not null default '[]',
  model text,
  usage jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create table entries (
  id uuid primary key default gen_random_uuid(),
  week_id uuid not null references weeks(id) on delete cascade,
  day smallint,
  slot smallint,
  subject_key text,
  plan_subject text not null,
  specific_period text,
  topic text, lesson text, pages text, objectives text, activity text,
  links jsonb not null default '[]',
  homework text, independent_practice text, extra text,
  raw_text text not null,
  needs_parent boolean not null default false,
  placed boolean not null default false
);
create index entries_week_day_slot on entries (week_id, day, slot);

-- Progress is per period, so an empty period can be marked done too.
create table progress (
  week_id uuid not null references weeks(id) on delete cascade,
  day smallint not null,
  slot smallint not null,
  done_at timestamptz,
  feeling text check (feeling in ('easy','ok','hard')),
  updated_at timestamptz not null default now(),
  primary key (week_id, day, slot)
);

alter table family_members enable row level security;
alter table settings enable row level security;
alter table timetables enable row level security;
alter table periods enable row level security;
alter table weeks enable row level security;
alter table entries enable row level security;
alter table progress enable row level security;

create policy family_read_members on family_members for select to authenticated using (user_id = auth.uid());
create policy family_settings on settings for all to authenticated using (is_family()) with check (is_family());
create policy family_timetables on timetables for all to authenticated using (is_family()) with check (is_family());
create policy family_periods on periods for all to authenticated using (is_family()) with check (is_family());
create policy family_weeks on weeks for all to authenticated using (is_family()) with check (is_family());
create policy family_entries on entries for all to authenticated using (is_family()) with check (is_family());
create policy family_progress on progress for all to authenticated using (is_family()) with check (is_family());

insert into storage.buckets (id, name, public) values ('documents', 'documents', false) on conflict (id) do nothing;
create policy family_documents on storage.objects for all to authenticated
  using (bucket_id = 'documents' and is_family()) with check (bucket_id = 'documents' and is_family());

alter publication supabase_realtime add table progress;

-- replace_week(p_week jsonb, p_entries jsonb): writes a week and its entries atomically; re-uploading the
-- same week replaces the entries but keeps progress. Current body lives in migration "timetable_versions_and_link".
