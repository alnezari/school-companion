-- Applied to the Supabase project as migration "uploads_source_seen".
-- Where an upload came from (the parent, the refresh button, or the nightly check), the week it read,
-- and when the parent saw the "new week is ready" notice. The school folder links live in `settings`
-- (school_plan_folder, school_timetable_folder, school_class).
alter table uploads
  add column source text not null default 'manual' check (source in ('manual', 'refresh', 'auto')),
  add column week_number int,
  add column seen_at timestamptz;
