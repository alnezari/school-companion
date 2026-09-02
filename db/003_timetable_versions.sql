-- Each week remembers which timetable it was placed against. Timetables are versioned, never overwritten.
-- Applied to the Supabase project as migration "timetable_versions_and_link".
alter table weeks add column if not exists timetable_id uuid references timetables(id);
update weeks set timetable_id = (select id from timetables order by valid_from desc, created_at desc limit 1) where timetable_id is null;
alter table timetables add column if not exists class_name text;
alter table timetables add column if not exists issues jsonb not null default '[]';
alter table timetables add column if not exists model text;

create or replace function replace_week(p_week jsonb, p_entries jsonb) returns uuid
language plpgsql security invoker set search_path = public as $$
declare v_id uuid;
begin
  select id into v_id from weeks where start_date = (p_week->>'start_date')::date;
  if v_id is null then
    insert into weeks (title, grade, term, week_number, start_date, end_date, value_of_week, source_path, confidence, issues, dates_mentioned, model, usage, timetable_id)
    values (p_week->>'title', p_week->>'grade', p_week->>'term', (p_week->>'week_number')::int,
            (p_week->>'start_date')::date, (p_week->>'end_date')::date, p_week->'value_of_week', p_week->>'source_path',
            p_week->>'confidence', coalesce(p_week->'issues', '[]'::jsonb), coalesce(p_week->'dates_mentioned', '[]'::jsonb),
            p_week->>'model', p_week->'usage', (p_week->>'timetable_id')::uuid)
    returning id into v_id;
  else
    update weeks set title = p_week->>'title', grade = p_week->>'grade', term = p_week->>'term', week_number = (p_week->>'week_number')::int,
      end_date = (p_week->>'end_date')::date, value_of_week = p_week->'value_of_week', source_path = p_week->>'source_path',
      confidence = p_week->>'confidence', issues = coalesce(p_week->'issues', '[]'::jsonb),
      dates_mentioned = coalesce(p_week->'dates_mentioned', '[]'::jsonb), model = p_week->>'model', usage = p_week->'usage',
      timetable_id = (p_week->>'timetable_id')::uuid, updated_at = now()
    where id = v_id;
    delete from entries where week_id = v_id;
  end if;
  insert into entries (week_id, day, slot, subject_key, plan_subject, specific_period, topic, lesson, pages, objectives, activity, links, homework, independent_practice, extra, raw_text, needs_parent, placed)
  select v_id, (e->>'day')::smallint, (e->>'slot')::smallint, e->>'subject_key', e->>'plan_subject', e->>'specific_period',
         e->>'topic', e->>'lesson', e->>'pages', e->>'objectives', e->>'activity', coalesce(e->'links', '[]'::jsonb),
         e->>'homework', e->>'independent_practice', e->>'extra', coalesce(e->>'raw_text', ''),
         coalesce((e->>'needs_parent')::boolean, false), coalesce((e->>'placed')::boolean, false)
  from jsonb_array_elements(p_entries) e;
  return v_id;
end $$;

-- Inserts a new timetable version with its periods atomically.
create or replace function replace_timetable(p_tt jsonb, p_periods jsonb) returns uuid
language plpgsql security invoker set search_path = public as $$
declare v_id uuid;
begin
  insert into timetables (name, valid_from, source_path, notes, class_name, issues, model)
  values (p_tt->>'name', (p_tt->>'valid_from')::date, p_tt->>'source_path', p_tt->>'notes', p_tt->>'class_name',
          coalesce(p_tt->'issues', '[]'::jsonb), p_tt->>'model')
  returning id into v_id;
  insert into periods (timetable_id, day, slot, start_time, end_time, subject_key, teacher)
  select v_id, (p->>'day')::smallint, (p->>'slot')::smallint, (p->>'start_time')::time, (p->>'end_time')::time, p->>'subject_key', p->>'teacher'
  from jsonb_array_elements(p_periods) p;
  return v_id;
end $$;
