-- Widen the learn-mode question types accepted by finish_study_session.
-- Learn steps now mix recognition forms (multiple_choice, match) and recall forms
-- (learn_type, fill, dictation_term); the TypeScript grader in
-- src/lib/study/grade-session.ts already validates the recognition-then-recall order.
-- Everything else (scoring, daily activity, review_states enrollment) is unchanged.

create or replace function public.finish_study_session(
  p_user_id uuid, p_session_id uuid, p_attempts jsonb, p_score integer, p_total integer
) returns jsonb language plpgsql security invoker set search_path = '' as $$
declare
  v_user uuid := p_user_id;
  v_session public.study_sessions%rowtype;
  v_attempt jsonb;
  v_card_id uuid;
  v_type text;
  v_correct boolean;
  v_count integer := 0;
  v_score integer := 0;
  v_combo integer := 0;
  v_expected_total integer;
  v_day date := (now() at time zone 'Asia/Ho_Chi_Minh')::date;
  v_minutes integer;
begin
  if v_user is null or not exists (select 1 from public.profiles where id = v_user)
  then raise exception 'not allowed: user not found'; end if;
  if p_session_id is null then raise exception 'invalid session'; end if;
  select * into v_session from public.study_sessions
  where id = p_session_id and user_id = v_user for update;
  if not found then raise exception 'not found: study session'; end if;
  if v_session.finished_at is not null then
    return jsonb_build_object('status', 'duplicate', 'session_id', p_session_id,
      'score', v_session.score, 'total', v_session.total);
  end if;
  if v_session.mode not in ('learn', 'quiz', 'dictation', 'writing', 'game')
    or v_session.set_id is null or not exists (
      select 1 from public.study_sets s where s.id = v_session.set_id
        and (s.owner_id = v_user or s.visibility in ('public', 'unlisted'))
    ) then raise exception 'not allowed: study set or mode'; end if;
  if p_attempts is null or jsonb_typeof(p_attempts) <> 'array'
    or jsonb_array_length(p_attempts) not between 1 and 500
    or p_score is null or p_score < 0 or p_total is null or p_total < 1
  then raise exception 'invalid study result'; end if;

  for v_attempt in select value from jsonb_array_elements(p_attempts) as a(value) loop
    if jsonb_typeof(v_attempt) <> 'object'
      or jsonb_typeof(v_attempt -> 'correct') <> 'boolean'
      or jsonb_typeof(v_attempt -> 'answer') <> 'string'
      or length(v_attempt ->> 'answer') > 1000
    then raise exception 'invalid study attempt'; end if;
    begin
      v_card_id := (v_attempt ->> 'card_id')::uuid;
    exception when invalid_text_representation then
      raise exception 'invalid study card';
    end;
    v_type := v_attempt ->> 'question_type';
    v_correct := (v_attempt ->> 'correct')::boolean;
    if v_card_id is null or not exists (
      select 1 from public.cards c
      where c.id = v_card_id and c.set_id = v_session.set_id
    ) then raise exception 'not allowed: study card not found'; end if;
    if not (
      (v_session.mode = 'learn' and v_type in ('multiple_choice', 'match', 'learn_type', 'fill', 'dictation_term')) or
      (v_session.mode = 'quiz' and v_type in ('multiple_choice', 'true_false', 'fill', 'match')) or
      (v_session.mode = 'dictation' and v_type in ('dictation_term', 'dictation_example')) or
      (v_session.mode = 'writing' and v_type = 'writing') or
      (v_session.mode = 'game' and v_type = 'game')
    ) then raise exception 'invalid study question type'; end if;

    insert into public.study_attempts
      (session_id, card_id, question_type, correct, answer)
    values (p_session_id, v_card_id, v_type, v_correct, v_attempt ->> 'answer');
    v_count := v_count + 1;
    if v_session.mode = 'game' then
      v_combo := case when v_correct then v_combo + 1 else 0 end;
      if v_correct then v_score := v_score + 100 + least(v_combo - 1, 5) * 20; end if;
    elsif v_correct then
      v_score := v_score + 1;
    end if;
  end loop;
  -- Game rounds are worth up to 200 points each; other modes score 1 per question.
  -- (Kept as if/else: the Supabase CLI statement splitter misreads an inline CASE here.)
  if v_session.mode = 'game' then
    v_expected_total := v_count * 200;
  else
    v_expected_total := v_count;
  end if;
  if p_score <> v_score or p_total <> v_expected_total
  then raise exception 'invalid study score'; end if;

  update public.study_sessions set score = p_score, total = p_total, finished_at = now()
  where id = p_session_id;
  v_minutes := greatest(0, floor(extract(epoch from (now() - v_session.started_at)) / 60)::integer);
  insert into public.user_daily_activity (user_id, day, studied, minutes)
  values (v_user, v_day, 1, v_minutes)
  on conflict (user_id, day) do update set
    studied = public.user_daily_activity.studied + 1,
    minutes = public.user_daily_activity.minutes + excluded.minutes;
  if v_session.mode = 'learn' then
    insert into public.review_states (user_id, card_id)
    select v_user, c.id from public.cards c where c.set_id = v_session.set_id
    on conflict (user_id, card_id) do nothing;
  end if;
  return jsonb_build_object('status', 'completed', 'session_id', p_session_id,
    'score', p_score, 'total', p_total);
end $$;
