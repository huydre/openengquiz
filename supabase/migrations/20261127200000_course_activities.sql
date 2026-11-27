-- Lesson v2 activity model: per-activity progress, per-card speaking question
-- cache, activity-linked speaking attempts, and the service-only
-- advance_course_activity RPC. Legacy lesson_progress stays the lesson-level
-- completion record; it is only marked completed once all 7 activities are
-- done. Legacy completed lessons are backfilled with 7 synthetic completed
-- activity rows so courseMap/levelProgress keep working during cutover.

-- ───────────────────────── content ─────────────────────────
alter table public.course_lessons
  add column activity_content jsonb
  check (activity_content is null or jsonb_typeof(activity_content) = 'object');

-- ───────────────────────── per-activity progress ─────────────────────────
create table public.course_activity_progress (
  user_id uuid not null references public.profiles on delete cascade,
  lesson_id uuid not null references public.course_lessons on delete cascade,
  activity int not null check (activity between 1 and 7),
  small_step int not null default 1 check (small_step between 1 and 18),
  state jsonb not null default '{}'::jsonb check (jsonb_typeof(state) = 'object'),
  completed_at timestamptz,
  updated_at timestamptz not null default now(),
  primary key (user_id, lesson_id, activity)
);
create index course_activity_progress_lesson_idx on public.course_activity_progress (lesson_id);
create trigger course_activity_progress_updated_at before update on public.course_activity_progress
  for each row execute function public.set_updated_at();

alter table public.course_activity_progress enable row level security;
revoke all on public.course_activity_progress from public, anon, authenticated;
grant select on public.course_activity_progress to authenticated;
grant all on public.course_activity_progress to service_role;
create policy "owner reads activity progress" on public.course_activity_progress
  for select to authenticated using (user_id = (select auth.uid()));

-- ───────────────────────── per-card question cache ─────────────────────────
create table public.course_word_questions (
  card_id uuid primary key references public.cards on delete cascade,
  question jsonb not null check (jsonb_typeof(question) = 'object'),
  created_at timestamptz not null default now()
);
alter table public.course_word_questions enable row level security;
revoke all on public.course_word_questions from public, anon, authenticated;
grant select on public.course_word_questions to authenticated;
grant all on public.course_word_questions to service_role;
create policy "signed in reads word questions" on public.course_word_questions
  for select to authenticated using (true);

-- ───────────────────────── attempt linkage ─────────────────────────
alter table public.speaking_attempts
  add column activity int check (activity between 1 and 7),
  add column activity_step int check (activity_step between 1 and 18);

-- ───────────────────────── helpers ─────────────────────────
-- Activities in order; speaking activities are 1,3,4,6; vocabulary 2 and 5;
-- conversation is 7.
create or replace function public.course_activity_kind(p_activity int)
returns text language sql immutable set search_path = '' as $$
  select case p_activity when 2 then 'vocab' when 5 then 'vocab' when 7 then 'call'
    when 1 then 'speaking' when 3 then 'speaking' when 4 then 'speaking' when 6 then 'speaking' end;
$$;

-- Previous lessons in the same level must be fully complete (legacy
-- lesson_progress.completed_at) before a lesson can be touched.
create or replace function public.course_lesson_unlocked(p_user uuid, p_lesson uuid)
returns boolean language plpgsql stable set search_path = '' as $$
declare
  target record;
begin
  select l.position as lesson_position, p.position as part_position, p.level_id
    into target
    from public.course_lessons l join public.course_parts p on p.id = l.part_id
    where l.id = p_lesson;
  if not found then return false; end if;
  return not exists (
    select 1 from public.course_parts p join public.course_lessons l on l.part_id = p.id
    where p.level_id = target.level_id and (p.position, l.position) < (target.part_position, target.lesson_position)
      and not exists (select 1 from public.lesson_progress s
        where s.user_id = p_user and s.lesson_id = l.id and s.completed_at is not null)
  );
end;
$$;

