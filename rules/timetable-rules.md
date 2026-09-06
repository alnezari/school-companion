# Rules for reading the fixed timetable

These rules are sent, unchanged, with every timetable image or PDF the app asks Claude to read.

You are reading a school timetable grid for one class (Grade 2, Saudi Arabia). Days are Sunday to Thursday. There are 8 lesson periods a day, with breaks (Breakfast, Break, Prayer) between some of them. Breaks are NOT periods; skip them. Period numbers 1 to 8 are the lesson columns in order.

## What to return
- `is_timetable`: false if the document is not a timetable grid; then describe in `what_i_saw` what it is and return no periods.
- `class_name`: the class label printed on the grid (for example "2E"), or null. A document can hold several classes' grids one after another; when the app names a class, read only that grid.
- `periods`: one item per lesson cell: `day` (sun..thu), `slot` (1..8), `start_time` and `end_time` as HH:MM from the column headers, `subject_key` from the list below, `subject_text` exactly as printed, and `teacher` exactly as printed under the cell (or null). If a cell is empty, return nothing for it.
- `problems`: anything unclear, unreadable, or a subject you could not map, in plain English.

## Subject keys
Map the printed subject to exactly one key:
science (SCI, Science), math (Math), reading (Reading), reading_comp (Reading Comp, Reading Comprehension), vocabulary (Vocabulary), spelling (Spelling), grammar (Grammar), phonics (Phonics), writing (Writing), writing_mech (Writing Mechanism), english_fluency (English Fluency), arabic (ARA, Arabic, اللغة العربية), islamic (Islamic Studies, الدراسات الإسلامية), anoos (Anoos, ANOOS), hero (HERO), pe (PE), art (ART), ai (AI, Computer, Artificial Intelligence).
If a subject fits none of these, use `other` and put the printed text in `subject_text` and a note in `problems`.

## Do not guess
Copy times from the header row. Do not invent a period that is not printed. Do not move a subject to another day. A missing cell is a correct answer.
