import type { Metadata, Viewport } from "next";
import { notFound } from "next/navigation";
import "../globals.css";
import { fontVariables } from "../fonts";
import { isLocale, localeLabels, locales, type Locale } from "@/i18n/config";
import { getDictionary } from "@/i18n/get-dictionary";
import { getPublishedProjects, getSiteContent } from "@/lib/data/public";
import { env } from "@/lib/env";
import { Header } from "@/components/site/Header";
import { Footer } from "@/components/site/Footer";

export const revalidate = 300;
export const dynamicParams = false;

export function generateStaticParams() {
  return locales.map((locale) => ({ locale }));
}

export const viewport: Viewport = {
  themeColor: "#f4f1eb",
  width: "device-width",
  initialScale: 1,
};

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  const { locale } = await params;
  const content = await getSiteContent();
  return {
    metadataBase: new URL(env.siteUrl),
    applicationName: content.general.studio_name,
    title: { default: content.general.studio_name, template: `%s — ${content.general.studio_name}` },
    robots: { index: true, follow: true },
    formatDetection: { telephone: false },
    other: { "content-language": isLocale(locale) ? localeLabels[locale].htmlLang : "ka" },
  };
}

export default async function LocaleLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ locale: string }>;
}) {
  const { locale: raw } = await params;
  if (!isLocale(raw)) notFound();
  const locale: Locale = raw;
  const t = getDictionary(locale);
  const [content, projects] = await Promise.all([getSiteContent(), getPublishedProjects()]);
  const hasDemo = content.general.show_demo_badges && projects.some((p) => p.is_demo);

  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "ProfessionalService",
    name: content.general.studio_name,
    description: locale === "ka" ? content.studio.description_ka : content.studio.description_en,
    url: env.siteUrl,
    areaServed: "GE",
    address: { "@type": "PostalAddress", addressCountry: "GE" },
    ...(content.contact.email ? { email: content.contact.email } : {}),
    ...(content.contact.phone ? { telephone: content.contact.phone } : {}),
    sameAs: [content.contact.instagram_url, content.contact.tiktok_url, content.contact.facebook_url, content.contact.linkedin_url].filter(Boolean),
  };

  return (
    <html lang={localeLabels[locale].htmlLang} className={fontVariables}>
      <body className="min-h-screen overflow-x-clip">
        <Header locale={locale} nav={t.nav} general={content.general} />
        <main id="main">{children}</main>
        <Footer locale={locale} t={t} content={content} hasDemo={hasDemo} />
        <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd).replace(/</g, "\\u003c") }} />
      </body>
    </html>
  );
}
