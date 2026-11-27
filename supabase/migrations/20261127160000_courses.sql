drop function public.seed_learning_path(uuid,text,text,text,text[],text,jsonb);
drop function public.publish_generated_path(uuid,jsonb);
drop function public.insert_path_sets(uuid,uuid,jsonb,int,int);
drop function public.create_learning_path(text,text,text[],text,text,uuid[]);
drop function public.path_progress(uuid);
drop table public.path_items;
drop table public.learning_paths;

create table public.courses (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,
  goal text not null,
  title text not null
);
create table public.course_levels (
  id uuid primary key default gen_random_uuid(),
  course_id uuid not null references public.courses on delete cascade,
  slug text not null,
  position int not null check (position >= 0),
  title text not null,
  cefr text not null check (cefr in ('A1','A2','B1','B2','C1','C2')),
  words_target int not null check (words_target > 0),
  summary text not null,
  entry text not null,
  outcome text not null,
  method text not null,
  unique (course_id, slug), unique (course_id, position)
);
create table public.course_parts (
  id uuid primary key default gen_random_uuid(),
  level_id uuid not null references public.course_levels on delete cascade,
  position int not null check (position >= 0),
  title text not null,
  unique (level_id, position)
);
create table public.course_lessons (
  id uuid primary key default gen_random_uuid(),
  part_id uuid not null references public.course_parts on delete cascade,
  position int not null check (position >= 0),
  title text not null,
  icon text not null,
  warmup_question text not null,
  set_id uuid not null unique references public.study_sets,
  unique (part_id, position)
);
create table public.course_choices (
  user_id uuid not null references public.profiles on delete cascade,
  course_id uuid not null references public.courses on delete cascade,
  level_id uuid not null references public.course_levels on delete cascade,
  updated_at timestamptz not null default now(),
  primary key (user_id, course_id)
);
create table public.lesson_progress (
  user_id uuid not null references public.profiles on delete cascade,
  lesson_id uuid not null references public.course_lessons on delete cascade,
  step int not null check (step between 1 and 4),
  warmup_transcript text not null,
  comparison jsonb,
  completed_at timestamptz,
  primary key (user_id, lesson_id),
  check (completed_at is null or step = 4)
);

alter table public.speaking_attempts add column lesson_id uuid references public.course_lessons on delete set null;

alter table public.courses enable row level security;
alter table public.course_levels enable row level security;
alter table public.course_parts enable row level security;
alter table public.course_lessons enable row level security;
alter table public.course_choices enable row level security;
alter table public.lesson_progress enable row level security;
revoke all on public.courses, public.course_levels, public.course_parts, public.course_lessons, public.course_choices, public.lesson_progress from public, anon, authenticated;
grant select on public.courses, public.course_levels, public.course_parts, public.course_lessons, public.course_choices, public.lesson_progress to authenticated;
grant all on public.courses, public.course_levels, public.course_parts, public.course_lessons, public.course_choices, public.lesson_progress to service_role;
create policy "signed in reads courses" on public.courses for select to authenticated using (true);
create policy "signed in reads levels" on public.course_levels for select to authenticated using (true);
create policy "signed in reads parts" on public.course_parts for select to authenticated using (true);
create policy "signed in reads lessons" on public.course_lessons for select to authenticated using (true);
create policy "owner reads choice" on public.course_choices for select to authenticated using (user_id = (select auth.uid()));
create policy "owner reads progress" on public.lesson_progress for select to authenticated using (user_id = (select auth.uid()));

alter policy "chat owner starts" on public.chat_threads with check (
  summary is null and user_id = (select auth.uid())
  and exists (select 1 from public.study_sets s where s.id = set_id)
  and (scenario <> 'course' or exists (
    select 1 from public.course_lessons l join public.lesson_progress p on p.lesson_id = l.id
    where l.set_id = chat_threads.set_id and p.user_id = (select auth.uid()) and p.step = 4 and p.completed_at is null
  ))
);

-- Publish an entire level atomically; a retry cannot duplicate sets or cards.
create function public.seed_course_level(p_owner uuid, p_course jsonb, p_level jsonb)
returns boolean language plpgsql set search_path = '' as $$
declare
  course_key uuid;
  level_key uuid;
  part_key uuid;
  set_key uuid;
  part jsonb;
  lesson jsonb;
  part_number int := 0;
  lesson_number int;
