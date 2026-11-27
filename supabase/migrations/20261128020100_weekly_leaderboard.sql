-- Weekly leaderboard.
--
-- XP formula (documented in src/lib/gamification/weekly-xp.ts):
--   1 XP per SRS review or finished study session
--         (user_daily_activity.reviews + user_daily_activity.studied;
--          `studied` counts sessions, not cards)
--   10 XP per completed course activity
--         (course_activity_progress rows with completed_at not null;
--          includes synthetic legacy backfill rows, which count as valid)
--   5 XP per speaking attempt (speaking_attempts rows)
-- Weeks run Monday 00:00 Asia/Ho_Chi_Minh to next Monday 00:00.
--
-- Privacy: profiles.show_on_leaderboard gates peer visibility only. Ranks are
-- computed over visible peers plus the caller, so a private user's rank never
-- reveals how many hidden peers exist. The caller always sees their own XP and
-- rank (or rank null with their XP when they have none). Names come from
-- display_name sanitized against email-shaped values, else "Người học" + last
-- 4 id characters; email is never returned.

alter table public.profiles
  add column show_on_leaderboard boolean not null default true;

-- Column-level update grant so the visibility action can write only this flag.
-- SELECT on show_on_leaderboard stays ungranted: peers must not read it, and the
-- caller reads their own value through my_leaderboard_visibility() below.
grant update (show_on_leaderboard) on public.profiles to authenticated;

-- Display name for leaderboard rows. Sanitizes email-shaped display names
-- (local@domain) to the generic fallback so an address can never leak through
-- the leaderboard. Never returns email or any other profile field.
create or replace function public.leaderboard_display_name(p_user_id uuid)
returns text language sql stable security definer set search_path = '' as $$
  select case
    when nullif(btrim(pr.display_name), '') is not null
         and btrim(pr.display_name) !~ '@'
      then btrim(pr.display_name)
    else 'Người học ' || right(p_user_id::text, 4)
  end
  from public.profiles pr
  where pr.id = p_user_id
$$;
revoke all on function public.leaderboard_display_name(uuid) from public, anon, authenticated;

-- Caller's own leaderboard visibility flag (column itself is not selectable).
create or replace function public.my_leaderboard_visibility()
returns boolean language sql stable security definer set search_path = '' as $$
  select coalesce((select pr.show_on_leaderboard from public.profiles pr where pr.id = auth.uid()), true)
$$;
revoke all on function public.my_leaderboard_visibility() from public, anon;
grant execute on function public.my_leaderboard_visibility() to authenticated;

-- Weekly leaderboard. Ranks cover visible peers only (show_on_leaderboard), so a
-- hidden caller's rank equals 1 + the number of visible peers ahead of them and
-- never reveals hidden peers. The caller's own row is appended to entries when it
-- falls outside the top N or when the caller is hidden. Only users with XP > 0
-- are ranked.
create or replace function public.weekly_leaderboard(p_limit integer default 20)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  v_user uuid := auth.uid();
  v_week_start date;
  v_week_end date;
  v_week_start_ts timestamptz;
  v_week_end_ts timestamptz;
  v_limit integer := greatest(1, least(coalesce(p_limit, 20), 100));
  v_entries jsonb;
  v_me jsonb;
  v_me_xp bigint;
  v_me_rank integer;
begin
  if v_user is null then raise exception 'not authenticated'; end if;

  -- Monday 00:00 Asia/Ho_Chi_Minh. date_trunc on the VN-local timestamp gives the
  -- Monday of the current VN week regardless of when the request crosses midnight.
  v_week_start := date_trunc('week', now() at time zone 'Asia/Ho_Chi_Minh')::date;
  v_week_end := v_week_start + 7;
  -- timestamptz bounds keep per-row comparisons index-friendly.
  v_week_start_ts := v_week_start::timestamp at time zone 'Asia/Ho_Chi_Minh';
  v_week_end_ts := v_week_end::timestamp at time zone 'Asia/Ho_Chi_Minh';

  with activity as (
    select a.user_id,
           coalesce(sum(a.reviews + a.studied), 0)::bigint as xp
    from public.user_daily_activity a
    where a.day >= v_week_start and a.day < v_week_end
    group by a.user_id
  ), course_xp as (
    select p.user_id, count(*)::bigint * 10 as xp
    from public.course_activity_progress p
    where p.completed_at is not null
      and p.completed_at >= v_week_start_ts and p.completed_at < v_week_end_ts
    group by p.user_id
  ), speaking_xp as (
    select s.user_id, count(*)::bigint * 5 as xp
    from public.speaking_attempts s
    where s.created_at >= v_week_start_ts and s.created_at < v_week_end_ts
    group by s.user_id
  ), totals as (
    select user_id, sum(xp) as xp from (
      select user_id, xp from activity
      union all select user_id, xp from course_xp
      union all select user_id, xp from speaking_xp
    ) parts
    group by user_id
    having sum(xp) > 0
  ), visible as (
    -- Peers the caller may see. Hidden users are excluded so their existence and
    -- count never leak; the caller's own rank is derived from visible peers only.
    select t.user_id, t.xp
    from totals t
    join public.profiles pr on pr.id = t.user_id
    where pr.show_on_leaderboard
  ), ranked as (
    select v.user_id, v.xp,
           row_number() over (order by v.xp desc, v.user_id) as rank
    from visible v
  )
  select
    coalesce((
      select jsonb_agg(jsonb_build_object(
        'rank', e.rank, 'name', public.leaderboard_display_name(e.user_id),
        'xp', e.xp, 'is_me', e.user_id = v_user
      ) order by e.rank)
      from (select * from ranked order by rank limit v_limit) e
    ), '[]'::jsonb),
    (select t.xp from totals t where t.user_id = v_user),
    (select 1 + count(*)
     from visible v
     join totals me on me.user_id = v_user
     where v.xp > me.xp or (v.xp = me.xp and v.user_id < v_user))
  into v_entries, v_me_xp, v_me_rank;

  if v_me_xp is null then
    v_me := jsonb_build_object('rank', null, 'xp', 0);
  else
    v_me := jsonb_build_object('rank', v_me_rank, 'xp', v_me_xp);

    -- Append the caller's own row when hidden or outside the top N.
    if not exists (
      select 1 from jsonb_array_elements(v_entries) e
      where (e ->> 'is_me')::boolean
    ) then
      v_entries := v_entries || jsonb_build_object(
        'rank', v_me_rank,
        'name', public.leaderboard_display_name(v_user),
        'xp', v_me_xp,
        'is_me', true
      );
    end if;
  end if;

  return jsonb_build_object(
    'week_start', v_week_start,
    'week_end', v_week_end,
    'entries', v_entries,
    'me', v_me
  );
end $$;

revoke all on function public.weekly_leaderboard(integer) from public, anon;
grant execute on function public.weekly_leaderboard(integer) to authenticated;

-- Speaking attempts feed the leaderboard, so clients must not insert them
-- directly (XP would be forgeable). The only legitimate writer,
-- src/app/api/speaking/assess/route.ts, now uses the service-role admin client.
-- Course-activity RPCs already write via security definer / service role.
drop policy if exists "speaking attempts insertable by owner" on public.speaking_attempts;
revoke insert on public.speaking_attempts from public, anon, authenticated;
grant insert on public.speaking_attempts to service_role;
