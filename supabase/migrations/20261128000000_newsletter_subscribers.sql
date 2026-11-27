-- Emails collected by the landing page newsletter form. RLS is on with no policies, so only the
-- service role (the server action) can read or write; visitors never see the list.
create table public.newsletter_subscribers (
  id uuid primary key default gen_random_uuid(),
  email text not null unique check (length(email) <= 254 and email ~* '^[^@[:space:]]+@[^@[:space:]]+\.[^@[:space:]]+$'),
  created_at timestamptz not null default now()
);

alter table public.newsletter_subscribers enable row level security;
