-- Lets a learner skip a speaking step when the AI speaking quota is used up (the reference
-- flow offers "Bỏ qua" there). The API sets payload.skipped only after confirming the quota is
-- exhausted; everything else in advance_course_activity is unchanged.

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
       and coalesce(payload->>'skipped', '') <> 'true'
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
      if coalesce(payload->>'skipped', '') <> 'true' and not exists (select 1 from public.speaking_attempts s
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
