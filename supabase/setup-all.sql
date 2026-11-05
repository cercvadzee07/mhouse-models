-- =====================================================================
-- ALL-IN-ONE SETUP for a NEW, EMPTY Supabase project.
-- Paste the whole file into Supabase → SQL Editor and press Run (once).
-- = schema + storage + seed. Generated from the files in supabase/.
-- =====================================================================

-- =====================================================================
-- MHouse Models — core schema
-- Tables, constraints, indexes, triggers and Row Level Security.
-- Safe to run on a fresh Supabase project (SQL editor or `supabase db push`).
-- =====================================================================

-- gen_random_uuid() is built into PostgreSQL 13+ (no extension required).

-- ---------------------------------------------------------------------
-- Helpers
-- ---------------------------------------------------------------------
create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

-- ---------------------------------------------------------------------
-- Profiles & roles
-- A profile row is created automatically for every auth user, with NO role.
-- Admin access is granted only by the setup script / SQL (never by signup).
-- ---------------------------------------------------------------------
create table public.profiles (
  id          uuid primary key references auth.users (id) on delete cascade,
  email       text not null,
  full_name   text,
  role        text check (role in ('admin', 'editor')),
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

create trigger profiles_updated_at before update on public.profiles
  for each row execute function public.set_updated_at();

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, email, full_name)
  values (new.id, coalesce(new.email, ''), new.raw_user_meta_data ->> 'full_name')
  on conflict (id) do nothing;
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- Is the current request made by a CMS user (admin or editor)?
create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.profiles p
    where p.id = auth.uid() and p.role in ('admin', 'editor')
  );
$$;

revoke all on function public.is_admin() from public;
grant execute on function public.is_admin() to anon, authenticated;

-- Prevent users from escalating their own role through the API.
create or replace function public.protect_profile_role()
returns trigger
language plpgsql
as $$
begin
  -- API requests run as the "anon"/"authenticated" database roles; the service role,
  -- the SQL editor and migrations run as privileged roles and may change roles.
  if new.role is distinct from old.role and current_user in ('anon', 'authenticated') then
    raise exception 'Changing roles is not allowed from the client';
  end if;
  return new;
end;
$$;

create trigger profiles_protect_role before update on public.profiles
  for each row execute function public.protect_profile_role();

-- ---------------------------------------------------------------------
-- Categories
-- ---------------------------------------------------------------------
create table public.project_categories (
  id          uuid primary key default gen_random_uuid(),
  slug        text not null unique check (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),
  name_ka     text not null,
  name_en     text not null,
  sort_order  integer not null default 0,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);
