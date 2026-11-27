-- Keep learning writes inside server-only, atomic database functions.
alter table public.profiles
  add column new_cards_per_day integer not null default 20
  check (new_cards_per_day between 1 and 100);
alter table public.review_states
  add column version integer not null default 0 check (version >= 0);
alter table public.review_logs
  add column was_new boolean not null default false;

create table public.user_daily_activity (
  user_id uuid not null references public.profiles (id) on delete cascade,
  day date not null,
  reviews integer not null default 0 check (reviews >= 0),
  studied integer not null default 0 check (studied >= 0),
  minutes integer not null default 0 check (minutes >= 0),
  primary key (user_id, day)
);
alter table public.user_daily_activity enable row level security;
create policy "daily activity readable by self" on public.user_daily_activity
  for select to authenticated using (user_id = (select auth.uid()));
revoke all on public.user_daily_activity from public, anon, authenticated;
grant select on public.user_daily_activity to authenticated;

-- Remove legacy write policies; SELECT policies retain the original owner checks.
drop policy "review_states owned" on public.review_states;
create policy "review_states readable by self" on public.review_states
  for select to authenticated using (user_id = (select auth.uid()));
drop policy "review_logs insertable by self" on public.review_logs;
drop policy "study_sessions owned" on public.study_sessions;
create policy "study_sessions readable by self" on public.study_sessions
  for select to authenticated using (user_id = (select auth.uid()));
drop policy "study_attempts owned via session" on public.study_attempts;
create policy "study_attempts readable by self" on public.study_attempts
  for select to authenticated using (exists (
    select 1 from public.study_sessions ss
    where ss.id = session_id and ss.user_id = (select auth.uid())
  ));
revoke insert, update, delete on public.review_states, public.review_logs,
  public.study_sessions, public.study_attempts from public, anon, authenticated;
grant select on public.profiles, public.study_sets, public.cards to service_role;
grant select, insert, update on public.review_states, public.review_logs,
  public.study_sessions, public.study_attempts, public.user_daily_activity to service_role;

create or replace function public.enroll_set_cards(p_user_id uuid, p_set_id uuid)
returns integer language plpgsql security invoker set search_path = '' as $$
declare
  v_user uuid := p_user_id;
  v_added integer;
begin
  if v_user is null or not exists (select 1 from public.profiles where id = v_user)
  then raise exception 'not allowed: user not found'; end if;
  if p_set_id is null or not exists (
    select 1 from public.study_sets s where s.id = p_set_id
      and (s.owner_id = v_user or s.visibility in ('public', 'unlisted'))
  ) then raise exception 'not allowed: set not found'; end if;

  insert into public.review_states (user_id, card_id)
  select v_user, c.id from public.cards c where c.set_id = p_set_id
  on conflict (user_id, card_id) do nothing;
  get diagnostics v_added = row_count;
  return v_added;
end $$;

create or replace function public.commit_review(
  p_user_id uuid, p_card_id uuid, p_client_review_id uuid, p_rating smallint,
  p_expected_version integer, p_next_state jsonb, p_log jsonb
) returns jsonb language plpgsql security invoker set search_path = '' as $$
declare
  v_user uuid := p_user_id;
  v_state public.review_states%rowtype;
  v_prior public.review_logs%rowtype;
  v_day date := (now() at time zone 'Asia/Ho_Chi_Minh')::date;
  v_quota integer;
  v_new_today integer;
  v_due timestamptz;
  v_reps integer;
  v_lapses integer;
  v_next_version integer;
  v_next_state text;
