-- Public bucket for card images that learners upload themselves (illustrations for their own
-- cards). Files live under "<user id>/..." and only that user can add or remove them; anyone can
-- view (cards in public sets show their images). Size and type are limited by the bucket.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('card-images', 'card-images', true, 2097152, array['image/jpeg', 'image/png', 'image/webp', 'image/gif'])
on conflict (id) do nothing;

create policy "card images: owner uploads" on storage.objects
  for insert to authenticated
  with check (bucket_id = 'card-images' and (storage.foldername(name))[1] = (select auth.uid())::text);

create policy "card images: owner deletes" on storage.objects
  for delete to authenticated
  using (bucket_id = 'card-images' and (storage.foldername(name))[1] = (select auth.uid())::text);