-- Marks the legacy lesson_progress row completed once every activity row for
-- the lesson is completed. Idempotent; preserves the original completed_at.
create or replace function public.course_sync_legacy_completion(p_user uuid, p_lesson uuid)
returns void language plpgsql set search_path = '' as $$
begin
  if not exists (
    select 1 from public.course_lessons l where l.id = p_lesson and l.activity_content is not null
  ) then return; end if;
  if (select count(*) from public.course_activity_progress a
      where a.user_id = p_user and a.lesson_id = p_lesson and a.completed_at is not null) < 7 then
    return;
  end if;
  insert into public.lesson_progress (user_id, lesson_id, step, warmup_transcript, completed_at)
    values (p_user, p_lesson, 7, '', now())
    on conflict (user_id, lesson_id) do update
      set completed_at = coalesce(public.lesson_progress.completed_at, now()),
          step = 7;
end;
$$;

-- Backfill direction 1: lessons whose 7 activities are already complete get
-- a legacy completed_at so courseMap/levelProgress keep working.
insert into public.lesson_progress (user_id, lesson_id, step, warmup_transcript, completed_at)
select a.user_id, a.lesson_id, 7, '', now()
from (select user_id, lesson_id from public.course_activity_progress
      group by user_id, lesson_id
      having count(*) filter (where completed_at is not null) = 7) a
on conflict (user_id, lesson_id) do update
  set completed_at = coalesce(public.lesson_progress.completed_at, now()), step = 7;

-- Backfill direction 2: legacy completed lessons get 7 synthetic completed
-- activity rows so activity-based readers see a finished lesson even before
-- activity_content is populated. Vocabulary activities land on step 18,
-- everything else on step 1. Runs now and is re-run per lesson by the
-- course_lessons activity_content trigger below and by seed_course_level_v2.
create or replace function public.course_backfill_v2_from_legacy(p_lesson uuid default null)
returns void language plpgsql set search_path = '' as $$
begin
  insert into public.course_activity_progress (user_id, lesson_id, activity, small_step, state, completed_at)
  select p.user_id, p.lesson_id, g.activity,
         case when g.activity in (2,5) then 18 else 1 end, '{}'::jsonb, p.completed_at
  from public.lesson_progress p
  join public.course_lessons l on l.id = p.lesson_id
  cross join generate_series(1, 7) as g(activity)
  where p.completed_at is not null
    and (p_lesson is null or p.lesson_id = p_lesson)
  on conflict (user_id, lesson_id, activity) do nothing;
end;
$$;
revoke all on function public.course_backfill_v2_from_legacy(uuid) from public, anon, authenticated;
grant execute on function public.course_backfill_v2_from_legacy(uuid) to service_role;
select public.course_backfill_v2_from_legacy();

-- When activity_content is first populated on a lesson, backfill synthetic
-- completed rows for learners who already finished it via the legacy flow,
-- so the cutover does not relock completed lessons.
create or replace function public.course_lessons_activity_content_trigger()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if new.activity_content is not null and old.activity_content is null then
    perform public.course_backfill_v2_from_legacy(new.id);
  end if;
  return new;
end;
$$;
revoke all on function public.course_lessons_activity_content_trigger() from public, anon, authenticated;
drop trigger if exists course_lessons_activity_content on public.course_lessons;
create trigger course_lessons_activity_content after update of activity_content on public.course_lessons
  for each row execute function public.course_lessons_activity_content_trigger();

revoke all on function public.course_sync_legacy_completion(uuid, uuid) from public, anon, authenticated;
grant execute on function public.course_sync_legacy_completion(uuid, uuid) to service_role;
revoke all on function public.course_lesson_unlocked(uuid, uuid) from public, anon, authenticated;
grant execute on function public.course_lesson_unlocked(uuid, uuid) to service_role;
-- Returns jsonb: the progress row fields plus attempt_id for answer, or null.
create or replace function public.advance_course_activity(
  p_user uuid, p_lesson uuid, p_activity int, p_small_step int, p_action text, p_payload jsonb default '{}'::jsonb)
returns jsonb language plpgsql set search_path = '' as $$
declare
  payload jsonb := coalesce(p_payload, '{}'::jsonb);
  kind text;
  row record;
  prev int;
  new_step int;
  attempt_id uuid;
  attempt_mode text;
  card_key uuid;
  thread_key uuid;
  prompt_text text;
  transcript_text text;
  pron_obj jsonb;
  state_obj jsonb;
