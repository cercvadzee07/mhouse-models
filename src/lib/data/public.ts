import "server-only";
import { cache } from "react";
import { getPublicClient } from "@/lib/supabase/public";
import {
  defaultCategories,
  defaultContact,
  defaultGeneral,
  defaultHomepage,
  defaultProjects,
  defaultSeo,
  defaultServices,
  defaultStudio,
} from "@/content/defaults";
import type { Category, Project, ProjectModel, Service, SiteContent, SeoSetting } from "@/lib/types";
import { PROJECT_SELECT, sortProject } from "./project-helpers";

/** True when the site runs without a database (local preview). */
export function isPreviewMode() {
  return getPublicClient() === null;
}

function merge<T extends object>(defaults: T, row: Partial<T> | null | undefined): T {
  if (!row) return defaults;
  const out = { ...defaults } as Record<string, unknown>;
  for (const [k, v] of Object.entries(row)) {
    if (k in defaults && v !== null && v !== undefined) out[k] = v;
  }
  return out as T;
}

export const getSiteContent = cache(async (): Promise<SiteContent> => {
  const sb = getPublicClient();
  if (!sb) {
    return { homepage: defaultHomepage, studio: defaultStudio, contact: defaultContact, general: defaultGeneral, seo: defaultSeo };
  }
  const [home, studio, contact, general, seo] = await Promise.all([
    sb.from("homepage_content").select("*").eq("id", 1).maybeSingle(),
    sb.from("studio_info").select("*").eq("id", 1).maybeSingle(),
    sb.from("public_contact_settings").select("*").eq("id", 1).maybeSingle(),
    sb.from("general_settings").select("*").eq("id", 1).maybeSingle(),
    sb.from("seo_settings").select("*"),
  ]);
  for (const r of [home, studio, contact, general, seo]) {
    if (r.error) console.error("[content] failed to load site content:", r.error.message);
  }
  const seoRows = (seo.data ?? []) as SeoSetting[];
  return {
    homepage: merge(defaultHomepage, home.data),
    studio: merge(defaultStudio, studio.data),
    // Contact details are never filled from defaults once a database exists.
    contact: contact.data ? merge({ ...defaultContact, tiktok_url: null }, contact.data) : defaultContact,
    general: merge(defaultGeneral, general.data),
    seo: defaultSeo.map((d) => merge(d, seoRows.find((r) => r.page_key === d.page_key))),
  };
});

export const getCategories = cache(async (): Promise<Category[]> => {
  const sb = getPublicClient();
  if (!sb) return defaultCategories;
  const { data, error } = await sb.from("project_categories").select("*").order("sort_order");
  if (error) {
    console.error("[content] categories:", error.message);
    return [];
  }
  return data as Category[];
});

export const getServices = cache(async (): Promise<Service[]> => {
  const sb = getPublicClient();
  if (!sb) return defaultServices;
  const { data, error } = await sb.from("services").select("*").eq("is_visible", true).order("sort_order");
  if (error) {
    console.error("[content] services:", error.message);
    return [];
  }
  return data as Service[];
});

export const getPublishedProjects = cache(async (): Promise<Project[]> => {
  const sb = getPublicClient();
  if (!sb) return defaultProjects.map(sortProject);
  const { data, error } = await sb
    .from("projects")
    .select(PROJECT_SELECT)
    .eq("status", "published")
    .order("sort_order", { ascending: true })
    .order("published_at", { ascending: false });
  if (error) {
    console.error("[content] projects:", error.message);
    return [];
  }
  return (data as Project[]).map(sortProject);
});

export const getPublishedProject = cache(async (slug: string): Promise<Project | null> => {
  const sb = getPublicClient();
  if (!sb) return defaultProjects.map(sortProject).find((p) => p.slug === slug) ?? null;
  const { data, error } = await sb
    .from("projects")
    .select(PROJECT_SELECT)
    .eq("status", "published")
    .eq("slug", slug)
    .maybeSingle();
  if (error) {
    console.error("[content] project:", error.message);
    return null;
  }
  return data ? sortProject(data as Project) : null;
});

/** A ready 3D model chosen for the hero (only from published projects, enforced by RLS). */
export const getHeroModel = cache(async (id: string | null): Promise<ProjectModel | null> => {
  const sb = getPublicClient();
  if (!sb || !id) return null;
  const { data } = await sb.from("project_models").select("*").eq("id", id).eq("display_status", "ready").maybeSingle();
  return (data as ProjectModel) ?? null;
});
