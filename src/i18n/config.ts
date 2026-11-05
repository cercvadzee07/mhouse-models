export const locales = ["ka", "en"] as const;
export type Locale = (typeof locales)[number];
export const defaultLocale: Locale = "ka";

export function isLocale(value: string | undefined | null): value is Locale {
  return !!value && (locales as readonly string[]).includes(value);
}

/**
 * Georgian is served without a prefix ("/", "/projects/…"),
 * English lives under "/en". This builds a locale-aware href.
 */
export function localePath(locale: Locale, path = "/"): string {
  const clean = path.startsWith("/") ? path : `/${path}`;
  if (locale === defaultLocale) return clean;
  if (clean === "/") return `/${locale}`;
  if (clean.startsWith("/#")) return `/${locale}${clean.slice(1)}`;
  return `/${locale}${clean}`;
}

/** Strip a locale prefix from a pathname, returning the canonical path. */
export function stripLocale(pathname: string): string {
  for (const l of locales) {
    if (pathname === `/${l}`) return "/";
    if (pathname.startsWith(`/${l}/`)) return pathname.slice(l.length + 1);
  }
  return pathname;
}

export const localeLabels: Record<Locale, { short: string; name: string; htmlLang: string; og: string }> = {
  ka: { short: "GE", name: "ქართული", htmlLang: "ka", og: "ka_GE" },
  en: { short: "EN", name: "English", htmlLang: "en", og: "en_US" },
};

/** Pick the localized field `${base}_${locale}` with a graceful fallback to the other language. */
export function pick(row: object | null | undefined, base: string, locale: Locale): string {
  if (!row) return "";
  const r = row as Record<string, unknown>;
  const primary = r[`${base}_${locale}`];
  if (typeof primary === "string" && primary.trim()) return primary;
  const other = r[`${base}_${locale === "ka" ? "en" : "ka"}`];
  return typeof other === "string" ? other : "";
}
