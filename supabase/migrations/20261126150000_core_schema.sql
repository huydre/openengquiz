-- Core schema: profiles, vocabulary (study sets + cards), per-user review state, study history, AI usage.
-- Shared knowledge (cards) is separate from per-user memory state (review_states).

create extension if not exists pgcrypto;

-- ───────────────────────── helpers ─────────────────────────
create or replace function public.set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end $$;

-- ───────────────────────── profiles ─────────────────────────
create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  display_name text,
  avatar_url text,
  goal text check (goal in ('ielts', 'toeic', 'thpt', 'communication', 'work')),
  level text check (level in ('A1', 'A2', 'B1', 'B2', 'C1', 'C2')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create trigger profiles_updated_at before update on public.profiles
  for each row execute function public.set_updated_at();

-- Create a profile row for every new auth user.
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  insert into public.profiles (id, display_name, avatar_url)
  values (
    new.id,
    coalesce(new.raw_user_meta_data ->> 'full_name', split_part(new.email, '@', 1)),
    new.raw_user_meta_data ->> 'avatar_url'
  );
  return new;
end $$;
create trigger on_auth_user_created after insert on auth.users
  for each row execute function public.handle_new_user();

-- ───────────────────────── vocabulary ─────────────────────────
create table public.study_sets (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references public.profiles (id) on delete cascade,
  title text not null check (char_length(title) between 1 and 200),
  description text,
  visibility text not null default 'private' check (visibility in ('private', 'unlisted', 'public')),
  tags text[] not null default '{}',
  cover_url text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index study_sets_owner_idx on public.study_sets (owner_id);
create index study_sets_public_idx on public.study_sets (visibility) where visibility = 'public';
create trigger study_sets_updated_at before update on public.study_sets
  for each row execute function public.set_updated_at();

create table public.cards (
  id uuid primary key default gen_random_uuid(),
  set_id uuid not null references public.study_sets (id) on delete cascade,
  position int not null default 0,
  term text not null check (char_length(term) between 1 and 200),
  part_of_speech text,
  ipa text,
  definition_vi text,
  definition_en text,
  example_en text,
  example_vi text,
  synonyms text[] not null default '{}',
  image_url text,
  audio_url text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index cards_set_position_idx on public.cards (set_id, position);
create trigger cards_updated_at before update on public.cards
  for each row execute function public.set_updated_at();

create table public.folders (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references public.profiles (id) on delete cascade,
  name text not null check (char_length(name) between 1 and 100),
  created_at timestamptz not null default now()
);
create index folders_owner_idx on public.folders (owner_id);

create table public.folder_sets (
  folder_id uuid not null references public.folders (id) on delete cascade,
  set_id uuid not null references public.study_sets (id) on delete cascade,
  primary key (folder_id, set_id)
);

-- Shared dictionary cache (lookup results, TTS URLs). Written only by the server with the secret key.
create table public.word_cache (
  term text primary key,
  data jsonb not null,
  updated_at timestamptz not null default now()
);

-- ───────────────────────── spaced repetition ─────────────────────────
create table public.review_states (
  user_id uuid not null references public.profiles (id) on delete cascade,
  card_id uuid not null references public.cards (id) on delete cascade,
  state text not null default 'new' check (state in ('new', 'learning', 'review', 'relearning')),
  fsrs jsonb not null default '{}',
  due_at timestamptz not null default now(),
  reps int not null default 0,
  lapses int not null default 0,
  last_review_at timestamptz,
  primary key (user_id, card_id)
);
create index review_states_due_idx on public.review_states (user_id, due_at);

create table public.review_logs (
  id bigint generated always as identity primary key,
  user_id uuid not null references public.profiles (id) on delete cascade,
  card_id uuid not null references public.cards (id) on delete cascade,
  rating smallint not null check (rating between 1 and 4), -- 1 Again, 2 Hard, 3 Good, 4 Easy
  client_review_id uuid not null,
  elapsed_days real,
  scheduled_days real,
  reviewed_at timestamptz not null default now(),
  unique (user_id, client_review_id) -- makes a double-submitted rating a no-op
);
create index review_logs_user_time_idx on public.review_logs (user_id, reviewed_at);

-- ───────────────────────── study history ─────────────────────────
create table public.study_sessions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  set_id uuid references public.study_sets (id) on delete set null,
  mode text not null check (mode in ('learn', 'quiz', 'dictation', 'writing', 'game', 'review',
                                     'speaking', 'grammar', 'reading', 'conversation')),
  score int,
  total int,
  started_at timestamptz not null default now(),
  finished_at timestamptz
);
create index study_sessions_user_idx on public.study_sessions (user_id, started_at desc);

create table public.study_attempts (
  id bigint generated always as identity primary key,
  session_id uuid not null references public.study_sessions (id) on delete cascade,
  card_id uuid references public.cards (id) on delete set null,
  question_type text not null,
  correct boolean not null,
  answer text,
  created_at timestamptz not null default now()
);
create index study_attempts_session_idx on public.study_attempts (session_id);

-- ───────────────────────── AI usage (quota + cost tracking) ─────────────────────────
create table public.ai_usage (
  id bigint generated always as identity primary key,
  user_id uuid not null references public.profiles (id) on delete cascade,
  feature text not null,
  units int not null default 1,
  cost_usd numeric(10, 6),
  created_at timestamptz not null default now()
);
create index ai_usage_quota_idx on public.ai_usage (user_id, feature, created_at);

-- ───────────────────────── row level security ─────────────────────────
alter table public.profiles enable row level security;
alter table public.study_sets enable row level security;
alter table public.cards enable row level security;
alter table public.folders enable row level security;
alter table public.folder_sets enable row level security;
alter table public.word_cache enable row level security;
alter table public.review_states enable row level security;
alter table public.review_logs enable row level security;
alter table public.study_sessions enable row level security;
alter table public.study_attempts enable row level security;
alter table public.ai_usage enable row level security;

-- profiles: anyone signed in can see names/avatars (for shared sets, classes); only self can edit.
create policy "profiles readable by signed-in users" on public.profiles
  for select to authenticated using (true);
create policy "profiles updatable by self" on public.profiles
  for update to authenticated using (id = (select auth.uid())) with check (id = (select auth.uid()));

-- study_sets: owner full access; public/unlisted readable by anyone (link sharing, SEO).
create policy "sets readable if owned or shared" on public.study_sets
  for select to anon, authenticated
  using (visibility in ('public', 'unlisted') or owner_id = (select auth.uid()));
create policy "sets insertable by owner" on public.study_sets
  for insert to authenticated with check (owner_id = (select auth.uid()));
create policy "sets updatable by owner" on public.study_sets
  for update to authenticated
  using (owner_id = (select auth.uid())) with check (owner_id = (select auth.uid()));
create policy "sets deletable by owner" on public.study_sets
  for delete to authenticated using (owner_id = (select auth.uid()));

-- cards: follow the parent set.
create policy "cards readable with set" on public.cards
  for select to anon, authenticated
  using (exists (
    select 1 from public.study_sets s
    where s.id = set_id and (s.visibility in ('public', 'unlisted') or s.owner_id = (select auth.uid()))
  ));
create policy "cards writable by set owner" on public.cards
  for all to authenticated
  using (exists (select 1 from public.study_sets s where s.id = set_id and s.owner_id = (select auth.uid())))
  with check (exists (select 1 from public.study_sets s where s.id = set_id and s.owner_id = (select auth.uid())));

-- folders: owner only.
create policy "folders owned" on public.folders
  for all to authenticated
  using (owner_id = (select auth.uid())) with check (owner_id = (select auth.uid()));
create policy "folder_sets owned" on public.folder_sets
  for all to authenticated
  using (exists (select 1 from public.folders f where f.id = folder_id and f.owner_id = (select auth.uid())))
  with check (exists (select 1 from public.folders f where f.id = folder_id and f.owner_id = (select auth.uid())));

-- word_cache: read-only for clients; no write policy (server writes with the secret key, bypassing RLS).
create policy "word_cache readable" on public.word_cache
  for select to anon, authenticated using (true);

-- per-user learning data: self only.
create policy "review_states owned" on public.review_states
  for all to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
create policy "review_logs readable by self" on public.review_logs
  for select to authenticated using (user_id = (select auth.uid()));
create policy "review_logs insertable by self" on public.review_logs
  for insert to authenticated with check (user_id = (select auth.uid()));
create policy "study_sessions owned" on public.study_sessions
  for all to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
create policy "study_attempts owned via session" on public.study_attempts
  for all to authenticated
  using (exists (select 1 from public.study_sessions ss where ss.id = session_id and ss.user_id = (select auth.uid())))
  with check (exists (select 1 from public.study_sessions ss where ss.id = session_id and ss.user_id = (select auth.uid())));

-- ai_usage: users read and append their own rows; no update/delete so quotas cannot be reset.
create policy "ai_usage readable by self" on public.ai_usage
  for select to authenticated using (user_id = (select auth.uid()));
create policy "ai_usage insertable by self" on public.ai_usage
  for insert to authenticated with check (user_id = (select auth.uid()));
