alter table public.profiles
  add column streak_freezes integer not null default 0 check (streak_freezes between 0 and 2),
  add column streak_rewarded_through date;

-- Preserve access to existing columns without exposing or allowing writes to streak state.
revoke select, update on public.profiles from public, anon, authenticated;
grant select (id, display_name, avatar_url, goal, level, created_at, updated_at,
  new_cards_per_day, feedback_tone) on public.profiles to authenticated;
grant update (id, display_name, avatar_url, goal, level, created_at, updated_at,
  new_cards_per_day, feedback_tone) on public.profiles to authenticated;

create table public.streak_freeze_days (
  user_id uuid not null references public.profiles (id) on delete cascade,
  day date not null,
  primary key (user_id, day)
);
alter table public.streak_freeze_days enable row level security;
revoke all on public.streak_freeze_days from public, anon, authenticated, service_role;
grant select on public.streak_freeze_days to authenticated;
create policy "owner reads streak freeze days" on public.streak_freeze_days
  for select to authenticated using (user_id = (select auth.uid()));

create function public.sync_streak()
returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  v_user uuid := auth.uid();
  v_today date := (now() at time zone 'Asia/Ho_Chi_Minh')::date;
  v_day date;
  v_last date;
  v_rewarded_through date;
  v_missing integer;
  v_next integer;
  v_streak integer := 0;
  v_freezes integer := 0;
  v_active date[];
  v_frozen date[] := '{}';
begin
  if v_user is null then raise exception 'not authenticated' using errcode = '42501'; end if;
  perform 1 from public.profiles where id = v_user for update;
  if not found then raise exception 'profile not found'; end if;

  select coalesce(array_agg(a.day order by a.day), '{}') into v_active
  from public.user_daily_activity a
  where a.user_id = v_user and a.day <= v_today and (a.reviews > 0 or a.studied > 0);

  -- ponytail: replay one daily row per active day. Add a checkpoint only if long histories make sync slow.
  -- Replace derived state instead of incrementing it; a milestone can never be credited twice.
  foreach v_day in array v_active loop
    v_missing := coalesce(v_day - v_last - 1, 0);
    if v_missing > v_freezes then
      v_streak := 0;
      v_missing := 0;
    elsif v_missing > 0 then
      v_frozen := v_frozen || array(select v_last + i from generate_series(1, v_missing) as i);
      v_freezes := v_freezes - v_missing;
    end if;
    v_next := v_streak + v_missing + 1;
    if v_next / 7 > v_streak / 7 then
      v_rewarded_through := v_day - v_next % 7;
      v_freezes := least(2, v_freezes + v_next / 7 - v_streak / 7);
    end if;
    v_streak := v_next;
    v_last := v_day;
  end loop;

  -- Today is still available. A trailing gap is provisional until the next active day.
  v_missing := greatest(0, v_today - v_last - 1);
  if v_missing > v_freezes then
    v_streak := 0;
  elsif v_missing > 0 then
    v_frozen := v_frozen || array(select v_last + i from generate_series(1, v_missing) as i);
    v_freezes := v_freezes - v_missing;
    v_next := v_streak + v_missing;
    if v_next / 7 > v_streak / 7 then
      v_rewarded_through := v_today - 1 - v_next % 7;
      v_freezes := least(2, v_freezes + v_next / 7 - v_streak / 7);
    end if;
    v_streak := v_next;
  end if;

  delete from public.streak_freeze_days d where d.user_id = v_user and not (d.day = any(v_frozen));
  insert into public.streak_freeze_days (user_id, day)
  select v_user, day from unnest(v_frozen) as day on conflict do nothing;
  update public.profiles p set streak_freezes = v_freezes, streak_rewarded_through = v_rewarded_through
  where p.id = v_user and (p.streak_freezes, p.streak_rewarded_through)
    is distinct from (v_freezes, v_rewarded_through);

  return jsonb_build_object('streak', v_streak, 'freezes', v_freezes,
    'frozen_days', v_frozen, 'active_days', v_active);
end;
$$;
revoke all on function public.sync_streak() from public, anon, authenticated;
grant execute on function public.sync_streak() to authenticated;
