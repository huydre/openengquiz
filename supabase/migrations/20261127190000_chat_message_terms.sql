-- Per-turn vocabulary chips for AI Call: assistant messages carry the terms the
-- model suggested for the learner's next reply, validated server-side against
-- the set's card terms. Stored on chat_messages so chips survive resume.

alter table public.chat_messages
  add column suggested_terms text[];

comment on column public.chat_messages.suggested_terms is
  'Vocabulary chips suggested for the learner''s next reply (assistant messages only).';

-- Same signatures plus a terms array; old overloads are dropped so PostgREST
-- never sees ambiguous candidates.
drop function public.start_ai_call(uuid, text);
drop function public.append_ai_call_turn(uuid, int, text, text);

create function public.start_ai_call(p_thread_id uuid, p_assistant_text text, p_terms text[] default null)
returns boolean language plpgsql security definer set search_path = '' as $$
begin
  perform 1 from public.chat_threads where id = p_thread_id and user_id = (select auth.uid()) and summary is null for update;
  if not found or exists (select 1 from public.chat_messages where thread_id = p_thread_id) then return false; end if;
  insert into public.chat_messages(thread_id, role, content, suggested_terms)
  values (p_thread_id, 'assistant', p_assistant_text,
    coalesce((select array_agg(t) from (select t from unnest(coalesce(p_terms, '{}'::text[])) as t
      where char_length(t) between 1 and 200 limit 8) s), '{}'::text[]));
  return true;
end;
$$;
revoke all on function public.start_ai_call(uuid, text, text[]) from public, anon;
grant execute on function public.start_ai_call(uuid, text, text[]) to authenticated;

-- Serialize turns and reject replies generated from stale conversation context.
create function public.append_ai_call_turn(p_thread_id uuid, p_expected_turns int, p_user_text text, p_assistant_text text, p_terms text[] default null)
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
  insert into public.chat_messages(thread_id, role, content, created_at, suggested_terms) values
    (p_thread_id, 'user', p_user_text, at_time, null),
    (p_thread_id, 'assistant', p_assistant_text, at_time + interval '1 microsecond',
      coalesce((select array_agg(t) from (select t from unnest(coalesce(p_terms, '{}'::text[])) as t
        where char_length(t) between 1 and 200 limit 8) s), '{}'::text[]));
  return true;
end;
$$;
revoke all on function public.append_ai_call_turn(uuid, int, text, text, text[]) from public, anon;
grant execute on function public.append_ai_call_turn(uuid, int, text, text, text[]) to authenticated;
