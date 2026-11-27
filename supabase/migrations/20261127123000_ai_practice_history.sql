create table public.grammar_attempts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  set_id uuid not null references public.study_sets(id) on delete cascade,
  mode text not null check (char_length(mode) between 1 and 30),
  prompt text not null check (char_length(prompt) between 1 and 2000),
  reference text not null check (char_length(reference) between 1 and 2000),
  answer text not null check (char_length(answer) between 1 and 2000),
  score integer not null check (score between 0 and 100),
  feedback jsonb not null check (jsonb_typeof(feedback) = 'object'),
  created_at timestamptz not null default now()
);
create index grammar_attempts_recent_idx on public.grammar_attempts(user_id, created_at desc);

create table public.reading_passages (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  set_id uuid not null references public.study_sets(id) on delete cascade,
  level text not null check (level in ('A1','A2','B1','B2','C1','C2')),
  content text not null check (char_length(content) between 1 and 12000),
  questions jsonb not null check (jsonb_typeof(questions) = 'array'),
  target_terms jsonb not null check (jsonb_typeof(target_terms) = 'array'),
  shared boolean not null default false,
  created_at timestamptz not null default now()
);
create index reading_passages_recent_idx on public.reading_passages(user_id, created_at desc);
create index reading_passages_cache_idx on public.reading_passages(set_id, level, created_at desc);

create table public.chat_threads (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  set_id uuid not null references public.study_sets(id) on delete cascade,
  scenario text not null check (char_length(scenario) between 1 and 100),
  summary jsonb check (jsonb_typeof(summary) = 'object'),
  created_at timestamptz not null default now()
);
create index chat_threads_recent_idx on public.chat_threads(user_id, created_at desc);

create table public.chat_messages (
  id uuid primary key default gen_random_uuid(),
  thread_id uuid not null references public.chat_threads(id) on delete cascade,
  role text not null check (role in ('user','assistant')),
  content text not null check (char_length(content) between 1 and 4000),
  created_at timestamptz not null default now()
);
create index chat_messages_thread_idx on public.chat_messages(thread_id, created_at, id);

alter table public.grammar_attempts enable row level security;
alter table public.reading_passages enable row level security;
alter table public.chat_threads enable row level security;
alter table public.chat_messages enable row level security;
revoke all on public.grammar_attempts, public.reading_passages, public.chat_threads, public.chat_messages from public, anon, authenticated;
grant select, insert on public.grammar_attempts, public.reading_passages, public.chat_threads to authenticated;
grant select on public.chat_messages to authenticated;
grant all on public.grammar_attempts, public.reading_passages, public.chat_threads, public.chat_messages to service_role;

create policy "grammar owner reads" on public.grammar_attempts for select to authenticated using (user_id = (select auth.uid()));
create policy "grammar owner appends" on public.grammar_attempts for insert to authenticated with check (
  user_id = (select auth.uid()) and exists (select 1 from public.study_sets s where s.id = set_id)
);
create policy "reading owner or shared reads" on public.reading_passages for select to authenticated using (
  user_id = (select auth.uid()) or (shared and exists (select 1 from public.study_sets s where s.id = set_id and s.visibility = 'public'))
);
create policy "reading owner appends" on public.reading_passages for insert to authenticated with check (
  not shared and user_id = (select auth.uid()) and exists (select 1 from public.study_sets s where s.id = set_id)
);
create policy "chat owner reads" on public.chat_threads for select to authenticated using (user_id = (select auth.uid()));
create policy "chat owner starts" on public.chat_threads for insert to authenticated with check (
  summary is null and user_id = (select auth.uid()) and exists (select 1 from public.study_sets s where s.id = set_id)
);
create policy "chat owner reads messages" on public.chat_messages for select to authenticated using (
  exists (select 1 from public.chat_threads t where t.id = thread_id and t.user_id = (select auth.uid()))
);

create function public.start_ai_call(p_thread_id uuid, p_assistant_text text)
returns boolean language plpgsql security definer set search_path = '' as $$
begin
  perform 1 from public.chat_threads where id = p_thread_id and user_id = (select auth.uid()) and summary is null for update;
  if not found or exists (select 1 from public.chat_messages where thread_id = p_thread_id) then return false; end if;
  insert into public.chat_messages(thread_id, role, content) values (p_thread_id, 'assistant', p_assistant_text);
  return true;
end;
$$;
revoke all on function public.start_ai_call(uuid, text) from public, anon;
grant execute on function public.start_ai_call(uuid, text) to authenticated;

-- Serialize turns and reject replies generated from stale conversation context.
create function public.append_ai_call_turn(p_thread_id uuid, p_expected_turns int, p_user_text text, p_assistant_text text)
returns boolean language plpgsql security definer set search_path = '' as $$
declare
  turns integer;
  at_time timestamptz;
begin
  perform 1 from public.chat_threads where id = p_thread_id and user_id = (select auth.uid()) and summary is null for update;
  if not found then return false; end if;
  select count(*) filter (where role = 'user'), greatest(clock_timestamp(), max(created_at) + interval '1 microsecond')
    into turns, at_time from public.chat_messages where thread_id = p_thread_id;
  if turns is distinct from p_expected_turns or turns >= 15 then return false; end if;
  insert into public.chat_messages(thread_id, role, content, created_at) values
    (p_thread_id, 'user', p_user_text, at_time),
    (p_thread_id, 'assistant', p_assistant_text, at_time + interval '1 microsecond');
  return true;
end;
$$;
revoke all on function public.append_ai_call_turn(uuid, int, text, text) from public, anon;
grant execute on function public.append_ai_call_turn(uuid, int, text, text) to authenticated;

create function public.finish_ai_call(p_thread_id uuid, p_expected_turns int, p_summary jsonb)
returns boolean language plpgsql security definer set search_path = '' as $$
declare
  turns integer;
begin
  perform 1 from public.chat_threads where id = p_thread_id and user_id = (select auth.uid()) and summary is null for update;
  if not found then return false; end if;
  select count(*) into turns from public.chat_messages where thread_id = p_thread_id and role = 'user';
  if turns = 0 or turns is distinct from p_expected_turns or jsonb_typeof(p_summary) is distinct from 'object' then return false; end if;
  update public.chat_threads set summary = p_summary where id = p_thread_id;
  return true;
end;
$$;
revoke all on function public.finish_ai_call(uuid, int, jsonb) from public, anon;
grant execute on function public.finish_ai_call(uuid, int, jsonb) to authenticated;