create trigger project_categories_updated_at before update on public.project_categories
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------
-- Projects
-- ---------------------------------------------------------------------
create table public.projects (
  id              uuid primary key default gen_random_uuid(),
  slug            text not null unique check (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$' and char_length(slug) <= 120),
  category_id     uuid references public.project_categories (id) on delete set null,
  status          text not null default 'draft' check (status in ('draft', 'published')),
  is_featured     boolean not null default false,
  is_demo         boolean not null default false,
  sort_order      integer not null default 0,
  location_ka     text,
  location_en     text,
  project_date    date,
  scale           text check (char_length(scale) <= 40),
  materials_ka    text,
  materials_en    text,
  dimensions      text check (char_length(dimensions) <= 120),
  cover_image_id  uuid,
  published_at    timestamptz,
  created_by      uuid references auth.users (id) on delete set null,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

create index projects_status_sort_idx on public.projects (status, sort_order);
create index projects_category_idx on public.projects (category_id);
create index projects_featured_idx on public.projects (is_featured) where is_featured;

create trigger projects_updated_at before update on public.projects
  for each row execute function public.set_updated_at();

create or replace function public.projects_set_published_at()
returns trigger
language plpgsql
as $$
begin
  if new.status = 'published' and (tg_op = 'INSERT' or old.status is distinct from 'published') then
    new.published_at = coalesce(new.published_at, now());
  end if;
  return new;
end;
$$;
create trigger projects_published_at before insert or update on public.projects
  for each row execute function public.projects_set_published_at();

create table public.project_translations (
  id                 uuid primary key default gen_random_uuid(),
  project_id         uuid not null references public.projects (id) on delete cascade,
  locale             text not null check (locale in ('ka', 'en')),
  title              text not null default '' check (char_length(title) <= 200),
  short_description  text not null default '' check (char_length(short_description) <= 600),
  description        text not null default '' check (char_length(description) <= 20000),
  seo_title          text check (char_length(seo_title) <= 200),
  seo_description    text check (char_length(seo_description) <= 400),
  created_at         timestamptz not null default now(),
  updated_at         timestamptz not null default now(),
  unique (project_id, locale)
);
create trigger project_translations_updated_at before update on public.project_translations
  for each row execute function public.set_updated_at();

-- Images (gallery + production photographs)
create table public.project_images (
  id              uuid primary key default gen_random_uuid(),
  project_id      uuid not null references public.projects (id) on delete cascade,
  kind            text not null default 'gallery' check (kind in ('gallery', 'production')),
  original_path   text,           -- private bucket "originals"
  optimized_path  text,           -- public bucket "media" (webp, max 2400px)
  thumb_path      text,           -- public bucket "media" (webp, 720px)
  external_url    text,           -- demo content / externally hosted images
  width           integer,
  height          integer,
  blur_data_url   text,
  alt_ka          text not null default '',
  alt_en          text not null default '',
  credit          text,
  mime_type       text,
  size_bytes      bigint,
  sort_order      integer not null default 0,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),
  constraint project_images_source check (optimized_path is not null or external_url is not null)
);
create index project_images_project_idx on public.project_images (project_id, kind, sort_order);
create trigger project_images_updated_at before update on public.project_images
  for each row execute function public.set_updated_at();

alter table public.projects
  add constraint projects_cover_image_fk
  foreign key (cover_image_id) references public.project_images (id) on delete set null;

-- Videos
create table public.project_videos (
  id                uuid primary key default gen_random_uuid(),
  project_id        uuid not null references public.projects (id) on delete cascade,
  kind              text not null default 'finished'
                    check (kind in ('finished', 'production', 'behind_the_scenes', 'walkthrough', 'detail')),
  source            text not null check (source in ('upload', 'external')),
  storage_path      text,          -- public bucket "media"
  external_url      text,
  poster_path       text,          -- public bucket "media"
  caption_ka        text not null default '',
  caption_en        text not null default '',
  mime_type         text,
  size_bytes        bigint,
  duration_seconds  numeric(10, 2),
  width             integer,
  height            integer,
  sort_order        integer not null default 0,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now(),
  constraint project_videos_has_source check (
    (source = 'upload' and storage_path is not null) or
    (source = 'external' and external_url is not null)
  )
);
create index project_videos_project_idx on public.project_videos (project_id, sort_order);
create trigger project_videos_updated_at before update on public.project_videos
  for each row execute function public.set_updated_at();

-- 3D models
create table public.project_models (
  id                uuid primary key default gen_random_uuid(),
  project_id        uuid not null references public.projects (id) on delete cascade,
  label_ka          text not null default '',
  label_en          text not null default '',
  original_path     text not null,  -- private bucket "originals" (or "media" for .glb)
  original_bucket   text not null default 'originals' check (original_bucket in ('originals', 'media')),
  original_name     text not null,
  original_format   text not null check (original_format in ('glb', 'gltf', 'obj', 'fbx', 'stl', '3mf')),
  original_size     bigint,
  display_path      text,           -- public bucket "media", always .glb
  display_size      bigint,
  display_status    text not null default 'pending'
                    check (display_status in ('ready', 'pending', 'failed')),
  status_message    text,
  triangle_count    integer,
  is_primary        boolean not null default false,
  sort_order        integer not null default 0,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now(),
  constraint project_models_ready_has_display check (display_status <> 'ready' or display_path is not null)
);
create index project_models_project_idx on public.project_models (project_id, sort_order);
create unique index project_models_one_primary on public.project_models (project_id) where is_primary;
create trigger project_models_updated_at before update on public.project_models
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------
-- Services
-- ---------------------------------------------------------------------
create table public.services (
  id                  uuid primary key default gen_random_uuid(),
  slug                text not null unique check (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),
  title_ka            text not null,
  title_en            text not null,
  description_ka      text not null default '',
  description_en      text not null default '',
  image_path          text,          -- public bucket "media"
  image_external_url  text,
  is_visible          boolean not null default true,
  sort_order          integer not null default 0,
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now()
);
create index services_sort_idx on public.services (sort_order);
create trigger services_updated_at before update on public.services
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------
-- Singleton content tables (exactly one row, id = 1)
-- ---------------------------------------------------------------------
create table public.homepage_content (
  id                   smallint primary key default 1 check (id = 1),
  eyebrow_ka           text not null default '',
  eyebrow_en           text not null default '',
  headline_ka          text not null default '',
  headline_en          text not null default '',
  subheadline_ka       text not null default '',
  subheadline_en       text not null default '',
  cta_primary_ka       text not null default '',
  cta_primary_en       text not null default '',
  cta_secondary_ka     text not null default '',
  cta_secondary_en     text not null default '',
  hero_mode            text not null default 'procedural' check (hero_mode in ('procedural', 'model', 'image')),
  hero_model_id        uuid references public.project_models (id) on delete set null,
  hero_image_path      text,
  hero_auto_rotate     boolean not null default true,
  hero_evening_lights  boolean not null default true,
  why_title_ka         text not null default '',
  why_title_en         text not null default '',
  updated_at           timestamptz not null default now()
);
create trigger homepage_content_updated_at before update on public.homepage_content
  for each row execute function public.set_updated_at();

create table public.studio_info (
  id               smallint primary key default 1 check (id = 1),
  about_title_ka   text not null default '',
  about_title_en   text not null default '',
  about_body_ka    text not null default '',
  about_body_en    text not null default '',
  description_ka   text not null default '',
  description_en   text not null default '',
  principles       jsonb not null default '[]'::jsonb,  -- [{title_ka,title_en,body_ka,body_en}]
  studio_image_path text,
  updated_at       timestamptz not null default now()
);
create trigger studio_info_updated_at before update on public.studio_info
  for each row execute function public.set_updated_at();

create table public.contact_settings (
  id               smallint primary key default 1 check (id = 1),
  email            text,
  phone            text,
  whatsapp         text,          -- international number, digits only, e.g. 995555123456
  instagram_url    text,
  tiktok_url       text,
  facebook_url     text,
  linkedin_url     text,
  address_ka       text,
  address_en       text,
  show_address     boolean not null default false,
  notify_email     text,          -- where new inquiries are emailed (optional)
  updated_at       timestamptz not null default now()
);
create trigger contact_settings_updated_at before update on public.contact_settings
  for each row execute function public.set_updated_at();

create table public.general_settings (
  id                 smallint primary key default 1 check (id = 1),
  studio_name        text not null default 'MHouse Models',
  studio_name_short  text not null default 'MHouse',
  wordmark_suffix    text not null default 'Models',
  show_demo_badges   boolean not null default true,
  updated_at         timestamptz not null default now()
);
create trigger general_settings_updated_at before update on public.general_settings
  for each row execute function public.set_updated_at();

create table public.seo_settings (
  id               uuid primary key default gen_random_uuid(),
  page_key         text not null unique check (page_key in ('home', 'projects', 'default')),
  title_ka         text not null default '',
  title_en         text not null default '',
  description_ka   text not null default '',
  description_en   text not null default '',
  og_image_path    text,
  updated_at       timestamptz not null default now()
);
create trigger seo_settings_updated_at before update on public.seo_settings
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------
-- Inquiries (contact form). Written only by the server (service role).
-- ---------------------------------------------------------------------
create table public.inquiries (
  id               uuid primary key default gen_random_uuid(),
  full_name        text not null check (char_length(full_name) between 2 and 120),
  company          text check (char_length(company) <= 160),
  email            text not null check (char_length(email) <= 254),
  phone            text check (char_length(phone) <= 40),
  project_type     text check (char_length(project_type) <= 80),
  message          text not null check (char_length(message) between 10 and 5000),
  attachment_path  text,          -- private bucket "inquiries"
  attachment_name  text,
  locale           text not null default 'ka' check (locale in ('ka', 'en')),
  status           text not null default 'new' check (status in ('new', 'read', 'archived')),
  ip_hash          text,
  created_at       timestamptz not null default now()
);
create index inquiries_created_idx on public.inquiries (created_at desc);
create index inquiries_ip_idx on public.inquiries (ip_hash, created_at desc);

-- ---------------------------------------------------------------------
-- Activity log
-- ---------------------------------------------------------------------
create table public.activity_logs (
  id           bigint generated always as identity primary key,
  actor_id     uuid references auth.users (id) on delete set null,
  actor_email  text,
  action       text not null,
  entity_type  text not null,
  entity_id    text,
  summary      text,
  details      jsonb not null default '{}'::jsonb,
  created_at   timestamptz not null default now()
);
create index activity_logs_created_idx on public.activity_logs (created_at desc);

-- ---------------------------------------------------------------------
-- Row Level Security
-- ---------------------------------------------------------------------
alter table public.profiles             enable row level security;
alter table public.project_categories   enable row level security;
alter table public.projects             enable row level security;
alter table public.project_translations enable row level security;
alter table public.project_images       enable row level security;
alter table public.project_videos       enable row level security;
alter table public.project_models       enable row level security;
alter table public.services             enable row level security;
alter table public.homepage_content     enable row level security;
alter table public.studio_info          enable row level security;
alter table public.contact_settings     enable row level security;
alter table public.general_settings     enable row level security;
alter table public.seo_settings         enable row level security;
alter table public.inquiries            enable row level security;
alter table public.activity_logs        enable row level security;

-- profiles: a user can read their own profile; admins can read all. No client writes to role.
create policy profiles_select_own on public.profiles
  for select to authenticated using (id = auth.uid() or public.is_admin());
create policy profiles_update_own on public.profiles
  for update to authenticated using (id = auth.uid()) with check (id = auth.uid());

-- Published-project visibility helper
create or replace function public.project_is_visible(p_project_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.projects p
    where p.id = p_project_id and (p.status = 'published' or public.is_admin())
  );
$$;
grant execute on function public.project_is_visible(uuid) to anon, authenticated;

-- categories: public read, admin write
create policy categories_read on public.project_categories for select using (true);
create policy categories_write on public.project_categories for all to authenticated
  using (public.is_admin()) with check (public.is_admin());

-- projects: public sees only published; admins see everything
create policy projects_read on public.projects for select
  using (status = 'published' or public.is_admin());
create policy projects_write on public.projects for all to authenticated
  using (public.is_admin()) with check (public.is_admin());

create policy project_translations_read on public.project_translations for select
  using (public.project_is_visible(project_id));
create policy project_translations_write on public.project_translations for all to authenticated
  using (public.is_admin()) with check (public.is_admin());

create policy project_images_read on public.project_images for select
  using (public.project_is_visible(project_id));
create policy project_images_write on public.project_images for all to authenticated
  using (public.is_admin()) with check (public.is_admin());

create policy project_videos_read on public.project_videos for select
  using (public.project_is_visible(project_id));
create policy project_videos_write on public.project_videos for all to authenticated
  using (public.is_admin()) with check (public.is_admin());

create policy project_models_read on public.project_models for select
  using (public.project_is_visible(project_id) and (display_status = 'ready' or public.is_admin()));
create policy project_models_write on public.project_models for all to authenticated
  using (public.is_admin()) with check (public.is_admin());

-- services: public sees visible services
create policy services_read on public.services for select using (is_visible or public.is_admin());
create policy services_write on public.services for all to authenticated
  using (public.is_admin()) with check (public.is_admin());

-- singleton content: public read, admin update
create policy homepage_read on public.homepage_content for select using (true);
create policy homepage_write on public.homepage_content for all to authenticated
  using (public.is_admin()) with check (public.is_admin());

create policy studio_read on public.studio_info for select using (true);
create policy studio_write on public.studio_info for all to authenticated
  using (public.is_admin()) with check (public.is_admin());

-- contact settings are public EXCEPT notify_email, which is exposed through a view below.
create policy contact_read_admin on public.contact_settings for select to authenticated using (public.is_admin());
create policy contact_write on public.contact_settings for all to authenticated
  using (public.is_admin()) with check (public.is_admin());

create policy general_read on public.general_settings for select using (true);
create policy general_write on public.general_settings for all to authenticated
  using (public.is_admin()) with check (public.is_admin());

create policy seo_read on public.seo_settings for select using (true);
create policy seo_write on public.seo_settings for all to authenticated
  using (public.is_admin()) with check (public.is_admin());

-- inquiries: admin only (inserts happen server-side with the service role)
create policy inquiries_admin on public.inquiries for all to authenticated
  using (public.is_admin()) with check (public.is_admin());

-- activity log: admins read and append
create policy activity_read on public.activity_logs for select to authenticated using (public.is_admin());
create policy activity_insert on public.activity_logs for insert to authenticated with check (public.is_admin());

-- Public, non-sensitive view of contact settings (hides notify_email).
create or replace view public.public_contact_settings
with (security_invoker = false) as
  select id, email, phone, whatsapp, instagram_url, tiktok_url, facebook_url, linkedin_url,
         case when show_address then address_ka end as address_ka,
         case when show_address then address_en end as address_en,
         show_address, updated_at
  from public.contact_settings;
grant select on public.public_contact_settings to anon, authenticated;

-- Atomic reorder helpers (admin only)
create or replace function public.reorder_rows(p_table text, p_ids uuid[])
returns void
language plpgsql
security invoker
set search_path = public
as $$
declare
  i integer;
begin
  if not public.is_admin() then
    raise exception 'not authorized';
  end if;
  if p_table not in ('projects', 'project_images', 'project_videos', 'project_models', 'services', 'project_categories') then
    raise exception 'invalid table';
  end if;
  for i in 1 .. coalesce(array_length(p_ids, 1), 0) loop
    execute format('update public.%I set sort_order = $1 where id = $2', p_table) using i, p_ids[i];
  end loop;
end;
$$;
grant execute on function public.reorder_rows(text, uuid[]) to authenticated;

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

-- =====================================================================
-- Seed data — GENERATED by scripts/generate-seed.ts from src/content/defaults.ts
-- Do not edit by hand; edit the defaults and run `npm run db:seed:generate`.
-- =====================================================================

begin;

-- Singleton content
insert into public.general_settings (id, studio_name, studio_name_short, wordmark_suffix, show_demo_badges)
values
  (1, 'MHouse Models', 'MHouse', 'Models', true)
on conflict (id) do nothing;

insert into public.homepage_content (id, eyebrow_ka, eyebrow_en, headline_ka, headline_en, subheadline_ka, subheadline_en, cta_primary_ka, cta_primary_en, cta_secondary_ka, cta_secondary_en, hero_mode, hero_model_id, hero_image_path, hero_auto_rotate, hero_evening_lights, why_title_ka, why_title_en)
values
  (1, 'არქიტექტურული მაკეტების სტუდია · საქართველო', 'Architectural model studio · Georgia', 'არქიტექტურა, რომელიც რეალობამდე ფორმას იძენს.', 'Architecture that takes shape before it becomes real.', 'ვამზადებ დეტალურ არქიტექტურულ მაკეტებს, რომლებიც თქვენს იდეებს სამგანზომილებიან რეალობად აქცევს.', 'I build detailed architectural scale models that turn your ideas into three-dimensional reality.', 'ნამუშევრების ნახვა', 'View the work', 'პროექტის განხილვა', 'Discuss a project', 'procedural', null, null, true, true, 'რენდერი აჩვენებს. მაკეტი არწმუნებს.', 'A render shows. A model convinces.')
on conflict (id) do nothing;

insert into public.studio_info (id, about_title_ka, about_title_en, about_body_ka, about_body_en, description_ka, description_en, principles, studio_image_path)
values
  (1, 'დამოუკიდებელი სტუდია. პირადი პასუხისმგებლობა ყველა დეტალზე.', 'An independent studio. Personal responsibility for every detail.', 'MHouse Models დამოუკიდებელი არქიტექტურული მაკეტების სტუდიაა. თითოეულ პროექტზე თავიდან ბოლომდე პირადად ვმუშაობ — ნახაზების პირველი განხილვიდან მზა მაკეტის ჩაბარებამდე.

ეს ნიშნავს, რომ თქვენ პირდაპირ ესაუბრებით იმ ადამიანს, ვინც მაკეტს ამზადებს. არ არსებობს შუამავლები და დაკარგული ინფორმაცია — ყველა გადაწყვეტილება თქვენი პროექტის კონკრეტულ მიზანს ემსახურება.', 'MHouse Models is an independent architectural model-making studio. I work on every project personally from start to finish — from the first review of the drawings to the delivery of the finished model.

This means you speak directly with the person who builds your model. There are no intermediaries and nothing gets lost along the way — every decision serves the specific purpose of your project.', 'არქიტექტურული მაკეტების დამზადება შეკვეთით — დეველოპერებისთვის, სამშენებლო კომპანიებისთვის, არქიტექტორებისა და ინვესტორებისთვის.', 'Architectural scale models made to order — for property developers, construction companies, architects and investors.', '[{"title_ka":"ინდივიდუალური ყურადღება","title_en":"Individual attention","body_ka":"ყოველი პროექტი იწყება თქვენი მიზნის გაგებით: სად, ვის და როგორ წარუდგენთ მაკეტს.","body_en":"Every project starts by understanding your goal: where, to whom and how the model will be presented."},{"title_ka":"სიზუსტე და დეტალი","title_en":"Precision and detail","body_ka":"პროპორციები, ფასადის რიტმი, ფანჯრები და აივნები — მასშტაბის ერთგულად.","body_en":"Proportions, facade rhythm, windows and balconies — faithful to the scale."},{"title_ka":"არქიტექტურული აზროვნება","title_en":"Architectural understanding","body_ka":"მაკეტი იდეას უნდა ჰყვებოდეს. ვკითხულობ ნახაზებს და ვიცავ ავტორის კონცეფციას.","body_en":"A model should tell the idea. I read the drawings and respect the author''s concept."},{"title_ka":"პირდაპირი კომუნიკაცია","title_en":"Direct communication","body_ka":"კითხვებზე პასუხი, პროგრესის განახლებები და გადაწყვეტილებები — უშუალოდ მაკეტის ავტორისგან.","body_en":"Answers, progress updates and decisions come straight from the model maker."}]'::jsonb, null)
on conflict (id) do nothing;

insert into public.contact_settings (id, email, phone, whatsapp, instagram_url, tiktok_url, facebook_url, linkedin_url, address_ka, address_en, show_address, notify_email)
values
  (1, null, null, null, null, 'https://www.tiktok.com/@mhouse_models', null, null, 'საქართველო', 'Georgia', true, null)
on conflict (id) do nothing;

insert into public.seo_settings (page_key, title_ka, title_en, description_ka, description_en, og_image_path)
values
  ('default', 'MHouse Models — არქიტექტურული მაკეტები', 'MHouse Models — Architectural Scale Models', 'დეტალური არქიტექტურული მასშტაბური მაკეტები დეველოპერებისთვის, სამშენებლო კომპანიებისთვის, არქიტექტორებისა და ინვესტორებისთვის.', 'Detailed architectural scale models for property developers, construction companies, architects and investors.', null),
  ('home', 'MHouse Models — არქიტექტურული მაკეტები შეკვეთით', 'MHouse Models — Architectural scale models, made to order', 'ვამზადებ დეტალურ არქიტექტურულ მაკეტებს საცხოვრებელი, კომერციული და ურბანული პროექტებისთვის. საქართველო.', 'Detailed architectural scale models for residential, commercial and urban projects. Based in Georgia.', null),
  ('projects', 'ნამუშევრები — MHouse Models', 'Work — MHouse Models', 'არქიტექტურული მაკეტების პორტფოლიო: საცხოვრებელი, კომერციული, ურბანული და კონცეპტუალური პროექტები.', 'Portfolio of architectural scale models: residential, commercial, urban and conceptual projects.', null)
on conflict (page_key) do nothing;

-- Categories & services
insert into public.project_categories (id, slug, name_ka, name_en, sort_order)
values
  ('c0000000-0000-4000-8000-000000000001', 'residential', 'საცხოვრებელი', 'Residential', 1),
  ('c0000000-0000-4000-8000-000000000002', 'commercial', 'კომერციული', 'Commercial', 2),
  ('c0000000-0000-4000-8000-000000000003', 'urban-landscape', 'ურბანული და ლანდშაფტი', 'Urban & Landscape', 3),
  ('c0000000-0000-4000-8000-000000000004', 'public-cultural', 'საზოგადოებრივი', 'Public & Cultural', 4),
  ('c0000000-0000-4000-8000-000000000005', 'conceptual', 'კონცეპტუალური', 'Conceptual', 5)
on conflict (id) do nothing;

insert into public.services (id, slug, title_ka, title_en, description_ka, description_en, image_path, image_external_url, is_visible, sort_order)
values
  ('5e000000-0000-4000-8000-000000000001', 'architectural-scale-models', 'არქიტექტურული მასშტაბური მაკეტები', 'Architectural Scale Models', 'ზუსტი, მასშტაბში შესრულებული მაკეტები ცალკეული შენობებისა და კომპლექსებისთვის — პრეზენტაციებისთვის, შეხვედრებისა და გამოფენებისთვის.', 'Precise scale models of individual buildings and complexes — for presentations, meetings and exhibitions.', null, 'https://images.unsplash.com/photo-1633355303026-28d096d08c42?auto=format&fit=crop&w=1600&q=80', true, 1),
  ('5e000000-0000-4000-8000-000000000002', 'residential-building-models', 'საცხოვრებელი კომპლექსების მაკეტები', 'Residential Building Models', 'მრავალბინიანი სახლები და საცხოვრებელი კომპლექსები ფასადის დეტალებით, აივნებით, ეზოებითა და გამწვანებით — გაყიდვების ოფისისთვის.', 'Apartment buildings and residential complexes with facade detail, balconies, courtyards and greenery — made for the sales office.', null, 'https://images.unsplash.com/photo-1624066969616-69b0b0301d4d?auto=format&fit=crop&w=1600&q=80', true, 2),
  ('5e000000-0000-4000-8000-000000000003', 'commercial-architecture-models', 'კომერციული არქიტექტურის მაკეტები', 'Commercial Architecture Models', 'ოფისები, სასტუმროები, სავაჭრო და მრავალფუნქციური ცენტრები — ინვესტორებთან და პარტნიორებთან წარსადგენად.', 'Offices, hotels, retail and mixed-use centres — built to be presented to investors and partners.', null, 'https://images.unsplash.com/photo-1782879549420-7cd9dc53d334?auto=format&fit=crop&w=1600&q=80', true, 3),
  ('5e000000-0000-4000-8000-000000000004', 'landscape-urban-planning-models', 'ლანდშაფტისა და ქალაქგეგმარების მაკეტები', 'Landscape & Urban Planning Models', 'რელიეფი, გზები, ინფრასტრუქტურა და მიმდებარე განაშენიანება — პროექტი თავის რეალურ კონტექსტში.', 'Terrain, roads, infrastructure and the surrounding fabric — the project shown in its real context.', null, 'https://images.unsplash.com/photo-1672669092491-ac5a210747bc?auto=format&fit=crop&w=1600&q=80', true, 4),
  ('5e000000-0000-4000-8000-000000000005', 'conceptual-architectural-models', 'კონცეპტუალური მაკეტები', 'Conceptual Architectural Models', 'მოცულობითი და სამუშაო მაკეტები ადრეული ეტაპისთვის: ფორმის, მასისა და სივრცის სწრაფი შემოწმება.', 'Massing and study models for early design stages: test form, volume and space quickly.', null, 'https://images.unsplash.com/photo-1653164579768-ea97833b3b03?auto=format&fit=crop&w=1600&q=80', true, 5),
  ('5e000000-0000-4000-8000-000000000006', 'custom-architectural-models', 'ინდივიდუალური შეკვეთები', 'Custom Architectural Models', 'არასტანდარტული ამოცანა? ჭრილები, ცალკეული ფრაგმენტები თუ განსაკუთრებული ფორმატი — ერთად შევარჩევთ საუკეთესო გადაწყვეტას.', 'A non-standard brief? Sections, individual fragments or a special format — we will find the right solution together.', null, 'https://images.unsplash.com/photo-1787742837882-1d32e269aafe?auto=format&fit=crop&w=1600&q=80', true, 6)
on conflict (id) do nothing;

-- Demonstration projects (clearly flagged with is_demo = true)
-- courtyard-residential-quarter
insert into public.projects (id, slug, category_id, status, is_featured, is_demo, sort_order, location_ka, location_en, project_date, scale, materials_ka, materials_en, dimensions, published_at, created_at, updated_at, cover_image_id)
values
  ('d0000000-0000-4000-8000-000000000001', 'courtyard-residential-quarter', 'c0000000-0000-4000-8000-000000000001', 'published', true, true, 1, null, null, null, '1:200', 'მუყაო, ბალზის ხე, ბუნებრივი მცენარეული მასალა', 'Card, balsa wood, natural plant material', '120 × 80 cm', '2026-11-05T00:00:00.000Z', '2026-11-05T00:00:00.000Z', '2026-11-05T00:00:00.000Z', null)
on conflict (id) do nothing;

insert into public.project_translations (project_id, locale, title, short_description, description, seo_title, seo_description)
values
  ('d0000000-0000-4000-8000-000000000001', 'ka', 'საცხოვრებელი კვარტალი ეზოებით', 'დაბალსართულიანი საცხოვრებელი კვარტალი შიდა ეზოებითა და ხეივნებით.', 'კვარტალის მაკეტი აჩვენებს, როგორ ერწყმის საცხოვრებელი კორპუსები გამწვანებულ შიდა ეზოებს. ფასადების ვერტიკალური რიტმი და ხეების მოცულობები ერთად ქმნის მასშტაბის მკაფიო აღქმას.

ეს სადემონსტრაციო პროექტია: ფოტოები ეკუთვნის სხვა ავტორებს (Unsplash) და გამოიყენება მხოლოდ პორტფოლიოს განლაგების საჩვენებლად. ის ჩანაცვლდება სტუდიის რეალური ნამუშევრებით.', null, null),
  ('d0000000-0000-4000-8000-000000000001', 'en', 'Courtyard Residential Quarter', 'A low-rise residential quarter organised around green courtyards and tree-lined paths.', 'The quarter model shows how residential blocks open onto landscaped inner courtyards. The vertical rhythm of the facades and the volumes of the trees together give a clear sense of scale.

This is a demonstration project: the photographs belong to other authors (Unsplash) and are used only to illustrate the portfolio layout. It will be replaced with the studio''s real work.', null, null)
on conflict (project_id, locale) do nothing;

insert into public.project_images (id, project_id, kind, original_path, optimized_path, thumb_path, external_url, width, height, blur_data_url, alt_ka, alt_en, credit, mime_type, size_bytes, sort_order)
values
  ('d1000000-0000-4000-8001-000000000001', 'd0000000-0000-4000-8000-000000000001', 'gallery', null, null, null, 'https://images.unsplash.com/photo-1624066969616-69b0b0301d4d?auto=format&fit=crop&w=2400&q=80', 6000, 4000, null, 'საცხოვრებელი კვარტალის მაკეტი ხეებით', 'Residential quarter model with trees', 'Unsplash', 'image/jpeg', null, 1),
  ('d1000000-0000-4000-8001-000000000002', 'd0000000-0000-4000-8000-000000000001', 'gallery', null, null, null, 'https://images.unsplash.com/photo-1624066969649-fb75b5a7cc97?auto=format&fit=crop&w=2400&q=80', 6000, 4000, null, 'თეთრი მოცულობები და გამწვანება', 'White volumes and landscaping', 'Unsplash', 'image/jpeg', null, 2)
on conflict (id) do nothing;

update public.projects set cover_image_id = 'd1000000-0000-4000-8001-000000000001' where id = 'd0000000-0000-4000-8000-000000000001' and cover_image_id is null;

-- terrace-villa
insert into public.projects (id, slug, category_id, status, is_featured, is_demo, sort_order, location_ka, location_en, project_date, scale, materials_ka, materials_en, dimensions, published_at, created_at, updated_at, cover_image_id)
values
  ('d0000000-0000-4000-8000-000000000002', 'terrace-villa', 'c0000000-0000-4000-8000-000000000001', 'published', true, true, 2, null, null, null, '1:100', 'თეთრი მუყაო, აკრილი, სტრუქტურული პასტა', 'White card, acrylic, texture paste', '45 × 45 cm', '2026-11-05T00:00:00.000Z', '2026-11-05T00:00:00.000Z', '2026-11-05T00:00:00.000Z', null)
on conflict (id) do nothing;

insert into public.project_translations (project_id, locale, title, short_description, description, seo_title, seo_description)
values
  ('d0000000-0000-4000-8000-000000000002', 'ka', 'ვილა ტერასით', 'მინიმალისტური ვილა აუზით, კონსოლური ტერასით და კიბით.', 'მონოქრომული მაკეტი ყურადღებას ამახვილებს ფორმასა და სინათლეზე: კონსოლური მოცულობა, აუზის სიბრტყე და კიბის რიტმი ერთიან კომპოზიციას ქმნის.

ეს სადემონსტრაციო პროექტია: ფოტოები ეკუთვნის სხვა ავტორებს (Unsplash) და გამოიყენება მხოლოდ პორტფოლიოს განლაგების საჩვენებლად. ის ჩანაცვლდება სტუდიის რეალური ნამუშევრებით.', null, null),
  ('d0000000-0000-4000-8000-000000000002', 'en', 'Terrace Villa', 'A minimalist villa with a pool, cantilevered terrace and a sculpted stair.', 'A monochrome model that focuses on form and light: the cantilevered volume, the plane of the pool and the rhythm of the stair read as one composition.

This is a demonstration project: the photographs belong to other authors (Unsplash) and are used only to illustrate the portfolio layout. It will be replaced with the studio''s real work.', null, null)
on conflict (project_id, locale) do nothing;

insert into public.project_images (id, project_id, kind, original_path, optimized_path, thumb_path, external_url, width, height, blur_data_url, alt_ka, alt_en, credit, mime_type, size_bytes, sort_order)
values
  ('d1000000-0000-4000-8002-000000000001', 'd0000000-0000-4000-8000-000000000002', 'gallery', null, null, null, 'https://images.unsplash.com/photo-1653164494885-a8526f62678c?auto=format&fit=crop&w=2400&q=80', 5000, 3333, null, 'ვილის მაკეტი თეთრ ფუძეზე', 'Villa model on a white base', 'Unsplash', 'image/jpeg', null, 1),
  ('d1000000-0000-4000-8002-000000000002', 'd0000000-0000-4000-8000-000000000002', 'gallery', null, null, null, 'https://images.unsplash.com/photo-1653164488636-7407bec89281?auto=format&fit=crop&w=2400&q=80', 5000, 3333, null, 'ვილის ტერასა და აუზი ახლო ხედით', 'Close-up of the villa terrace and pool', 'Unsplash', 'image/jpeg', null, 2)
on conflict (id) do nothing;

update public.projects set cover_image_id = 'd1000000-0000-4000-8002-000000000001' where id = 'd0000000-0000-4000-8000-000000000002' and cover_image_id is null;

-- exhibition-pavilion
insert into public.projects (id, slug, category_id, status, is_featured, is_demo, sort_order, location_ka, location_en, project_date, scale, materials_ka, materials_en, dimensions, published_at, created_at, updated_at, cover_image_id)
values
  ('d0000000-0000-4000-8000-000000000003', 'exhibition-pavilion', 'c0000000-0000-4000-8000-000000000004', 'published', true, true, 3, null, null, null, '1:100', 'აკრილი, ლითონის ღეროები, ხის ფუძე', 'Acrylic, metal rods, timber base', '90 × 60 cm', '2026-11-05T00:00:00.000Z', '2026-11-05T00:00:00.000Z', '2026-11-05T00:00:00.000Z', null)
on conflict (id) do nothing;

insert into public.project_translations (project_id, locale, title, short_description, description, seo_title, seo_description)
values
  ('d0000000-0000-4000-8000-000000000003', 'ka', 'საგამოფენო პავილიონი პარკში', 'ვერტიკალური ელემენტებით შექმნილი მსუბუქი პავილიონი ხეებს შორის.', 'პავილიონის მაკეტი წარმოდგენილია პრეზენტაციისთვის მომზადებულ ფუძეზე. ვერტიკალური ღეროების რიტმი და ხეების სილუეტები სიღრმისა და სიმსუბუქის შეგრძნებას ქმნის.

ეს სადემონსტრაციო პროექტია: ფოტოები ეკუთვნის სხვა ავტორებს (Unsplash) და გამოიყენება მხოლოდ პორტფოლიოს განლაგების საჩვენებლად. ის ჩანაცვლდება სტუდიის რეალური ნამუშევრებით.', null, null),
  ('d0000000-0000-4000-8000-000000000003', 'en', 'Exhibition Pavilion in the Park', 'A light pavilion defined by vertical elements, set among trees.', 'The pavilion is presented on a dedicated exhibition base. The rhythm of the vertical rods and the silhouettes of the trees create a sense of depth and lightness.

This is a demonstration project: the photographs belong to other authors (Unsplash) and are used only to illustrate the portfolio layout. It will be replaced with the studio''s real work.', null, null)
on conflict (project_id, locale) do nothing;

insert into public.project_images (id, project_id, kind, original_path, optimized_path, thumb_path, external_url, width, height, blur_data_url, alt_ka, alt_en, credit, mime_type, size_bytes, sort_order)
values
  ('d1000000-0000-4000-8003-000000000001', 'd0000000-0000-4000-8000-000000000003', 'gallery', null, null, null, 'https://images.unsplash.com/photo-1633355303026-28d096d08c42?auto=format&fit=crop&w=2400&q=80', 3000, 4269, null, 'პავილიონის მაკეტი საგამოფენო მაგიდაზე', 'Pavilion model on an exhibition table', 'Unsplash', 'image/jpeg', null, 1)
on conflict (id) do nothing;

update public.projects set cover_image_id = 'd1000000-0000-4000-8003-000000000001' where id = 'd0000000-0000-4000-8000-000000000003' and cover_image_id is null;

-- neighbourhood-masterplan
insert into public.projects (id, slug, category_id, status, is_featured, is_demo, sort_order, location_ka, location_en, project_date, scale, materials_ka, materials_en, dimensions, published_at, created_at, updated_at, cover_image_id)
values
  ('d0000000-0000-4000-8000-000000000004', 'neighbourhood-masterplan', 'c0000000-0000-4000-8000-000000000003', 'published', true, true, 4, null, null, null, '1:500', 'თეთრი პლასტიკი, მუყაო', 'White plastic, card', '150 × 100 cm', '2026-11-05T00:00:00.000Z', '2026-11-05T00:00:00.000Z', '2026-11-05T00:00:00.000Z', null)
on conflict (id) do nothing;

insert into public.project_translations (project_id, locale, title, short_description, description, seo_title, seo_description)
values
  ('d0000000-0000-4000-8000-000000000004', 'ka', 'უბნის გენერალური გეგმა', 'განაშენიანების მოცულობითი მაკეტი რელიეფით, ქუჩებით და ახალი შენობებით.', 'თეთრი, ერთფეროვანი ურბანული მაკეტი საშუალებას იძლევა, ერთი შეხედვით შეფასდეს ახალი განაშენიანების მასშტაბი და მისი ურთიერთობა არსებულ ქუჩებთან და რელიეფთან.

ეს სადემონსტრაციო პროექტია: ფოტოები ეკუთვნის სხვა ავტორებს (Unsplash) და გამოიყენება მხოლოდ პორტფოლიოს განლაგების საჩვენებლად. ის ჩანაცვლდება სტუდიის რეალური ნამუშევრებით.', null, null),
  ('d0000000-0000-4000-8000-000000000004', 'en', 'Neighbourhood Masterplan', 'A massing model of a neighbourhood with terrain, streets and new buildings.', 'A white, single-colour urban model that makes it possible to assess the scale of new development and its relationship with existing streets and terrain at a glance.

This is a demonstration project: the photographs belong to other authors (Unsplash) and are used only to illustrate the portfolio layout. It will be replaced with the studio''s real work.', null, null)
on conflict (project_id, locale) do nothing;

insert into public.project_images (id, project_id, kind, original_path, optimized_path, thumb_path, external_url, width, height, blur_data_url, alt_ka, alt_en, credit, mime_type, size_bytes, sort_order)
values
  ('d1000000-0000-4000-8004-000000000001', 'd0000000-0000-4000-8000-000000000004', 'gallery', null, null, null, 'https://images.unsplash.com/photo-1672669092491-ac5a210747bc?auto=format&fit=crop&w=2400&q=80', 6000, 4000, null, 'თეთრი ურბანული მაკეტი', 'White urban massing model', 'Unsplash', 'image/jpeg', null, 1)
on conflict (id) do nothing;

update public.projects set cover_image_id = 'd1000000-0000-4000-8004-000000000001' where id = 'd0000000-0000-4000-8000-000000000004' and cover_image_id is null;

-- civic-centre-exhibition-model
insert into public.projects (id, slug, category_id, status, is_featured, is_demo, sort_order, location_ka, location_en, project_date, scale, materials_ka, materials_en, dimensions, published_at, created_at, updated_at, cover_image_id)
values
  ('d0000000-0000-4000-8000-000000000005', 'civic-centre-exhibition-model', 'c0000000-0000-4000-8000-000000000003', 'published', false, true, 5, null, null, null, '1:500', 'პლასტიკი, ხელოვნური ბალახი, აკრილი', 'Plastic, artificial grass, acrylic', '200 × 120 cm', '2026-11-05T00:00:00.000Z', '2026-11-05T00:00:00.000Z', '2026-11-05T00:00:00.000Z', null)
on conflict (id) do nothing;

insert into public.project_translations (project_id, locale, title, short_description, description, seo_title, seo_description)
values
  ('d0000000-0000-4000-8000-000000000005', 'ka', 'საზოგადოებრივი ცენტრის საგამოფენო მაკეტი', 'ტერიტორიის მაკეტი გამწვანებით, ავტოსადგომითა და საფეხმავლო ზონებით.', 'საგამოფენო მაკეტი აჩვენებს კომპლექსს მთლიან ტერიტორიაზე: გამწვანებას, გზებს, ავტოსადგომსა და საფეხმავლო ზონებს. ის გამოფენის სივრცეში დგას და ვიზიტორებს პროექტის ლოგიკას უხსნის.

ეს სადემონსტრაციო პროექტია: ფოტოები ეკუთვნის სხვა ავტორებს (Unsplash) და გამოიყენება მხოლოდ პორტფოლიოს განლაგების საჩვენებლად. ის ჩანაცვლდება სტუდიის რეალური ნამუშევრებით.', null, null),
  ('d0000000-0000-4000-8000-000000000005', 'en', 'Civic Centre Exhibition Model', 'A site model with landscaping, parking and pedestrian areas.', 'The exhibition model presents the complex across the entire site: landscaping, roads, parking and pedestrian zones. It stands in a gallery space and explains the logic of the project to visitors.

This is a demonstration project: the photographs belong to other authors (Unsplash) and are used only to illustrate the portfolio layout. It will be replaced with the studio''s real work.', null, null)
on conflict (project_id, locale) do nothing;

insert into public.project_images (id, project_id, kind, original_path, optimized_path, thumb_path, external_url, width, height, blur_data_url, alt_ka, alt_en, credit, mime_type, size_bytes, sort_order)
values
  ('d1000000-0000-4000-8005-000000000001', 'd0000000-0000-4000-8000-000000000005', 'gallery', null, null, null, 'https://images.unsplash.com/photo-1771344163986-5219fb12005b?auto=format&fit=crop&w=2400&q=80', 4000, 6000, null, 'საზოგადოებრივი ცენტრის მაკეტი გამოფენაზე', 'Civic centre model in an exhibition', 'Unsplash', 'image/jpeg', null, 1)
on conflict (id) do nothing;

update public.projects set cover_image_id = 'd1000000-0000-4000-8005-000000000001' where id = 'd0000000-0000-4000-8000-000000000005' and cover_image_id is null;

-- cultural-centre-competition-model
insert into public.projects (id, slug, category_id, status, is_featured, is_demo, sort_order, location_ka, location_en, project_date, scale, materials_ka, materials_en, dimensions, published_at, created_at, updated_at, cover_image_id)
values
  ('d0000000-0000-4000-8000-000000000006', 'cultural-centre-competition-model', 'c0000000-0000-4000-8000-000000000004', 'published', true, true, 6, null, null, null, '1:200', 'თეთრი მუყაო, აკრილი', 'White card, acrylic', '100 × 70 cm', '2026-11-05T00:00:00.000Z', '2026-11-05T00:00:00.000Z', '2026-11-05T00:00:00.000Z', null)
on conflict (id) do nothing;

insert into public.project_translations (project_id, locale, title, short_description, description, seo_title, seo_description)
values
  ('d0000000-0000-4000-8000-000000000006', 'ka', 'კულტურის ცენტრი — საკონკურსო მაკეტი', 'საკონკურსო მაკეტი, რომელიც პროექტის ნახაზებთან ერთად არის წარმოდგენილი.', 'თეთრი მაკეტი ნახაზების ფონზე ქმნის მკაფიო, აკადემიურ პრეზენტაციას: მოცულობები, ტერასები და ღია სივრცეები ზუსტად იკითხება.

ეს სადემონსტრაციო პროექტია: ფოტოები ეკუთვნის სხვა ავტორებს (Unsplash) და გამოიყენება მხოლოდ პორტფოლიოს განლაგების საჩვენებლად. ის ჩანაცვლდება სტუდიის რეალური ნამუშევრებით.', null, null),
  ('d0000000-0000-4000-8000-000000000006', 'en', 'Cultural Centre — Competition Model', 'A competition model presented together with the project drawings.', 'Set against the drawings, the white model creates a clear, academic presentation: volumes, terraces and open spaces read precisely.

This is a demonstration project: the photographs belong to other authors (Unsplash) and are used only to illustrate the portfolio layout. It will be replaced with the studio''s real work.', null, null)
on conflict (project_id, locale) do nothing;

insert into public.project_images (id, project_id, kind, original_path, optimized_path, thumb_path, external_url, width, height, blur_data_url, alt_ka, alt_en, credit, mime_type, size_bytes, sort_order)
values
  ('d1000000-0000-4000-8006-000000000001', 'd0000000-0000-4000-8000-000000000006', 'gallery', null, null, null, 'https://images.unsplash.com/photo-1782879549420-7cd9dc53d334?auto=format&fit=crop&w=2400&q=80', 6000, 3800, null, 'კულტურის ცენტრის მაკეტი ნახაზების ფონზე', 'Cultural centre model in front of drawings', 'Unsplash', 'image/jpeg', null, 1)
on conflict (id) do nothing;

update public.projects set cover_image_id = 'd1000000-0000-4000-8006-000000000001' where id = 'd0000000-0000-4000-8000-000000000006' and cover_image_id is null;

-- domed-hall-section
insert into public.projects (id, slug, category_id, status, is_featured, is_demo, sort_order, location_ka, location_en, project_date, scale, materials_ka, materials_en, dimensions, published_at, created_at, updated_at, cover_image_id)
values
  ('d0000000-0000-4000-8000-000000000007', 'domed-hall-section', 'c0000000-0000-4000-8000-000000000004', 'published', false, true, 7, null, null, null, '1:100', 'ხე, მუყაო, მასშტაბური ფიგურები', 'Wood, card, scale figures', '80 × 80 cm', '2026-11-05T00:00:00.000Z', '2026-11-05T00:00:00.000Z', '2026-11-05T00:00:00.000Z', null)
on conflict (id) do nothing;

insert into public.project_translations (project_id, locale, title, short_description, description, seo_title, seo_description)
values
  ('d0000000-0000-4000-8000-000000000007', 'ka', 'გუმბათოვანი დარბაზის ჭრილი', 'ჭრილის მაკეტი, რომელიც დარბაზის შიდა სივრცესა და კონსტრუქციას აჩვენებს.', 'ჭრილის მაკეტი ხსნის შენობას და აჩვენებს მის შიდა სივრცეს, გუმბათის კონსტრუქციასა და იარუსებს. მასშტაბური ფიგურები ზომის აღქმას ეხმარება.

ეს სადემონსტრაციო პროექტია: ფოტოები ეკუთვნის სხვა ავტორებს (Unsplash) და გამოიყენება მხოლოდ პორტფოლიოს განლაგების საჩვენებლად. ის ჩანაცვლდება სტუდიის რეალური ნამუშევრებით.', null, null),
  ('d0000000-0000-4000-8000-000000000007', 'en', 'Domed Hall Section', 'A sectional model revealing the interior space and structure of a hall.', 'The sectional model opens up the building to reveal its interior, the structure of the dome and the tiers. Scale figures help read the size of the space.

This is a demonstration project: the photographs belong to other authors (Unsplash) and are used only to illustrate the portfolio layout. It will be replaced with the studio''s real work.', null, null)
on conflict (project_id, locale) do nothing;

insert into public.project_images (id, project_id, kind, original_path, optimized_path, thumb_path, external_url, width, height, blur_data_url, alt_ka, alt_en, credit, mime_type, size_bytes, sort_order)
values
  ('d1000000-0000-4000-8007-000000000001', 'd0000000-0000-4000-8000-000000000007', 'gallery', null, null, null, 'https://images.unsplash.com/photo-1787742837882-1d32e269aafe?auto=format&fit=crop&w=2400&q=80', 6000, 4000, null, 'გუმბათოვანი დარბაზის ჭრილის მაკეტი', 'Sectional model of a domed hall', 'Unsplash', 'image/jpeg', null, 1)
on conflict (id) do nothing;

update public.projects set cover_image_id = 'd1000000-0000-4000-8007-000000000001' where id = 'd0000000-0000-4000-8000-000000000007' and cover_image_id is null;

-- office-frame-study
insert into public.projects (id, slug, category_id, status, is_featured, is_demo, sort_order, location_ka, location_en, project_date, scale, materials_ka, materials_en, dimensions, published_at, created_at, updated_at, cover_image_id)
values
  ('d0000000-0000-4000-8000-000000000008', 'office-frame-study', 'c0000000-0000-4000-8000-000000000002', 'published', false, true, 8, null, null, null, '1:50', 'მუყაო, ბალზის ხე', 'Card, balsa wood', '60 × 40 cm', '2026-11-05T00:00:00.000Z', '2026-11-05T00:00:00.000Z', '2026-11-05T00:00:00.000Z', null)
on conflict (id) do nothing;

insert into public.project_translations (project_id, locale, title, short_description, description, seo_title, seo_description)
values
  ('d0000000-0000-4000-8000-000000000008', 'ka', 'საოფისე შენობის კარკასი', 'სართულშუა გადახურვებისა და სვეტების კვლევითი მაკეტი.', 'დიდი მასშტაბის მაკეტი ყურადღებას ამახვილებს კონსტრუქციულ ლოგიკაზე: გადახურვების ფენები, სვეტების ბადე და ფასადის ღრმა რიტმი.

ეს სადემონსტრაციო პროექტია: ფოტოები ეკუთვნის სხვა ავტორებს (Unsplash) და გამოიყენება მხოლოდ პორტფოლიოს განლაგების საჩვენებლად. ის ჩანაცვლდება სტუდიის რეალური ნამუშევრებით.', null, null),
  ('d0000000-0000-4000-8000-000000000008', 'en', 'Office Building Frame', 'A study model of floor slabs and columns.', 'A large-scale model that focuses on the structural logic: layered floor slabs, the column grid and the deep rhythm of the facade.

This is a demonstration project: the photographs belong to other authors (Unsplash) and are used only to illustrate the portfolio layout. It will be replaced with the studio''s real work.', null, null)
on conflict (project_id, locale) do nothing;

insert into public.project_images (id, project_id, kind, original_path, optimized_path, thumb_path, external_url, width, height, blur_data_url, alt_ka, alt_en, credit, mime_type, size_bytes, sort_order)
values
  ('d1000000-0000-4000-8008-000000000001', 'd0000000-0000-4000-8000-000000000008', 'gallery', null, null, null, 'https://images.unsplash.com/photo-1730407816975-abb38158bc1e?auto=format&fit=crop&w=2400&q=80', 3000, 5333, null, 'საოფისე შენობის სართულები ახლო ხედით', 'Close-up of office building floors', 'Unsplash', 'image/jpeg', null, 1),
  ('d1000000-0000-4000-8008-000000000002', 'd0000000-0000-4000-8000-000000000008', 'gallery', null, null, null, 'https://images.unsplash.com/photo-1631454965644-00510875561f?auto=format&fit=crop&w=2400&q=80', 6000, 4000, null, 'კონსტრუქციული ჭრილის მაკეტი', 'Structural section model', 'Unsplash', 'image/jpeg', null, 2)
on conflict (id) do nothing;

update public.projects set cover_image_id = 'd1000000-0000-4000-8008-000000000001' where id = 'd0000000-0000-4000-8000-000000000008' and cover_image_id is null;

-- arcade-concept
insert into public.projects (id, slug, category_id, status, is_featured, is_demo, sort_order, location_ka, location_en, project_date, scale, materials_ka, materials_en, dimensions, published_at, created_at, updated_at, cover_image_id)
values
  ('d0000000-0000-4000-8000-000000000009', 'arcade-concept', 'c0000000-0000-4000-8000-000000000005', 'published', false, true, 9, null, null, null, '1:200', 'თეთრი თაბაშირი', 'White plaster', '30 × 20 cm', '2026-11-05T00:00:00.000Z', '2026-11-05T00:00:00.000Z', '2026-11-05T00:00:00.000Z', null)
on conflict (id) do nothing;

insert into public.project_translations (project_id, locale, title, short_description, description, seo_title, seo_description)
values
  ('d0000000-0000-4000-8000-000000000009', 'ka', 'არკადის კონცეფცია', 'მოცულობითი კვლევა თაღებით და საფეხურებიანი სილუეტით.', 'კონცეპტუალური მაკეტი ამოწმებს მასის, სინათლისა და ჩრდილის ურთიერთობას. მცირე ფიგურები მაშინვე განსაზღვრავს მასშტაბს.

ეს სადემონსტრაციო პროექტია: ფოტოები ეკუთვნის სხვა ავტორებს (Unsplash) და გამოიყენება მხოლოდ პორტფოლიოს განლაგების საჩვენებლად. ის ჩანაცვლდება სტუდიის რეალური ნამუშევრებით.', null, null),
  ('d0000000-0000-4000-8000-000000000009', 'en', 'Arcade Concept', 'A massing study with arches and a stepped silhouette.', 'A conceptual model testing the relationship between mass, light and shadow. Small figures immediately establish the scale.

This is a demonstration project: the photographs belong to other authors (Unsplash) and are used only to illustrate the portfolio layout. It will be replaced with the studio''s real work.', null, null)
on conflict (project_id, locale) do nothing;

insert into public.project_images (id, project_id, kind, original_path, optimized_path, thumb_path, external_url, width, height, blur_data_url, alt_ka, alt_en, credit, mime_type, size_bytes, sort_order)
values
  ('d1000000-0000-4000-8009-000000000001', 'd0000000-0000-4000-8000-000000000009', 'gallery', null, null, null, 'https://images.unsplash.com/photo-1653164579768-ea97833b3b03?auto=format&fit=crop&w=2400&q=80', 6000, 4000, null, 'თაღოვანი კონცეპტუალური მაკეტი', 'Arched conceptual model', 'Unsplash', 'image/jpeg', null, 1)
on conflict (id) do nothing;

update public.projects set cover_image_id = 'd1000000-0000-4000-8009-000000000001' where id = 'd0000000-0000-4000-8000-000000000009' and cover_image_id is null;

commit;
