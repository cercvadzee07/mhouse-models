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
