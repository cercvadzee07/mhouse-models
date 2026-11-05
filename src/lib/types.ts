import type { Locale } from "@/i18n/config";

export type ProjectStatus = "draft" | "published";
export type ImageKind = "gallery" | "production";
export type VideoKind = "finished" | "production" | "behind_the_scenes" | "walkthrough" | "detail";
export type ModelFormat = "glb" | "gltf" | "obj" | "fbx" | "stl" | "3mf";

export interface Category {
  id: string;
  slug: string;
  name_ka: string;
  name_en: string;
  sort_order: number;
}

export interface ProjectTranslation {
  id?: string;
  project_id?: string;
  locale: Locale;
  title: string;
  short_description: string;
  description: string;
  seo_title: string | null;
  seo_description: string | null;
}

export interface ProjectImage {
  id: string;
  project_id: string;
  kind: ImageKind;
  original_path: string | null;
  optimized_path: string | null;
  thumb_path: string | null;
  external_url: string | null;
  width: number | null;
  height: number | null;
  blur_data_url: string | null;
  alt_ka: string;
  alt_en: string;
  credit: string | null;
  mime_type: string | null;
  size_bytes: number | null;
  sort_order: number;
}

export interface ProjectVideo {
  id: string;
  project_id: string;
  kind: VideoKind;
  source: "upload" | "external";
  storage_path: string | null;
  external_url: string | null;
  poster_path: string | null;
  caption_ka: string;
  caption_en: string;
  mime_type: string | null;
  size_bytes: number | null;
  duration_seconds: number | null;
  width: number | null;
  height: number | null;
  sort_order: number;
}

export interface ProjectModel {
  id: string;
  project_id: string;
  label_ka: string;
  label_en: string;
  original_path: string;
  original_bucket: "originals" | "media";
  original_name: string;
  original_format: ModelFormat;
  original_size: number | null;
  display_path: string | null;
  display_size: number | null;
  display_status: "ready" | "pending" | "failed";
  status_message: string | null;
  triangle_count: number | null;
  is_primary: boolean;
  sort_order: number;
  created_at?: string;
}

export interface ProjectRow {
  id: string;
  slug: string;
  category_id: string | null;
  status: ProjectStatus;
  is_featured: boolean;
  is_demo: boolean;
  sort_order: number;
  location_ka: string | null;
  location_en: string | null;
  project_date: string | null;
  scale: string | null;
  materials_ka: string | null;
  materials_en: string | null;
  dimensions: string | null;
  cover_image_id: string | null;
  published_at: string | null;
  created_at: string;
  updated_at: string;
}

/** A fully loaded project as used by the public site and admin editor. */
export interface Project extends ProjectRow {
  category: Category | null;
  translations: ProjectTranslation[];
  images: ProjectImage[];
  videos: ProjectVideo[];
  models: ProjectModel[];
}

export interface Service {
  id: string;
  slug: string;
  title_ka: string;
  title_en: string;
  description_ka: string;
  description_en: string;
  image_path: string | null;
  image_external_url: string | null;
  is_visible: boolean;
  sort_order: number;
}

export interface HomepageContent {
  eyebrow_ka: string;
  eyebrow_en: string;
  headline_ka: string;
  headline_en: string;
  subheadline_ka: string;
  subheadline_en: string;
  cta_primary_ka: string;
  cta_primary_en: string;
  cta_secondary_ka: string;
  cta_secondary_en: string;
  hero_mode: "procedural" | "model" | "image";
  hero_model_id: string | null;
  hero_image_path: string | null;
  hero_auto_rotate: boolean;
  hero_evening_lights: boolean;
  why_title_ka: string;
  why_title_en: string;
}

export interface Principle {
  title_ka: string;
  title_en: string;
  body_ka: string;
  body_en: string;
}

export interface StudioInfo {
  about_title_ka: string;
  about_title_en: string;
  about_body_ka: string;
  about_body_en: string;
  description_ka: string;
  description_en: string;
  principles: Principle[];
  studio_image_path: string | null;
}

export interface ContactSettings {
  email: string | null;
  phone: string | null;
  whatsapp: string | null;
  instagram_url: string | null;
  tiktok_url: string | null;
  facebook_url: string | null;
  linkedin_url: string | null;
  address_ka: string | null;
  address_en: string | null;
  show_address: boolean;
  notify_email?: string | null;
}

export interface GeneralSettings {
  studio_name: string;
  studio_name_short: string;
  wordmark_suffix: string;
  show_demo_badges: boolean;
}

export interface SeoSetting {
  page_key: "home" | "projects" | "default";
  title_ka: string;
  title_en: string;
  description_ka: string;
  description_en: string;
  og_image_path: string | null;
}

export interface SiteContent {
  homepage: HomepageContent;
  studio: StudioInfo;
  contact: ContactSettings;
  general: GeneralSettings;
  seo: SeoSetting[];
}
