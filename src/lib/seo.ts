import type { Metadata } from "next";
import { localeLabels, localePath, locales, pick, type Locale } from "@/i18n/config";
import { env } from "@/lib/env";
import type { SiteContent } from "@/lib/types";
import { mediaUrl } from "@/lib/storage";

export function absoluteUrl(path: string) {
  return `${env.siteUrl}${path === "/" ? "" : path}` || "/";
}

export function alternates(path: string, locale: Locale): Metadata["alternates"] {
  const languages: Record<string, string> = {};
  for (const l of locales) languages[localeLabels[l].htmlLang] = absoluteUrl(localePath(l, path));
  languages["x-default"] = absoluteUrl(localePath("ka", path));
  return { canonical: absoluteUrl(localePath(locale, path)), languages };
}

export function buildMetadata({
  content,
  locale,
  pageKey,
  path,
  title,
  description,
  image,
  type = "website",
}: {
  content: SiteContent;
  locale: Locale;
  pageKey?: "home" | "projects";
  path: string;
  title?: string;
  description?: string;
  image?: string | null;
  type?: "website" | "article";
}): Metadata {
  const def = content.seo.find((s) => s.page_key === "default");
  const page = pageKey ? content.seo.find((s) => s.page_key === pageKey) : undefined;
  const finalTitle = title || pick(page, "title", locale) || pick(def, "title", locale) || content.general.studio_name;
  const finalDescription = description || pick(page, "description", locale) || pick(def, "description", locale);
  const og = image ?? mediaUrl(page?.og_image_path) ?? mediaUrl(def?.og_image_path) ?? absoluteUrl("/opengraph-image");

  return {
    title: { absolute: finalTitle },
    description: finalDescription,
    alternates: alternates(path, locale),
    openGraph: {
      type,
      title: finalTitle,
      description: finalDescription,
      url: absoluteUrl(localePath(locale, path)),
      siteName: content.general.studio_name,
      locale: localeLabels[locale].og,
      alternateLocale: locales.filter((l) => l !== locale).map((l) => localeLabels[l].og),
      images: og ? [{ url: og, width: 1200, height: 630, alt: finalTitle }] : undefined,
    },
    twitter: {
      card: "summary_large_image",
      title: finalTitle,
      description: finalDescription,
      images: og ? [og] : undefined,
    },
  };
}
