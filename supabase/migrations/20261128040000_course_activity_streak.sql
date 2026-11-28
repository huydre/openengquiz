create or replace function public.sync_streak()
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

  -- Merge dates, not counts: course completions earn their own XP.
  select coalesce(array_agg(a.day order by a.day), '{}') into v_active
  from (
    select d.day from public.user_daily_activity d
    where d.user_id = v_user and (d.reviews > 0 or d.studied > 0)
    union
    select (p.completed_at at time zone 'Asia/Ho_Chi_Minh')::date
    from public.course_activity_progress p
    where p.user_id = v_user and p.completed_at is not null
  ) a
  where a.day <= v_today;

  -- ponytail: replay one date per active day. Add a checkpoint only if long histories make sync slow.
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
