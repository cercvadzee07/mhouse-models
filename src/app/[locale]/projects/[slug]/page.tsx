import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { isLocale, localePath, type Locale } from "@/i18n/config";
import { getDictionary } from "@/i18n/get-dictionary";
import { getPublishedProject, getPublishedProjects, getSiteContent } from "@/lib/data/public";
import { coverImage, translation } from "@/lib/data/project-helpers";
import { imageSrc } from "@/lib/storage";
import { buildMetadata } from "@/lib/seo";
import { ProjectDetail } from "@/components/site/project/ProjectDetail";

// Cached as static HTML; CMS actions purge the cache immediately (revalidatePath).
export const revalidate = 300;

export const dynamicParams = true;

export async function generateStaticParams() {
  const projects = await getPublishedProjects();
  return projects.map((p) => ({ slug: p.slug }));
}

type Params = Promise<{ locale: string; slug: string }>;

export async function generateMetadata({ params }: { params: Params }): Promise<Metadata> {
  const { locale: raw, slug } = await params;
  const locale = (isLocale(raw) ? raw : "ka") as Locale;
  const [content, project] = await Promise.all([getSiteContent(), getPublishedProject(slug)]);
  if (!project) return { title: getDictionary(locale).project.notFound, robots: { index: false } };
  const tr = translation(project, locale);
  return buildMetadata({
    content,
    locale,
    path: `/projects/${project.slug}`,
    title: tr.seo_title || `${tr.title} — ${content.general.studio_name}`,
    description: tr.seo_description || tr.short_description,
    image: imageSrc(coverImage(project)),
    type: "article",
  });
}

export default async function ProjectPage({ params }: { params: Params }) {
  const { locale: raw, slug } = await params;
  const locale = (isLocale(raw) ? raw : "ka") as Locale;
  const [content, project, all] = await Promise.all([getSiteContent(), getPublishedProject(slug), getPublishedProjects()]);
  if (!project) notFound();

  const t = getDictionary(locale);
  const i = all.findIndex((p) => p.id === project.id);
  const link = (p: (typeof all)[number] | undefined) =>
    p ? { href: localePath(locale, `/projects/${p.slug}`), title: translation(p, locale).title } : null;
  const neighbours = all.length > 1 ? { prev: link(all[(i - 1 + all.length) % all.length]), next: link(all[(i + 1) % all.length]) } : undefined;

  return <ProjectDetail project={project} locale={locale} t={t} neighbours={neighbours} showDemo={content.general.show_demo_badges} />;
}