begin
  if p_action not in ('checkpoint','complete','start_call','answer') then return null; end if;
  if p_activity not between 1 and 7 or p_small_step not between 1 and 18 then return null; end if;
  kind := public.course_activity_kind(p_activity);
  if kind is null then return null; end if;

  perform pg_advisory_xact_lock(hashtextextended(p_user::text || ':' || p_lesson::text, 0));

  -- Lesson must exist, carry v2 content, and be unlocked by previous lessons.
  if not exists (select 1 from public.course_lessons l where l.id = p_lesson and l.activity_content is not null) then
    return null;
  end if;
  if not public.course_lesson_unlocked(p_user, p_lesson) then return null; end if;

  select * into row from public.course_activity_progress
    where user_id = p_user and lesson_id = p_lesson and activity = p_activity
    for update;

  -- A completed activity is read-only: replay returns the stored row.
  if row.completed_at is not null then
    if p_action = 'checkpoint' or p_action = 'complete' or p_action = 'start_call' or p_action = 'answer' then
      return jsonb_build_object(
        'user_id', row.user_id, 'lesson_id', row.lesson_id, 'activity', row.activity,
        'small_step', row.small_step, 'state', row.state, 'completed_at', row.completed_at,
        'attempt_id', null);
    end if;
    return null;
  end if;

  if p_action = 'checkpoint' then
    prev := nullif(payload->>'previousStep','')::int;
    state_obj := case when jsonb_typeof(payload->'state') = 'object' then payload->'state' else '{}'::jsonb end;
    if prev is null then return null; end if;
    -- The client reports the step it saw (previousStep) and the step it is
    -- moving to (p_small_step). Accept same-step retries and +1 advances only.
    if coalesce(row.small_step, 1) <> prev then return null; end if;
    if p_small_step not in (prev, prev + 1) then return null; end if;
    if kind <> 'vocab' and p_small_step <> 1 then return null; end if;
    if kind = 'vocab' and p_small_step > prev and prev in (11,13,15,17)
       and not exists (select 1 from public.speaking_attempts s where s.user_id = p_user and s.lesson_id = p_lesson
         and s.activity = p_activity and s.activity_step = prev and s.mode = 'speaking') then return null; end if;
    new_step := p_small_step;
    insert into public.course_activity_progress (user_id, lesson_id, activity, small_step, state)
      values (p_user, p_lesson, p_activity, new_step, state_obj)
      on conflict (user_id, lesson_id, activity) do update
        set small_step = excluded.small_step, state = excluded.state, updated_at = now();

  elsif p_action = 'complete' then
    if row.small_step is distinct from p_small_step then return null; end if;
    -- Vocabulary activities require the last checkpoint (step 18) plus the
    -- group's four positional cards enrolled in review_states. Speaking
    -- activities require a saved attempt at their speaking step. Call
    -- requires a finished course thread.
    if kind = 'vocab' then
      if coalesce(row.small_step, 1) <> 18 then return null; end if;
      -- Cards are ordered by (position, id); group A = first 4, group B = next 4.
      if (select count(*) from (
          select c.id from public.course_lessons l
          join public.cards c on c.set_id = l.set_id
          where l.id = p_lesson
          order by c.position, c.id
          offset (case when p_activity = 2 then 0 else 4 end) limit 4
        ) grp
        where not exists (select 1 from public.review_states r
          where r.card_id = grp.id and r.user_id = p_user)) > 0 then
        return null;
      end if;
      -- Also require the group actually has 4 cards.
      if (select count(*) from public.course_lessons l
          join public.cards c on c.set_id = l.set_id
          where l.id = p_lesson) < 8 then return null; end if;
    elsif kind = 'speaking' then
      if not exists (select 1 from public.speaking_attempts s
          where s.user_id = p_user and s.lesson_id = p_lesson
            and s.activity = p_activity and s.activity_step = 1) then
        return null;
      end if;
    elsif kind = 'call' then
      thread_key := nullif(payload->>'threadId','')::uuid;
      if thread_key is null or row.state->>'callLaunched' is distinct from 'true' then return null; end if;
      if not exists (select 1 from public.chat_threads t
          join public.course_lessons l on l.set_id = t.set_id
          where l.id = p_lesson and t.user_id = p_user and t.scenario = 'course'
            and t.course_finished_at is not null
            and t.id = thread_key) then
        return null;
      end if;
    end if;
    update public.course_activity_progress set completed_at = now(), updated_at = now()
      where user_id = p_user and lesson_id = p_lesson and activity = p_activity;
    perform public.course_sync_legacy_completion(p_user, p_lesson);

  elsif p_action = 'start_call' then
    -- Legacy handoff marker: records that the learner launched the call for
    -- activity 7 and sets the legacy lesson_progress calling flag so the
    -- protected chat owner-starts path and finish flow keep working.
    if kind <> 'call' or p_small_step <> 1 then return null; end if;
    insert into public.course_activity_progress (user_id, lesson_id, activity, small_step, state)
      values (p_user, p_lesson, p_activity, 1, jsonb_build_object('callLaunched', true))
      on conflict (user_id, lesson_id, activity) do update
        set state = public.course_activity_progress.state || jsonb_build_object('callLaunched', true),
            updated_at = now();
    insert into public.lesson_progress (user_id, lesson_id, step, calling)
      values (p_user, p_lesson, 7, true)
      on conflict (user_id, lesson_id) do update
        set step = 7, calling = true;

  elsif p_action = 'answer' then
    prompt_text := nullif(payload->>'prompt','');
    transcript_text := nullif(payload->>'transcript','');
    if prompt_text is null or transcript_text is null then return null; end if;
    card_key := nullif(payload->>'cardId','')::uuid;
    pron_obj := case when jsonb_typeof(payload->'pron') = 'object' then payload->'pron' end;
    attempt_mode := coalesce(nullif(payload->>'mode',''), 'speaking');
    if attempt_mode not in ('speaking','scripted') then return null; end if;

    -- The answer must target the current small step: no skipping ahead.
    if coalesce(row.small_step, 1) <> p_small_step then return null; end if;

    -- Step/mode matrix:
    --   speaking activities 1,3,4,6: step 1, mode speaking, no card.
    --   vocab activities 2,5: steps 1..4 scripted per-word pronunciation
    --     (cardId = target card), steps 11,13,15,17 speaking word questions
    --     (cardId = target card), step 18 scripted shadowing (cardId null).
    if kind = 'speaking' then
      if p_small_step <> 1 or attempt_mode <> 'speaking' or card_key is not null then return null; end if;
    elsif kind = 'vocab' then
      if p_small_step between 1 and 4 then
        if attempt_mode <> 'scripted' or card_key is null then return null; end if;
        if not exists (select 1 from public.course_lessons l join public.cards c on c.set_id = l.set_id
            where l.id = p_lesson and c.id = card_key) then return null; end if;
      elsif p_small_step in (11,13,15,17) then
        if attempt_mode <> 'speaking' or card_key is null then return null; end if;
        if not exists (select 1 from public.course_lessons l join public.cards c on c.set_id = l.set_id
            where l.id = p_lesson and c.id = card_key) then return null; end if;
      elsif p_small_step = 18 then
        if attempt_mode <> 'scripted' or card_key is not null then return null; end if;
      else
        return null;
      end if;
    else
      return null; -- call activity has no typed answers
    end if;

    insert into public.speaking_attempts
      (user_id, lesson_id, mode, prompt_text, transcript, pron, activity, activity_step, card_id)
      values (p_user, p_lesson, attempt_mode, prompt_text, transcript_text, pron_obj,
              p_activity, p_small_step, card_key)
      returning id into attempt_id;

    -- Answering records the attempt on the activity state; the client follows
    -- with checkpoint/complete as appropriate.
    insert into public.course_activity_progress (user_id, lesson_id, activity, small_step, state)
      values (p_user, p_lesson, p_activity, p_small_step,
              jsonb_build_object('lastAttemptId', attempt_id))
      on conflict (user_id, lesson_id, activity) do update
        set small_step = greatest(public.course_activity_progress.small_step, excluded.small_step),
            state = public.course_activity_progress.state || excluded.state,
            updated_at = now();
  end if;

  select * into row from public.course_activity_progress
    where user_id = p_user and lesson_id = p_lesson and activity = p_activity;

  return jsonb_build_object(
    'user_id', row.user_id, 'lesson_id', row.lesson_id, 'activity', row.activity,
    'small_step', row.small_step, 'state', row.state, 'completed_at', row.completed_at,
    'attempt_id', attempt_id);
