-- Lesson player v2: 7-step flow, per-user feedback tone, attempt phases, ideas,
-- weak terms, calling subphase, warmup translation cache, legacy 4-step remap,
-- and a server-only course call completion marker.

alter table public.course_lessons add column warmup_question_vi text;

alter table public.lesson_progress
  drop constraint lesson_progress_step_check,
  drop constraint lesson_progress_check,
  add constraint lesson_progress_step_check check (step between 1 and 7),
  alter column warmup_transcript set default '',
  add column ideas jsonb check (ideas is null or jsonb_typeof(ideas) = 'array'),
  add column weak_terms jsonb not null default '[]'::jsonb check (jsonb_typeof(weak_terms) = 'array'),
  add column calling boolean not null default false,
  add column first_attempt_id uuid references public.speaking_attempts (id) on delete set null,
  add column second_attempt_id uuid references public.speaking_attempts (id) on delete set null;

-- Feedback tone is a global per-user preference.
alter table public.profiles
  add column feedback_tone text not null default 'friendly' check (feedback_tone in ('serious','friendly','funny'));

alter table public.speaking_attempts
  alter column pron drop not null,
  add column phase text not null default 'first' check (phase in ('first','second')),
  add column lesson_step int check (lesson_step between 1 and 7);

-- Course-owned attempts are written only by the service role; standalone
-- speaking practice keeps its owner-insert policy.
drop policy "speaking attempts insertable by owner" on public.speaking_attempts;
create policy "speaking attempts insertable by owner" on public.speaking_attempts
  for insert to authenticated with check (
    user_id = (select auth.uid())
    and lesson_id is null
    and (card_id is null or exists (select 1 from public.cards where id = card_id))
  );

-- Server-only marker proving a course call finished. Set atomically with the
-- summary by mark_course_call_finished; generic finish_ai_call cannot set it.
alter table public.chat_threads
  add column course_finished_at timestamptz;

-- Clients must not set the course completion marker themselves.
alter policy "chat owner starts" on public.chat_threads with check (
  summary is null and course_finished_at is null and user_id = (select auth.uid())
  and exists (select 1 from public.study_sets s where s.id = set_id)
  and (scenario <> 'course' or exists (
    select 1 from public.course_lessons l join public.lesson_progress p on p.lesson_id = l.id
    where l.set_id = chat_threads.set_id and p.user_id = (select auth.uid())
      and p.step = 7 and p.calling and p.completed_at is null
  ))
);

-- Legacy remap: old 4-step flow -> new 7-step flow.
-- old step 1 (warmup pending) -> 2; old step 2 (vocab phase, first answer saved) -> 5;
-- old step 3 (second answer pending) -> 7 speaking subphase; old step 4 (call phase) -> 7 calling.
update public.lesson_progress set step = case step when 1 then 2 when 2 then 5 when 3 then 7 else 7 end,
  calling = (step = 4);

alter table public.lesson_progress add constraint lesson_progress_completed_check
  check (completed_at is null or step = 7);

-- Backfill attempt phases per user+lesson: earliest = first, next = second.
with ranked as (
  select id, user_id, lesson_id,
    row_number() over (partition by user_id, lesson_id order by created_at, id) as rn
  from public.speaking_attempts where lesson_id is not null
)
update public.speaking_attempts s set phase = case when r.rn = 1 then 'first' else 'second' end
from ranked r where s.id = r.id and r.rn <= 2;

-- Point progress rows at their attempts.
update public.lesson_progress p set
  first_attempt_id = (select s.id from public.speaking_attempts s
    where s.lesson_id = p.lesson_id and s.user_id = p.user_id and s.phase = 'first'
    order by s.created_at desc, s.id desc limit 1),
  second_attempt_id = (select s.id from public.speaking_attempts s
    where s.lesson_id = p.lesson_id and s.user_id = p.user_id and s.phase = 'second'
    order by s.created_at desc, s.id desc limit 1);

drop function public.advance_course_lesson(uuid, uuid, int, text, jsonb, jsonb);

-- Backfill course_finished_at for already-summarized course threads with a
-- plausible turn count, so in-progress lessons can still complete.
update public.chat_threads t set course_finished_at = t.created_at
where t.scenario = 'course' and t.summary is not null and t.course_finished_at is null
  and 4 <= (select count(*) from public.chat_messages m where m.thread_id = t.id and m.role = 'user');

