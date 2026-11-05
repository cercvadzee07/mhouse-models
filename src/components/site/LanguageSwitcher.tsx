"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { localeLabels, localePath, locales, stripLocale, type Locale } from "@/i18n/config";

export function LanguageSwitcher({ locale, label, className = "" }: { locale: Locale; label: string; className?: string }) {
  const pathname = usePathname() || "/";
  const canonical = stripLocale(pathname);
  const [hash, setHash] = useState("");

  useEffect(() => {
    const update = () => setHash(window.location.hash);
    update();
    window.addEventListener("hashchange", update);
    return () => window.removeEventListener("hashchange", update);
  }, []);

  return (
    <nav aria-label={label} className={`flex items-center gap-1 font-mono text-[0.72rem] tracking-[0.14em] ${className}`}>
      {locales.map((l, i) => (
        <span key={l} className="flex items-center gap-1">
          {i > 0 && <span aria-hidden className="opacity-30">/</span>}
          <Link
            href={`${localePath(l, canonical)}${hash}`}
            hrefLang={localeLabels[l].htmlLang}
            lang={localeLabels[l].htmlLang}
            aria-current={l === locale ? "true" : undefined}
            aria-label={localeLabels[l].name}
            scroll={false}
            className={`px-1 py-1 transition-opacity duration-300 ${l === locale ? "opacity-100" : "opacity-45 hover:opacity-100"}`}
          >
            {localeLabels[l].short}
          </Link>
        </span>
      ))}
    </nav>
  );
}