end;
$$;
revoke all on function public.advance_course_activity(uuid,uuid,int,int,text,jsonb) from public, anon, authenticated;
grant execute on function public.advance_course_activity(uuid,uuid,int,int,text,jsonb) to service_role;

-- ───────────────────────── legacy RPC guard ─────────────────────────
-- Rename the existing 7-step RPC and re-expose a guarded wrapper so v2
-- lessons cannot be advanced through the legacy path.
alter function public.advance_course_lesson(uuid, uuid, int, text, jsonb) rename to advance_course_lesson_legacy;
revoke all on function public.advance_course_lesson_legacy(uuid, uuid, int, text, jsonb) from public, anon, authenticated, service_role;

create or replace function public.advance_course_lesson(p_user uuid, p_lesson uuid, p_step int,
  p_action text, p_payload jsonb default '{}'::jsonb)
returns jsonb language plpgsql security definer set search_path = '' as $$
begin
  perform pg_advisory_xact_lock(hashtextextended(p_user::text, 0));
  perform 1 from public.course_lessons l where l.id = p_lesson and l.activity_content is null for update;
  if not found then return null; end if;
  return public.advance_course_lesson_legacy(p_user, p_lesson, p_step, p_action, p_payload);
end;
$$;
revoke all on function public.advance_course_lesson(uuid, uuid, int, text, jsonb) from public, anon, authenticated;
grant execute on function public.advance_course_lesson(uuid, uuid, int, text, jsonb) to service_role;