-- New atomic transition for the 7-step player. p_payload carries action-specific
-- fields: transcript, pron, feedback, ideas, tone, weakTerms, threadId, translation.
create or replace function public.advance_course_lesson(p_user uuid, p_lesson uuid, p_step int,
  p_action text, p_payload jsonb default '{}'::jsonb)
returns jsonb language plpgsql set search_path = '' as $$
declare
  current_step int;
  current_calling boolean;
  finished timestamptz;
  target record;
  payload jsonb := coalesce(p_payload, '{}'::jsonb);
  new_step int;
  new_calling boolean;
  attempt_id uuid;
  transcript text := nullif(payload->>'transcript', '');
  pron jsonb := case when jsonb_typeof(payload->'pron') = 'object' then payload->'pron' end;
  feedback jsonb := case when jsonb_typeof(payload->'feedback') = 'object' then payload->'feedback' end;
  ideas jsonb := case when jsonb_typeof(payload->'ideas') = 'array' then payload->'ideas' end;
  weak jsonb := case when jsonb_typeof(payload->'weakTerms') = 'array' then payload->'weakTerms' end;
  tone text := nullif(payload->>'tone', '');
  translation text := nullif(payload->>'translation', '');
  thread_id uuid := nullif(payload->>'threadId', '')::uuid;
begin
  if p_action not in ('advance','answer','retry','ideas','tone','translate') then return null; end if;
  perform pg_advisory_xact_lock(hashtextextended(p_user::text, 0));
  select l.set_id, l.warmup_question, l.position, p.position as part_position, p.level_id
    into target from public.course_lessons l join public.course_parts p on p.id = l.part_id
    where l.id = p_lesson;
  if not found or p_step not between 1 and 7 then return null; end if;
  if exists (select 1 from public.course_parts p join public.course_lessons l on l.part_id = p.id
    where p.level_id = target.level_id and (p.position, l.position) < (target.part_position, target.position)
    and not exists (select 1 from public.lesson_progress s where s.user_id = p_user and s.lesson_id = l.id and s.completed_at is not null)) then
    return null;
  end if;
  select step, calling, completed_at into current_step, current_calling, finished
    from public.lesson_progress where user_id = p_user and lesson_id = p_lesson;
  current_step := coalesce(current_step, 1);
  current_calling := coalesce(current_calling, false);
  if finished is not null or current_step <> p_step then return null; end if;

  new_step := p_step;
  new_calling := current_calling;

  if p_action = 'advance' then
    if p_step = 1 then new_step := 2;
    elsif p_step = 3 then new_step := 4;
    elsif p_step = 4 then new_step := 5;
    elsif p_step = 5 then new_step := 6;
    elsif p_step = 6 then
      if weak is null then return null; end if;
      -- Pronunciation enrolls every lesson card before advancing.
      if exists (select 1 from public.cards c where c.set_id = target.set_id and not exists (
        select 1 from public.review_states r where r.card_id = c.id and r.user_id = p_user)) then
        return null;
      end if;
      new_step := 7;
    elsif p_step = 7 then
      if not current_calling then
        if not exists (select 1 from public.lesson_progress lp where lp.user_id = p_user and lp.lesson_id = p_lesson
            and lp.second_attempt_id is not null) then return null; end if;
        new_calling := true;
      else
        -- Completion proof: a course call thread marked finished by the
        -- service-only mark_course_call_finished RPC (optionally bound to the
        -- thread the client resumed).
        if not exists (select 1 from public.chat_threads t where t.user_id = p_user
            and t.set_id = target.set_id and t.scenario = 'course'
            and t.course_finished_at is not null
            and (thread_id is null or t.id = thread_id)
            and (select count(*) from public.chat_messages m where m.thread_id = t.id and m.role = 'user')
                between 4 and 5) then
          return null;
        end if;
        update public.lesson_progress set completed_at = now() where user_id = p_user and lesson_id = p_lesson;
      end if;
    else return null;
    end if;

  elsif p_action = 'answer' then
    if transcript is null then return null; end if;
    -- Typed answers carry pron = null explicitly; voice answers must include pron.
    if pron is null and coalesce(payload->>'typed', '') <> 'true' then return null; end if;
    if p_step = 2 then
      insert into public.speaking_attempts(user_id, lesson_id, mode, prompt_text, transcript, pron, feedback, phase, lesson_step)
        values (p_user, p_lesson, 'speaking', target.warmup_question, transcript, pron, feedback, 'first', 2)
        returning id into attempt_id;
      insert into public.lesson_progress(user_id, lesson_id, step, warmup_transcript, first_attempt_id)
        values (p_user, p_lesson, 3, transcript, attempt_id)
        on conflict (user_id, lesson_id) do update
          set warmup_transcript = excluded.warmup_transcript,
              first_attempt_id = excluded.first_attempt_id,
              step = 3;
      new_step := 3;
    elsif p_step = 7 and not current_calling then
      if exists (select 1 from public.lesson_progress lp where lp.user_id = p_user and lp.lesson_id = p_lesson
          and lp.second_attempt_id is not null) then return null; end if;
      insert into public.speaking_attempts(user_id, lesson_id, mode, prompt_text, transcript, pron, feedback, phase, lesson_step)
        values (p_user, p_lesson, 'speaking', target.warmup_question, transcript, pron, feedback, 'second', 7)
        returning id into attempt_id;
      update public.lesson_progress set second_attempt_id = attempt_id
        where user_id = p_user and lesson_id = p_lesson;
      -- stays on step 7; comparison is derived by the loader.
    else return null;
    end if;

  elsif p_action = 'retry' then
    if p_step = 3 then
      new_step := 2;
      update public.lesson_progress set step = new_step, first_attempt_id = null
        where user_id = p_user and lesson_id = p_lesson;
    elsif p_step = 7 and not current_calling then
      update public.lesson_progress set second_attempt_id = null
        where user_id = p_user and lesson_id = p_lesson;
    else return null;
    end if;

  elsif p_action = 'ideas' then
    if ideas is null then return null; end if;
    insert into public.lesson_progress(user_id, lesson_id, step, ideas)
      values (p_user, p_lesson, p_step, ideas)
      on conflict (user_id, lesson_id) do update set ideas = excluded.ideas;

  elsif p_action = 'tone' then
    if tone is null or tone not in ('serious','friendly','funny') then return null; end if;
    update public.profiles set feedback_tone = tone where id = p_user;
  elsif p_action = 'translate' then
    if translation is null then return null; end if;
    update public.course_lessons set warmup_question_vi = translation where id = p_lesson;
  end if;

  if p_action = 'advance' and (new_step <> p_step or new_calling <> current_calling) then
    insert into public.lesson_progress (user_id, lesson_id, step, calling)
      values (p_user, p_lesson, new_step, new_calling)
      on conflict (user_id, lesson_id) do update
        set step = excluded.step, calling = excluded.calling;
  end if;

  if p_action = 'advance' and p_step = 6 and weak is not null then
    update public.lesson_progress set weak_terms = weak where user_id = p_user and lesson_id = p_lesson;
  end if;

  insert into public.course_choices (user_id, course_id, level_id)
    select p_user, v.course_id, v.id from public.course_levels v where v.id = target.level_id
    on conflict (user_id, course_id) do update set level_id = excluded.level_id, updated_at = now();
  return jsonb_build_object('step', new_step, 'calling', new_calling, 'attempt', attempt_id,
    'complete', p_action = 'advance' and p_step = 7 and current_calling);
