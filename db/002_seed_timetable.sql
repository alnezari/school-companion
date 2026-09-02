-- Fixed timetable for class 2E, Term 1 2026-27, from the school's aSc timetable image (generated 28/08/2026).
insert into settings (key, value) values ('child_name', 'Taym'), ('parent_pin', '1234') on conflict (key) do nothing;

with tt as (
  insert into timetables (name, valid_from, notes) values ('2E Term 1 (28 Aug 2026)', '2026-08-23', 'Entered from the school timetable image. Class teachers: Mellahie Masarrah, Aljunaid Aisha.')
  returning id
), times(slot, s, e) as (values
  (1,'07:30','08:10'),(2,'08:10','08:50'),(3,'09:10','09:50'),(4,'09:50','10:30'),
  (5,'10:50','11:30'),(6,'11:30','12:10'),(7,'12:30','13:10'),(8,'13:10','13:50')
), grid(day, slot, subject_key, teacher) as (values
  (0,1,'science','Naheed'),(0,2,'pe','Renad'),(0,3,'islamic','Bdur'),(0,4,'math','Zeynab'),(0,5,'vocabulary','Sherouk'),(0,6,'arabic','Nouf'),(0,7,'spelling','Sherouk'),(0,8,'arabic','Nouf'),
  (1,1,'reading','Amal'),(1,2,'reading_comp','Sherouk'),(1,3,'math','Zeynab'),(1,4,'arabic','Nouf'),(1,5,'writing_mech','Sherouk'),(1,6,'writing','Amal'),(1,7,'science','Naheed'),(1,8,'anoos','Aisha'),
  (2,1,'math','Zeynab'),(2,2,'arabic','Nouf'),(2,3,'islamic','Bdur'),(2,4,'english_fluency','Amal'),(2,5,'english_fluency','Amal'),(2,6,'art','Roa'),(2,7,'arabic','Nouf'),(2,8,'science','Naheed'),
  (3,1,'grammar','Sherouk'),(3,2,'islamic','Bdur'),(3,3,'science','Naheed'),(3,4,'hero','Sherouk'),(3,5,'math','Zeynab'),(3,6,'arabic','Nouf'),(3,7,'anoos','Aisha'),(3,8,'phonics','Amal'),
  (4,1,'arabic','Nouf'),(4,2,'math','Zeynab'),(4,3,'pe','Renad'),(4,4,'islamic','Bdur'),(4,5,'ai','Maha'),(4,6,'ai','Maha'),(4,7,'science','Naheed')
)
insert into periods (timetable_id, day, slot, start_time, end_time, subject_key, teacher)
select tt.id, g.day, g.slot, t.s::time, t.e::time, g.subject_key, g.teacher
from tt, grid g join times t on t.slot = g.slot;