-- ───────────────────────── seed wrapper ─────────────────────────
-- Atomic v2 seed: publish each lesson's content with its cards.
create or replace function public.seed_course_level_v2(p_owner uuid, p_course jsonb, p_level jsonb)
returns boolean language plpgsql set search_path = '' as $$
declare
  lesson record;
  content jsonb;
begin
  if not public.seed_course_level(p_owner, p_course, p_level) then return false; end if;
  for lesson in
    select l.id, ll.value as payload
    from public.course_levels v
    join public.course_parts p on p.level_id = v.id
    join public.course_lessons l on l.part_id = p.id
    join lateral (
      select value from jsonb_array_elements(p_level->'parts') with ordinality pp(value, ord)
      where pp.ord - 1 = p.position
    ) part_payload on true
    join lateral (
      select value from jsonb_array_elements(part_payload.value->'lessons') with ordinality ll(value, ord)
      where ll.ord - 1 = l.position
    ) ll on true
    where v.course_id = (select id from public.courses where slug = p_course->>'slug')
      and v.slug = p_level->>'slug'
  loop
    content := lesson.payload->'activity_content';
    if content is not null then
      update public.course_lessons set activity_content = content where id = lesson.id;
    end if;
  end loop;
  return true;
end;
$$;
revoke all on function public.seed_course_level_v2(uuid,jsonb,jsonb) from public, anon, authenticated;
grant execute on function public.seed_course_level_v2(uuid,jsonb,jsonb) to service_role;

-- ───────────────────────── chat owner starts: v2 call gate ─────────────────────────
-- For v2 lessons start_call sets the legacy lesson_progress step=7 calling
-- marker, so the existing policy already works. Tighten the v2 branch to
-- require the activity-7 row to be launched and not yet completed.
drop policy "chat owner starts" on public.chat_threads;
create policy "chat owner starts" on public.chat_threads with check (
  summary is null and course_finished_at is null and user_id = (select auth.uid())
  and exists (select 1 from public.study_sets s where s.id = set_id)
  and (scenario <> 'course' or exists (
    select 1 from public.course_lessons l
    where l.set_id = chat_threads.set_id
      and (
        (l.activity_content is null and exists (
          select 1 from public.lesson_progress p where p.lesson_id = l.id
            and p.user_id = (select auth.uid()) and p.step = 7 and p.calling and p.completed_at is null))
        or (l.activity_content is not null and exists (
          select 1 from public.course_activity_progress a where a.lesson_id = l.id
            and a.user_id = (select auth.uid()) and a.activity = 7
            and a.completed_at is null
            and a.state->>'callLaunched' = 'true'))
      )
  ))
);
