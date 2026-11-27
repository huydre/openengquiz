create table public.learning_paths (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references public.profiles (id) on delete cascade,
  slug text unique check (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$' and char_length(slug) <= 120),
  title text not null check (char_length(trim(title)) between 1 and 200),
  description text check (char_length(description) <= 3000),
  tags text[] not null default '{}' check (cardinality(tags) <= 10),
  level text not null check (level in ('A1','A2','B1','B2','C1','C2')),
  visibility text not null default 'private' check (visibility in ('private','public')),
  status text not null default 'ready' check (status in ('generating','ready','failed')),
  error text check (char_length(error) <= 1000),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create trigger learning_paths_updated_at before update on public.learning_paths
  for each row execute function public.set_updated_at();
create index learning_paths_owner_idx on public.learning_paths (owner_id, created_at desc);
create index learning_paths_public_idx on public.learning_paths (created_at desc) where visibility = 'public' and status = 'ready';

create table public.path_items (
  path_id uuid not null references public.learning_paths (id) on delete cascade,
  set_id uuid not null references public.study_sets (id) on delete cascade,
  position integer not null check (position >= 0),
  primary key (path_id, set_id),
  unique (path_id, position)
);
create index path_items_set_idx on public.path_items(set_id);

alter table public.learning_paths enable row level security;
alter table public.path_items enable row level security;
revoke all on public.learning_paths, public.path_items from public, anon, authenticated;
grant select on public.learning_paths, public.path_items to anon, authenticated;
grant insert (owner_id, title, description, tags, level, status) on public.learning_paths to authenticated;
grant update (title, description, tags, level, visibility, status, error) on public.learning_paths to authenticated;
grant delete on public.learning_paths to authenticated;
grant all on public.learning_paths, public.path_items to service_role;

create policy "path public or owner reads" on public.learning_paths for select to anon, authenticated using (
  (visibility = 'public' and status = 'ready') or owner_id = (select auth.uid())
);
create policy "path owner starts generation" on public.learning_paths for insert to authenticated with check (
  owner_id = (select auth.uid()) and visibility = 'private' and status = 'generating'
);
create policy "path owner updates" on public.learning_paths for update to authenticated using (
  owner_id = (select auth.uid())
) with check (owner_id = (select auth.uid()));
create policy "path owner deletes" on public.learning_paths for delete to authenticated using (owner_id = (select auth.uid()));
create policy "item reads with path and set" on public.path_items for select to anon, authenticated using (
  exists (select 1 from public.learning_paths p where p.id = path_id) and
  exists (select 1 from public.study_sets s where s.id = set_id
    and (s.visibility = 'public' or s.owner_id = (select auth.uid())))
);

create function public.create_learning_path(
  p_title text, p_description text, p_tags text[], p_level text, p_visibility text, p_set_ids uuid[]
) returns uuid language plpgsql security definer set search_path = '' as $$
declare
  viewer uuid := (select auth.uid());
  path uuid;
  requested integer := cardinality(p_set_ids);
  eligible integer;
begin
  if viewer is null or requested is null or requested not between 1 and 100 then
    raise exception 'invalid learning path' using errcode = '22023';
  end if;
  select count(*) into eligible from public.study_sets s
    where s.id = any(p_set_ids) and (s.visibility = 'public' or (p_visibility = 'private' and s.owner_id = viewer));
  if eligible <> requested then raise exception 'invalid learning path sets' using errcode = '22023'; end if;
  insert into public.learning_paths(owner_id,title,description,tags,level,visibility)
    values (viewer,p_title,p_description,p_tags,p_level,p_visibility) returning id into path;
  insert into public.path_items(path_id,set_id,position)
    select path, id, ord - 1 from unnest(p_set_ids) with ordinality as sets(id,ord);
  return path;
end;
$$;
revoke all on function public.create_learning_path(text,text,text[],text,text,uuid[]) from public, anon;
grant execute on function public.create_learning_path(text,text,text[],text,text,uuid[]) to authenticated;

create function public.path_progress(p_path_id uuid)
returns table(set_id uuid, "position" integer, total bigint, mastered bigint)
language sql stable security invoker set search_path = '' as $$
  select i.set_id, i.position, count(c.id), count(c.id) filter (where r.state = 'review')
  from public.path_items i
  left join public.cards c on c.set_id = i.set_id
  left join public.review_states r on r.card_id = c.id and r.user_id = (select auth.uid())
  where i.path_id = p_path_id
  group by i.set_id, i.position order by i.position;
$$;
revoke all on function public.path_progress(uuid) from public, anon;
grant execute on function public.path_progress(uuid) to authenticated;

-- Called only by the two publication RPCs; failures roll back every set and card.
create function public.insert_path_sets(p_path_id uuid, p_owner_id uuid, p_sets jsonb, p_max_sets int, p_max_cards int)
returns void language plpgsql set search_path = '' as $$
declare
  entry jsonb;
  new_set uuid;
  set_position integer := 0;
begin
  if jsonb_typeof(p_sets) is distinct from 'array' then raise exception 'invalid generated sets' using errcode = '22023'; end if;
  if jsonb_array_length(p_sets) not between 1 and p_max_sets then raise exception 'invalid generated set count' using errcode = '22023'; end if;
  for entry in select value from jsonb_array_elements(p_sets) loop
    if jsonb_typeof(entry->'cards') is distinct from 'array' then raise exception 'invalid generated cards' using errcode = '22023'; end if;
    if jsonb_array_length(entry->'cards') not between 1 and p_max_cards then raise exception 'invalid generated card count' using errcode = '22023'; end if;
    insert into public.study_sets(owner_id,title,description,visibility)
      values (p_owner_id, entry->>'title', entry->>'description', 'private') returning id into new_set;
    insert into public.cards(set_id,position,term,part_of_speech,ipa,definition_vi,definition_en,example_en,example_vi,synonyms)
      select new_set, c.ordinality - 1, c.term, c.part_of_speech, c.ipa, c.definition_vi, c.definition_en,
        c.example_en, c.example_vi, coalesce(c.synonyms, '{}'::text[])
      from rows from (jsonb_to_recordset(entry->'cards') as (
        term text, part_of_speech text, ipa text, definition_vi text, definition_en text,
        example_en text, example_vi text, synonyms text[]
      )) with ordinality as c;
    insert into public.path_items(path_id,set_id,position) values (p_path_id,new_set,set_position);
    set_position := set_position + 1;
  end loop;
end;
$$;
revoke all on function public.insert_path_sets(uuid,uuid,jsonb,int,int) from public, anon, authenticated, service_role;

create function public.publish_generated_path(p_path_id uuid,p_sets jsonb)
returns boolean language plpgsql security definer set search_path = '' as $$
declare
  owner uuid;
begin
  select owner_id into owner from public.learning_paths where id = p_path_id and owner_id = (select auth.uid())
    and visibility = 'private' and status = 'generating' for update;
  if not found then return false; end if;
  perform public.insert_path_sets(p_path_id, owner, p_sets, 10, 30);
  update public.learning_paths set status = 'ready', error = null where id = p_path_id;
  return true;
end;
$$;
revoke all on function public.publish_generated_path(uuid,jsonb) from public, anon;
grant execute on function public.publish_generated_path(uuid,jsonb) to authenticated;

create function public.seed_learning_path(p_owner_id uuid,p_slug text,p_title text,p_description text,p_tags text[],p_level text,p_sets jsonb)
returns uuid language plpgsql security definer set search_path = '' as $$
declare
  path uuid;
begin
  if p_slug is null then raise exception 'missing slug' using errcode = '22023'; end if;
  insert into public.learning_paths(owner_id,slug,title,description,tags,level,visibility)
    values (p_owner_id,p_slug,p_title,p_description,p_tags,p_level,'private')
    on conflict (slug) do nothing returning id into path;
  if path is null then select id into path from public.learning_paths where slug = p_slug; return path; end if;
  perform public.insert_path_sets(path,p_owner_id,p_sets,20,60);
  return path;
end;
$$;
revoke all on function public.seed_learning_path(uuid,text,text,text,text[],text,jsonb) from public, anon, authenticated;
grant execute on function public.seed_learning_path(uuid,text,text,text,text[],text,jsonb) to service_role;
