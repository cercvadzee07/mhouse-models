import type { Locale } from "@/i18n/config";
import type { Project, ProjectImage, ProjectTranslation } from "@/lib/types";

// projects ↔ project_images has two relationships (gallery rows + cover_image_id),
// so the embed must name the foreign key explicitly.
export const PROJECT_SELECT =
  "*, category:project_categories(*), translations:project_translations(*), images:project_images!project_images_project_id_fkey(*), videos:project_videos(*), models:project_models(*)";

export function translation(project: Pick<Project, "translations">, locale: Locale): ProjectTranslation {
  const t = project.translations.find((x) => x.locale === locale);
  const other = project.translations.find((x) => x.locale !== locale);
  const empty: ProjectTranslation = {
    locale,
    title: "",
    short_description: "",
    description: "",
    seo_title: null,
    seo_description: null,
  };
  const base = t ?? other ?? empty;
  // Fall back field-by-field to the other language when a translation is incomplete.
  return {
    ...base,
    title: t?.title?.trim() ? t.title : other?.title ?? "",
    short_description: t?.short_description?.trim() ? t.short_description : other?.short_description ?? "",
    description: t?.description?.trim() ? t.description : other?.description ?? "",
  };
}

export function sortProject(p: Project): Project {
  const byOrder = <T extends { sort_order: number }>(a: T, b: T) => a.sort_order - b.sort_order;
  return {
    ...p,
    translations: p.translations ?? [],
    images: [...(p.images ?? [])].sort(byOrder),
    videos: [...(p.videos ?? [])].sort(byOrder),
    models: [...(p.models ?? [])].sort((a, b) => Number(b.is_primary) - Number(a.is_primary) || a.sort_order - b.sort_order),
  };
}

export function coverImage(project: Pick<Project, "images" | "cover_image_id">): ProjectImage | null {
  const gallery = project.images.filter((i) => i.kind === "gallery");
  return (
    project.images.find((i) => i.id === project.cover_image_id) ??
    gallery[0] ??
    project.images[0] ??
    null
  );
}

export function galleryImages(project: Pick<Project, "images">) {
  return project.images.filter((i) => i.kind === "gallery");
}

export function productionImages(project: Pick<Project, "images">) {
  return project.images.filter((i) => i.kind === "production");
}

export function primaryModel(project: Pick<Project, "models">) {
  return project.models.find((m) => m.display_status === "ready" && m.display_path) ?? null;
}

export function formatProjectDate(date: string | null, locale: Locale): string | null {
  if (!date) return null;
  const d = new Date(date);
  if (Number.isNaN(d.getTime())) return null;
  return new Intl.DateTimeFormat(locale === "ka" ? "ka-GE" : "en-GB", { year: "numeric", month: "long" }).format(d);
}
