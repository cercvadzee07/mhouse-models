import { localePath, pick, type Locale } from "@/i18n/config";
import type { Project } from "@/lib/types";
import { coverImage, translation } from "@/lib/data/project-helpers";
import { imageSrc } from "@/lib/storage";

export interface CardData {
  id: string;
  href: string;
  title: string;
  short: string;
  category: string;
  categorySlug: string | null;
  scale: string | null;
  year: string | null;
  isDemo: boolean;
  featured: boolean;
  has3d: boolean;
  image: { src: string; width: number; height: number; alt: string; blur: string | null } | null;
}

export function toCardData(p: Project, locale: Locale): CardData {
  const t = translation(p, locale);
  const cover = coverImage(p);
  const src = imageSrc(cover);
  return {
    id: p.id,
    href: localePath(locale, `/projects/${p.slug}`),
    title: t.title,
    short: t.short_description,
    category: p.category ? pick(p.category, "name", locale) : "",
    categorySlug: p.category?.slug ?? null,
    scale: p.scale,
    year: p.project_date ? p.project_date.slice(0, 4) : null,
    isDemo: p.is_demo,
    featured: p.is_featured,
    has3d: p.models.some((m) => m.display_status === "ready"),
    image:
      cover && src
        ? {
            src,
            width: cover.width ?? 1600,
            height: cover.height ?? 1200,
            alt: pick(cover, "alt", locale) || t.title,
            blur: cover.blur_data_url,
          }
        : null,
  };
}
