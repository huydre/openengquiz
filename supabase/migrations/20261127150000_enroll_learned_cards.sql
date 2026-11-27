-- Adds specific cards (just learned in the vocabulary lesson) to the learner's review queue.
-- Same rules as enroll_set_cards: server-only (service role), the learner must be able to read the set.
create or replace function public.enroll_cards(p_user_id uuid, p_card_ids uuid[])
returns integer language plpgsql security invoker set search_path = '' as $$
declare
  v_added integer;
begin
  if p_user_id is null or not exists (select 1 from public.profiles where id = p_user_id)
  then raise exception 'not allowed: user not found'; end if;
  if p_card_ids is null or cardinality(p_card_ids) not between 1 and 200
  then raise exception 'invalid card list'; end if;

  insert into public.review_states (user_id, card_id)
  select p_user_id, c.id
  from public.cards c
  join public.study_sets s on s.id = c.set_id
  where c.id = any (p_card_ids)
    and (s.owner_id = p_user_id or s.visibility in ('public', 'unlisted'))
  on conflict (user_id, card_id) do nothing;
  get diagnostics v_added = row_count;
  return v_added;
end $$;

revoke all on function public.enroll_cards(uuid, uuid[]) from public, anon, authenticated;
grant execute on function public.enroll_cards(uuid, uuid[]) to service_role;
