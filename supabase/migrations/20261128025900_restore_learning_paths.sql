-- 20261127160000 dropped the original paths tables when courses replaced them.
create table public.learning_paths (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references public.profiles(id) on delete cascade,
  slug text unique check (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$' and char_length(slug) <= 120),
  title text not null check (char_length(btrim(title)) between 1 and 200),
  description text check (char_length(description) <= 3000),
  tags text[] not null default '{}' check (cardinality(tags) <= 10),
  level text not null check (level in ('A1','A2','B1','B2','C1','C2')),
  visibility text not null default 'private' check (visibility in ('private','public')),
  status text not null default 'ready' check (status in ('generating','ready','failed')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create trigger learning_paths_updated_at before update on public.learning_paths
  for each row execute function public.set_updated_at();
create index learning_paths_public_idx on public.learning_paths (created_at desc)
  where visibility = 'public' and status = 'ready';

create table public.path_items (
  path_id uuid not null references public.learning_paths(id) on delete cascade,
  set_id uuid not null references public.study_sets(id) on delete cascade,
  position int not null check (position >= 0),
  primary key (path_id, set_id),
  unique (path_id, position)
);
create index path_items_set_idx on public.path_items(set_id);

alter table public.learning_paths enable row level security;
alter table public.path_items enable row level security;
revoke all on public.learning_paths, public.path_items from public, anon, authenticated;
grant select on public.learning_paths, public.path_items to anon, authenticated;
grant all on public.learning_paths, public.path_items to service_role;
create policy "path public or owner reads" on public.learning_paths for select to anon, authenticated
  using ((visibility = 'public' and status = 'ready') or owner_id = (select auth.uid()));
create policy "item reads with path and set" on public.path_items for select to anon, authenticated using (
  exists (select 1 from public.learning_paths p where p.id = path_id)
  and exists (select 1 from public.study_sets s where s.id = set_id)
);

-- A path slug identifies its entire ordered collection; publish sets and cards in one transaction.
create function public.seed_learning_path(p_owner_id uuid, p_slug text, p_title text, p_description text,
  p_tags text[], p_level text, p_sets jsonb)
returns uuid language plpgsql set search_path = '' as $$
declare
  new_path uuid;
  new_set uuid;
  entry record;
begin
  if p_slug is null or jsonb_typeof(p_sets) is distinct from 'array' then
    raise exception 'Invalid seed path';
  end if;
  if jsonb_array_length(p_sets) not between 1 and 20 then raise exception 'Invalid seed set count'; end if;
  insert into public.learning_paths(owner_id,slug,title,description,tags,level,visibility,status)
    values (p_owner_id,p_slug,p_title,p_description,p_tags,p_level,'public','ready')
    on conflict (slug) do nothing returning id into new_path;
  if new_path is null then return null; end if;
  for entry in select * from jsonb_array_elements(p_sets) with ordinality loop
    if jsonb_typeof(entry.value->'cards') is distinct from 'array' then raise exception 'Invalid seed cards'; end if;
    if jsonb_array_length(entry.value->'cards') not between 1 and 60 then raise exception 'Invalid seed card count'; end if;
    insert into public.study_sets(owner_id,title,description,visibility)
      values (p_owner_id,entry.value->>'title',entry.value->>'description','public') returning id into new_set;
    insert into public.cards(set_id,position,term,part_of_speech,ipa,definition_vi,definition_en,example_en,example_vi,synonyms)
      select new_set,c.ordinality-1,c.term,c.part_of_speech,c.ipa,c.definition_vi,c.definition_en,c.example_en,c.example_vi,c.synonyms
      from rows from (jsonb_to_recordset(entry.value->'cards') as (
        term text, part_of_speech text, ipa text, definition_vi text, definition_en text,
        example_en text, example_vi text, synonyms text[]
      )) with ordinality as c;
    insert into public.path_items(path_id,set_id,position) values (new_path,new_set,entry.ordinality-1);
  end loop;
  return new_path;
end;
$$;
revoke all on function public.seed_learning_path(uuid,text,text,text,text[],text,jsonb) from public, anon, authenticated;
grant execute on function public.seed_learning_path(uuid,text,text,text,text[],text,jsonb) to service_role;

create function public.recent_path_study_sets(p_limit int)
returns table (id uuid, title text, last_studied_at timestamptz)
language sql stable security invoker set search_path = '' as $$
  select s.id, s.title, max(ss.started_at) as last_studied_at
  from public.study_sessions ss join public.study_sets s on s.id = ss.set_id
  where ss.user_id = (select auth.uid())
    and not exists (select 1 from public.course_lessons l where l.set_id = s.id)
  group by s.id order by last_studied_at desc, s.id
  limit greatest(0, coalesce(p_limit, 4));
$$;
revoke all on function public.recent_path_study_sets(int) from public, anon;
grant execute on function public.recent_path_study_sets(int) to authenticated;
