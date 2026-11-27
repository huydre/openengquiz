create table public.feedback_reports (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references public.profiles(id) on delete set null,
  page text not null check (char_length(page) between 1 and 500 and page ~ '^/[^/]?' and page !~ '[[:cntrl:]?#]'),
  message text not null check (char_length(btrim(message)) between 1 and 2000 and char_length(message) <= 2000),
  created_at timestamptz not null default now()
);
create index feedback_reports_owner_time_idx on public.feedback_reports(user_id, created_at);
alter table public.feedback_reports enable row level security;
revoke all on public.feedback_reports from public, anon, authenticated;
grant insert (user_id, page, message) on public.feedback_reports to authenticated;
grant all on public.feedback_reports to service_role;
create policy "owner submits feedback" on public.feedback_reports for insert to authenticated
  with check (user_id = (select auth.uid()));

create function public.limit_daily_feedback()
returns trigger language plpgsql security definer set search_path = '' as $$
declare
  day_start timestamptz := date_trunc('day', statement_timestamp(), 'Asia/Ho_Chi_Minh');
begin
  -- Do not lock or count for a forged owner, even before RLS rejects that row.
  if new.user_id is null or new.user_id is distinct from (select auth.uid()) then return new; end if;
  perform pg_advisory_xact_lock(hashtextextended('feedback:' || new.user_id::text, 0));
  if (select count(*) from public.feedback_reports
      where user_id = new.user_id and created_at >= day_start and created_at < day_start + interval '24 hours') >= 10 then
    raise sqlstate 'PT429' using message = 'Daily feedback limit reached';
  end if;
  new.created_at := statement_timestamp();
  return new;
end;
$$;
revoke all on function public.limit_daily_feedback() from public, anon, authenticated;
create trigger feedback_reports_daily_limit before insert on public.feedback_reports
  for each row execute function public.limit_daily_feedback();