begin
  if v_user is null or not exists (select 1 from public.profiles where id = v_user)
  then raise exception 'not allowed: user not found'; end if;
  if p_card_id is null or p_client_review_id is null or p_rating is null
    or p_rating not between 1 and 4
    or p_expected_version is null or p_expected_version < 0
    or p_next_state is null or jsonb_typeof(p_next_state) <> 'object'
    or p_log is null or jsonb_typeof(p_log) <> 'object'
  then raise exception 'invalid review input'; end if;
  if not exists (
    select 1 from public.cards c join public.study_sets s on s.id = c.set_id
    where c.id = p_card_id
      and (s.owner_id = v_user or s.visibility in ('public', 'unlisted'))
  ) then raise exception 'not allowed: card not found'; end if;

  select * into v_state from public.review_states
  where user_id = v_user and card_id = p_card_id for update;
  if not found then raise exception 'not found: review state'; end if;
  select * into v_prior from public.review_logs
  where user_id = v_user and client_review_id = p_client_review_id;
  if found then
    if v_prior.card_id <> p_card_id or v_prior.rating <> p_rating then
      raise exception 'review id already used for another rating';
    end if;
    return jsonb_build_object('status', 'duplicate', 'card_id', p_card_id,
      'version', v_state.version);
  end if;
  if v_state.version <> p_expected_version then raise exception 'stale review state'; end if;

  -- Reject malformed or unrelated state changes before updating the locked row.
  begin
    v_next_state := p_next_state ->> 'state';
    v_due := (p_next_state ->> 'due_at')::timestamptz;
    v_reps := (p_next_state ->> 'reps')::integer;
    v_lapses := (p_next_state ->> 'lapses')::integer;
    v_next_version := (p_next_state ->> 'version')::integer;
    perform (p_log ->> 'elapsed_days')::real;
    perform (p_log ->> 'scheduled_days')::real;
  exception when invalid_text_representation or datetime_field_overflow or numeric_value_out_of_range then
    raise exception 'invalid review state';
  end;
  if v_next_state is null or v_next_state not in ('learning', 'review', 'relearning')
    or v_due is null or not isfinite(v_due)
    or v_reps is null or v_reps <> v_state.reps + 1
    or v_lapses is null or v_lapses < v_state.lapses
    or v_next_version is distinct from v_state.version + 1
    or jsonb_typeof(p_next_state -> 'fsrs') is distinct from 'object'
    or p_next_state -> 'fsrs' ->> 'model_version' is distinct from 'FSRS-6'
    or jsonb_typeof(p_log -> 'elapsed_days') is distinct from 'number'
    or jsonb_typeof(p_log -> 'scheduled_days') is distinct from 'number'
  then raise exception 'invalid review state'; end if;

  if v_state.state = 'new' then
    select new_cards_per_day into v_quota from public.profiles
    where id = v_user for update;
    if not found then raise exception 'not found: profile'; end if;
    select count(*) into v_new_today from public.review_logs
    where user_id = v_user and was_new
      and reviewed_at >= (v_day::timestamp at time zone 'Asia/Ho_Chi_Minh')
      and reviewed_at < ((v_day + 1)::timestamp at time zone 'Asia/Ho_Chi_Minh');
    if v_new_today >= v_quota then raise exception 'new card limit reached'; end if;
  end if;

  update public.review_states set
    state = v_next_state, fsrs = p_next_state -> 'fsrs', due_at = v_due,
    reps = v_reps, lapses = v_lapses, last_review_at = now(),
    version = v_state.version + 1
  where user_id = v_user and card_id = p_card_id;
  insert into public.review_logs
    (user_id, card_id, rating, client_review_id, elapsed_days, scheduled_days, was_new)
  values (v_user, p_card_id, p_rating, p_client_review_id,
    (p_log ->> 'elapsed_days')::real, (p_log ->> 'scheduled_days')::real,
    v_state.state = 'new');
  insert into public.user_daily_activity (user_id, day, reviews)
  values (v_user, v_day, 1)
  on conflict (user_id, day) do update
    set reviews = public.user_daily_activity.reviews + 1;
  return jsonb_build_object('status', 'applied', 'card_id', p_card_id,
    'version', v_state.version + 1);
end $$;

create or replace function public.start_study_session(p_user_id uuid, p_set_id uuid, p_mode text)
returns uuid language plpgsql security invoker set search_path = '' as $$
declare
  v_user uuid := p_user_id;
  v_session uuid;
begin
  if v_user is null or not exists (select 1 from public.profiles where id = v_user)
  then raise exception 'not allowed: user not found'; end if;
  if p_mode is null or p_mode not in ('learn', 'quiz', 'dictation', 'writing', 'game')
  then raise exception 'invalid study mode'; end if;
  if p_set_id is null or not exists (
    select 1 from public.study_sets s where s.id = p_set_id
      and (s.owner_id = v_user or s.visibility in ('public', 'unlisted'))
  ) then raise exception 'not allowed: set not found'; end if;
  insert into public.study_sessions (user_id, set_id, mode)
  values (v_user, p_set_id, p_mode) returning id into v_session;
  return v_session;
end $$;

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
      (v_session.mode = 'learn' and v_type in ('multiple_choice', 'learn_type')) or
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

revoke all on function public.enroll_set_cards(uuid, uuid) from public, anon, authenticated;
revoke all on function public.commit_review(uuid, uuid, uuid, smallint, integer, jsonb, jsonb)
  from public, anon, authenticated;
revoke all on function public.start_study_session(uuid, uuid, text) from public, anon, authenticated;
revoke all on function public.finish_study_session(uuid, uuid, jsonb, integer, integer)
  from public, anon, authenticated;
grant execute on function public.enroll_set_cards(uuid, uuid) to service_role;
grant execute on function public.commit_review(uuid, uuid, uuid, smallint, integer, jsonb, jsonb)
  to service_role;
grant execute on function public.start_study_session(uuid, uuid, text) to service_role;
grant execute on function public.finish_study_session(uuid, uuid, jsonb, integer, integer)
  to service_role;
