# Phase 03 study modes

- Added Learn, Quiz, Dictation, Writing, Game and Worksheet pages under `src/app/(app)/study/[setId]/`.
- Added shared study runner, questions, result review, pure generators, answer matching, Learn queue and server grading.
- Added authenticated start/finish APIs. Signed-in Supabase client reads data; service-role client calls atomic RPCs with authenticated `p_user_id`.
- Added PDF route with bundled Be Vietnam Pro Regular/Bold TTF and `public/fonts/OFL.txt`.
- Validation: `pnpm typecheck` passed; `pnpm test` passed (8 files, 29 tests); `pnpm lint` passed with 0 errors, 5 existing vendor warnings. PDF render test extracted `quả táo` with local `pdftotext`.
- Integration requires migration `supabase/migrations/20261127095700_srs_study_atomic_rpcs.sql` and `SUPABASE_SECRET_KEY` configured. Migration deployment owned by lead.

Unresolved questions: none.

**Status:** DONE
**Summary:** Phase 03 routes, persistence, server grading, PDF and tests implemented in owned files.
