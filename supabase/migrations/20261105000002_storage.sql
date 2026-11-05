-- =====================================================================
-- Storage buckets & policies
--
--  media      PUBLIC  — web-ready derivatives shown on the site: optimized
--                       images, thumbnails, video files, posters, display GLBs,
--                       service and SEO images. Object keys contain random
--                       UUIDs and the bucket cannot be listed anonymously.
--  originals  PRIVATE — untouched original uploads (photos, FBX/OBJ/STL/3MF…).
--  inquiries  PRIVATE — files attached through the public contact form
--                       (written by the server with the service role).
--
-- Only CMS users (public.is_admin()) may write to any bucket.
-- =====================================================================

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values
  ('media', 'media', true, null, array[
    'image/jpeg', 'image/png', 'image/webp',
    'video/mp4', 'video/webm', 'video/quicktime',
    'model/gltf-binary', 'application/octet-stream'
  ]),
  ('originals', 'originals', false, null, null),
  ('inquiries', 'inquiries', false, 26214400, array[
    'application/pdf', 'image/jpeg', 'image/png', 'image/webp',
    'application/zip', 'application/x-zip-compressed',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'application/msword', 'application/octet-stream'
  ])
on conflict (id) do update
  set public = excluded.public,
      file_size_limit = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types;

-- CMS users: full control over media and originals.
create policy "cms read media/originals" on storage.objects
  for select to authenticated
  using (bucket_id in ('media', 'originals', 'inquiries') and public.is_admin());

create policy "cms insert media/originals" on storage.objects
  for insert to authenticated
  with check (bucket_id in ('media', 'originals') and public.is_admin());

create policy "cms update media/originals" on storage.objects
  for update to authenticated
  using (bucket_id in ('media', 'originals') and public.is_admin())
  with check (bucket_id in ('media', 'originals') and public.is_admin());

create policy "cms delete storage" on storage.objects
  for delete to authenticated
  using (bucket_id in ('media', 'originals', 'inquiries') and public.is_admin());

-- No anon policies: anonymous visitors can only fetch public-bucket objects by
-- exact URL (/storage/v1/object/public/media/...), never list or write.
