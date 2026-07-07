-- Storage bucket for directly-uploaded exterior/backyard/aerial photos.
-- Users can alternatively just attach an existing image URL (no upload needed).
insert into storage.buckets (id, name, public)
values ('property-images', 'property-images', true)
on conflict (id) do nothing;

create policy "authenticated upload property images"
  on storage.objects for insert to authenticated
  with check (bucket_id = 'property-images');

create policy "authenticated manage own uploads"
  on storage.objects for all to authenticated
  using (bucket_id = 'property-images')
  with check (bucket_id = 'property-images');

create policy "public read property images"
  on storage.objects for select to anon, authenticated
  using (bucket_id = 'property-images');