begin
  insert into public.courses(slug,goal,title) values (p_course->>'slug',p_course->>'goal',p_course->>'title')
    on conflict (slug) do nothing;
  select id into course_key from public.courses where slug = p_course->>'slug';
  perform pg_advisory_xact_lock(hashtextextended(course_key::text, 0));
  insert into public.course_levels(course_id,slug,position,title,cefr,words_target,summary,entry,outcome,method)
    values (course_key,p_level->>'slug',(p_level->>'position')::int,p_level->>'title',p_level->>'cefr',
      (p_level->>'words_target')::int,p_level->>'summary',p_level->>'entry',p_level->>'outcome',p_level->>'method')
    on conflict (course_id,slug) do nothing returning id into level_key;
  if level_key is null then return false; end if;
  -- Recheck against levels published while the seed was generating cards.
  if exists (
    select 1 from jsonb_array_elements(p_level->'parts') pp(value)
    cross join lateral jsonb_array_elements(pp.value->'lessons') ll(value)
    cross join lateral jsonb_array_elements(ll.value->'cards') cc(value)
    join public.cards c on lower(btrim(regexp_replace(normalize(c.term, NFKC), '[[:space:]]+', ' ', 'g'))) = cc.value->>'term_key'
    join public.course_lessons l on l.set_id = c.set_id
    join public.course_parts p on p.id = l.part_id
    join public.course_levels v on v.id = p.level_id where v.course_id = course_key
  ) then raise exception 'Course terms changed during generation; restart seed'; end if;
  for part in select value from jsonb_array_elements(p_level->'parts') loop
    insert into public.course_parts(level_id,position,title) values (level_key,part_number,part->>'title') returning id into part_key;
    part_number := part_number + 1;
    lesson_number := 0;
    for lesson in select value from jsonb_array_elements(part->'lessons') loop
      insert into public.study_sets(owner_id,title,description,visibility)
        values (p_owner,lesson->>'title',lesson->>'question','public') returning id into set_key;
      insert into public.cards(set_id,position,term,part_of_speech,ipa,definition_vi,definition_en,example_en,example_vi,synonyms)
        select set_key,c.ordinality - 1,c.term,c.part_of_speech,c.ipa,c.definition_vi,c.definition_en,c.example_en,c.example_vi,coalesce(c.synonyms,'{}')
        from rows from (jsonb_to_recordset(lesson->'cards') as (term text,part_of_speech text,ipa text,definition_vi text,
          definition_en text,example_en text,example_vi text,synonyms text[])) with ordinality c;
      insert into public.course_lessons(part_id,position,title,icon,warmup_question,set_id)
        values (part_key,lesson_number,lesson->>'title',lesson->>'icon',lesson->>'question',set_key);
      lesson_number := lesson_number + 1;
    end loop;
  end loop;
  return true;
end;
$$;
revoke all on function public.seed_course_level(uuid,jsonb,jsonb) from public, anon, authenticated;
grant execute on function public.seed_course_level(uuid,jsonb,jsonb) to service_role;

create function public.advance_course_lesson(p_user uuid, p_lesson uuid, p_step int, p_transcript text default null,
  p_pron jsonb default null, p_feedback jsonb default null)
returns boolean language plpgsql set search_path = '' as $$
declare
  current_step int;
  finished timestamptz;
  target record;
begin
  perform pg_advisory_xact_lock(hashtextextended(p_user::text, 0));
  select l.set_id,l.warmup_question,l.position,p.position as part_position,p.level_id into target
    from public.course_lessons l join public.course_parts p on p.id=l.part_id where l.id=p_lesson;
  if not found or p_step not between 1 and 4 then return false; end if;
  if exists (select 1 from public.course_parts p join public.course_lessons l on l.part_id=p.id
    where p.level_id=target.level_id and (p.position,l.position)<(target.part_position,target.position)
    and not exists (select 1 from public.lesson_progress s where s.user_id=p_user and s.lesson_id=l.id and s.completed_at is not null)) then
    return false;
  end if;
  select step,completed_at into current_step,finished from public.lesson_progress where user_id=p_user and lesson_id=p_lesson;
  if coalesce(current_step,1)<>p_step or finished is not null then return false; end if;
  if p_step in (1,3) then
    if p_transcript is null or p_pron is null then return false; end if;
    insert into public.speaking_attempts(user_id,lesson_id,mode,prompt_text,transcript,pron,feedback)
      values (p_user,p_lesson,'speaking',target.warmup_question,p_transcript,p_pron,p_feedback);
  end if;
  if p_step=1 then
    insert into public.lesson_progress(user_id,lesson_id,step,warmup_transcript) values (p_user,p_lesson,2,p_transcript);
  elsif p_step=2 then
    if exists (select 1 from public.cards c where c.set_id=target.set_id and not exists (
      select 1 from public.review_states r where r.card_id=c.id and r.user_id=p_user
    )) then return false; end if;
    update public.lesson_progress set step=3 where user_id=p_user and lesson_id=p_lesson;
  elsif p_step=3 then
    update public.lesson_progress set step=4,comparison=p_feedback where user_id=p_user and lesson_id=p_lesson;
  else
    if not exists (select 1 from public.chat_threads t where t.user_id=p_user and t.set_id=target.set_id
        and t.scenario='course' and t.summary is not null and 4 <= (select count(*) from public.chat_messages m where m.thread_id=t.id and m.role='user')) then
      return false;
    end if;
    update public.lesson_progress set completed_at=now() where user_id=p_user and lesson_id=p_lesson;
  end if;
  insert into public.course_choices (user_id, course_id, level_id)
    select p_user, v.course_id, v.id from public.course_levels v where v.id = target.level_id
    on conflict (user_id, course_id) do update set level_id = excluded.level_id, updated_at = now();
  return true;
end;
$$;
revoke all on function public.advance_course_lesson(uuid,uuid,int,text,jsonb,jsonb) from public, anon, authenticated;
grant execute on function public.advance_course_lesson(uuid,uuid,int,text,jsonb,jsonb) to service_role;

create function public.course_notebook(p_course uuid)
returns table(id uuid, term text, ipa text, definition_vi text, score double precision)
language sql stable security invoker set search_path = '' as $$
  select c.id,c.term,c.ipa,c.definition_vi,a.score
  from public.course_levels v
  join public.course_parts p on p.level_id=v.id
  join public.course_lessons l on l.part_id=p.id
  join public.cards c on c.set_id=l.set_id
  join public.review_states r on r.card_id=c.id and r.user_id=(select auth.uid())
  left join lateral (
    select case when jsonb_typeof(s.pron->'score')='number' then (s.pron->>'score')::double precision end as score
    from public.speaking_attempts s where s.user_id=(select auth.uid()) and s.card_id=c.id and s.prompt_text=c.term
    order by s.created_at desc,s.id desc limit 1
  ) a on true
  where v.course_id=p_course
  order by v.position,p.position,l.position,c.position,c.id;
$$;
revoke all on function public.course_notebook(uuid) from public, anon;
grant execute on function public.course_notebook(uuid) to authenticated;