end;
$$;
revoke all on function public.advance_course_lesson(uuid, uuid, int, text, jsonb) from public, anon, authenticated;
grant execute on function public.advance_course_lesson(uuid, uuid, int, text, jsonb) to service_role;

-- Service-only course call completion: sets summary and course_finished_at
-- atomically after validating ownership, turn count, and expected turns.
-- Overwrites a forged generic summary so the marker always reflects a real
-- provider-generated summary passed by the finish route.
create or replace function public.mark_course_call_finished(p_user uuid, p_thread_id uuid,
  p_expected_turns int, p_summary jsonb)
returns boolean language plpgsql security definer set search_path = '' as $$
declare
  thread record;
  turns integer;
begin
  select id, set_id, scenario into thread from public.chat_threads
    where id = p_thread_id and user_id = p_user for update;
  if not found or thread.scenario <> 'course' then return false; end if;
  select count(*) into turns from public.chat_messages
    where thread_id = p_thread_id and role = 'user';
  if turns < 4 or turns > 5 or turns is distinct from p_expected_turns
    or jsonb_typeof(p_summary) is distinct from 'object' then return false; end if;
  update public.chat_threads
    set summary = p_summary, course_finished_at = now()
    where id = p_thread_id;
  return true;
end;
$$;
revoke all on function public.mark_course_call_finished(uuid, uuid, int, jsonb) from public, anon, authenticated;
grant execute on function public.mark_course_call_finished(uuid, uuid, int, jsonb) to service_role;
