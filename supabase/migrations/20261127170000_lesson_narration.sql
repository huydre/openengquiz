CREATE TABLE public.lesson_narration (
  lesson_id uuid not null references public.course_lessons on delete cascade,
  kind text not null check (kind in ('intro', 'transition', 'retry')),
  lines jsonb not null check (jsonb_typeof(lines) = 'array'),
  generated_at timestamptz not null default now(),
  primary key (lesson_id, kind)
);

alter table public.lesson_narration enable row level security;
revoke all on public.lesson_narration from public, anon, authenticated;
grant select on public.lesson_narration to authenticated;
grant all on public.lesson_narration to service_role;

create policy "signed in reads narration" on public.lesson_narration
  for select to authenticated using (true);