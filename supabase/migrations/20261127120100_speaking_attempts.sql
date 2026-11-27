create table public.speaking_attempts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  card_id uuid references public.cards (id) on delete set null,
  mode text not null check (mode in ('scripted', 'speaking')),
  prompt_text text not null check (char_length(prompt_text) between 1 and 2000),
  transcript text not null check (char_length(transcript) between 1 and 2000),
  pron jsonb not null check (jsonb_typeof(pron) = 'object'),
  feedback jsonb check (jsonb_typeof(feedback) = 'object'),
  created_at timestamptz not null default now()
);

create index speaking_attempts_user_created_idx on public.speaking_attempts (user_id, created_at desc);
create index speaking_attempts_card_idx on public.speaking_attempts (card_id) where card_id is not null;

alter table public.speaking_attempts enable row level security;
revoke all on public.speaking_attempts from anon, authenticated;
grant select, insert on public.speaking_attempts to authenticated;

create policy "speaking attempts readable by owner" on public.speaking_attempts
  for select to authenticated using (user_id = (select auth.uid()));

create policy "speaking attempts insertable by owner" on public.speaking_attempts
  for insert to authenticated with check (
    user_id = (select auth.uid())
    and (card_id is null or exists (select 1 from public.cards where id = card_id))
  );
