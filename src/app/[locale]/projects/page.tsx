import type { Metadata } from "next";
import { isLocale, pick, type Locale } from "@/i18n/config";
import { getDictionary } from "@/i18n/get-dictionary";
import { getCategories, getPublishedProjects, getSiteContent } from "@/lib/data/public";
import { buildMetadata } from "@/lib/seo";
import { PortfolioGrid } from "@/components/site/portfolio/PortfolioGrid";
import { toCardData } from "@/components/site/portfolio/card-data";
import { Reveal } from "@/components/site/Reveal";
import { SectionLabel } from "@/components/site/SectionLabel";

// Cached as static HTML; CMS actions purge the cache immediately (revalidatePath).
export const revalidate = 300;

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  const { locale } = await params;
  const content = await getSiteContent();
  return buildMetadata({ content, locale: isLocale(locale) ? locale : "ka", pageKey: "projects", path: "/projects" });
}

export default async function ProjectsPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale: raw } = await params;
  const locale = (isLocale(raw) ? raw : "ka") as Locale;
  const t = getDictionary(locale);
  const [content, projects, categories] = await Promise.all([getSiteContent(), getPublishedProjects(), getCategories()]);

  return (
    <section className="pb-28 pt-[calc(var(--header-h)+4rem)] md:pt-[calc(var(--header-h)+6rem)]">
      <div className="container-x">
        <div className="grid-12 gap-y-6">
          <div className="col-span-12 md:col-span-8">
            <SectionLabel index="03" label={t.work.label} />
            <Reveal>
              <h1 className="display-xl mt-8">{t.work.title}</h1>
            </Reveal>
          </div>
          <Reveal className="col-span-12 self-end md:col-span-4" delay={0.1}>
            <p className="lead text-graphite">{t.work.intro}</p>
          </Reveal>
        </div>
        <div className="mt-16 md:mt-24">
          <PortfolioGrid
            cards={projects.map((p) => toCardData(p, locale))}
            filters={categories.map((c) => ({ slug: c.slug, label: pick(c, "name", locale) }))}
            showDemo={content.general.show_demo_badges}
            labels={{
              all: t.work.all,
              filterLabel: t.work.filterLabel,
              empty: t.work.empty,
              emptyAll: t.work.emptyAll,
              demo: t.work.demo,
              view: t.work.view,
              model3d: t.project.model3d,
              count: t.work.count,
            }}
          />
        </div>
      </div>
    </section>
  );
}
