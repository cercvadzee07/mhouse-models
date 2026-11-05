import type { MetadataRoute } from "next";
import { localePath, locales } from "@/i18n/config";
import { getPublishedProjects } from "@/lib/data/public";
import { absoluteUrl } from "@/lib/seo";
import { accessPassword } from "@/lib/site-access";

export const dynamic = "force-dynamic";

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  // Private preview: publish no URLs.
  if (accessPassword()) return [];
  const projects = await getPublishedProjects();
  const entry = (path: string, lastModified?: string, priority = 0.7): MetadataRoute.Sitemap[number] => ({
    url: absoluteUrl(localePath("ka", path)),
    lastModified: lastModified ? new Date(lastModified) : new Date(),
    priority,
    alternates: { languages: Object.fromEntries(locales.map((l) => [l, absoluteUrl(localePath(l, path))])) },
  });
  return [
    entry("/", undefined, 1),
    entry("/projects", undefined, 0.9),
    ...projects.map((p) => entry(`/projects/${p.slug}`, p.updated_at, 0.8)),
  ];
}
