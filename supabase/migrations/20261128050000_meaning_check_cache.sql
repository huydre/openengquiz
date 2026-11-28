create table public.meaning_check_cache (
  card_id uuid not null references public.cards(id) on delete cascade,
  answer_norm text not null,
  correct boolean not null,
  created_at timestamptz not null default now(),
  primary key (card_id, answer_norm)
);

alter table public.meaning_check_cache enable row level security;
revoke all on public.meaning_check_cache from public, anon, authenticated;
grant select, insert on public.meaning_check_cache to service_role;
