import type { Metadata } from "next";
import { isLocale, type Locale } from "@/i18n/config";
import { getDictionary } from "@/i18n/get-dictionary";
import { getHeroModel, getPublishedProjects, getServices, getSiteContent } from "@/lib/data/public";
import { isSupabaseConfigured } from "@/lib/env";
import { buildMetadata } from "@/lib/seo";
import { Hero } from "@/components/site/sections/Hero";
import { Studio } from "@/components/site/sections/Studio";
import { Services } from "@/components/site/sections/Services";
import { FeaturedWork } from "@/components/site/sections/FeaturedWork";
import { Why } from "@/components/site/sections/Why";
import { Process } from "@/components/site/sections/Process";
import { Contact } from "@/components/site/sections/Contact";

// Cached as static HTML; CMS actions purge the cache immediately (revalidatePath).
export const revalidate = 300;

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  const { locale } = await params;
  const content = await getSiteContent();
  return buildMetadata({ content, locale: isLocale(locale) ? locale : "ka", pageKey: "home", path: "/" });
}

export default async function HomePage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale: raw } = await params;
  const locale = (isLocale(raw) ? raw : "ka") as Locale;
  const t = getDictionary(locale);
  const [content, services, projects] = await Promise.all([getSiteContent(), getServices(), getPublishedProjects()]);
  const heroModel = content.homepage.hero_mode === "model" ? await getHeroModel(content.homepage.hero_model_id) : null;

  return (
    <>
      <Hero locale={locale} t={t} home={content.homepage} heroModel={heroModel} />
      <Studio locale={locale} t={t} studio={content.studio} />
      <Services locale={locale} t={t} services={services} />
      <FeaturedWork locale={locale} t={t} projects={projects} showDemo={content.general.show_demo_badges} />
      <Why locale={locale} t={t} home={content.homepage} />
      <Process t={{ process: t.process }} />
      <Contact locale={locale} t={t} contact={content.contact} configured={isSupabaseConfigured()} />
    </>
  );
}
