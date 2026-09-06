-- Applied to the Supabase project as migration "timetable_file_hash".
-- A timetable file that was already read is not read again: the same bytes reuse the stored timetable.
-- The first week's start date (settings.school_week1_start) defines the whole term's week numbers.
alter table timetables add column file_hash text;
create or replace function public.replace_timetable(p_tt jsonb, p_periods jsonb) returns uuid
language plpgsql set search_path to 'public' as $function$
declare v_id uuid;
begin
  insert into timetables (name, valid_from, source_path, notes, class_name, issues, model, file_hash)
  values (p_tt->>'name', (p_tt->>'valid_from')::date, p_tt->>'source_path', p_tt->>'notes', p_tt->>'class_name',
          coalesce(p_tt->'issues', '[]'::jsonb), p_tt->>'model', p_tt->>'file_hash')
  returning id into v_id;
  insert into periods (timetable_id, day, slot, start_time, end_time, subject_key, teacher)
  select v_id, (p->>'day')::smallint, (p->>'slot')::smallint, (p->>'start_time')::time, (p->>'end_time')::time, p->>'subject_key', p->>'teacher'
  from jsonb_array_elements(p_periods) p;
  return v_id;
end $function$;
