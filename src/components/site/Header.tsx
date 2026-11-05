"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { useEffect, useState } from "react";
import { localePath, stripLocale, type Locale } from "@/i18n/config";
import type { Dictionary } from "@/i18n/get-dictionary";
import type { GeneralSettings } from "@/lib/types";
import { LanguageSwitcher } from "./LanguageSwitcher";
import { Wordmark } from "./Wordmark";

type NavKey = "home" | "studio" | "services" | "work" | "contact";

export function Header({
  locale,
  nav,
  general,
}: {
  locale: Locale;
  nav: Dictionary["nav"];
  general: Pick<GeneralSettings, "studio_name" | "studio_name_short" | "wordmark_suffix">;
}) {
  const pathname = stripLocale(usePathname() || "/");
  const isHome = pathname === "/";
  const reduce = useReducedMotion();
  const [scrolled, setScrolled] = useState(false);
  const [hidden, setHidden] = useState(false);
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState<NavKey>(isHome ? "home" : pathname.startsWith("/projects") ? "work" : "home");

  const items: { key: NavKey; href: string; label: string }[] = [
    { key: "home", href: localePath(locale, "/"), label: nav.home },
    { key: "studio", href: localePath(locale, "/#studio"), label: nav.studio },
    { key: "services", href: localePath(locale, "/#services"), label: nav.services },
    { key: "work", href: localePath(locale, "/projects"), label: nav.work },
    { key: "contact", href: localePath(locale, "/#contact"), label: nav.contact },
  ];

  // Solid background after leaving the top; hide when scrolling down, reveal when scrolling up.
  useEffect(() => {
    let last = window.scrollY;
    const onScroll = () => {
      const y = window.scrollY;
      setScrolled(y > 24);
      setHidden(y > 480 && y > last + 4);
      if (y < last - 4) setHidden(false);
      last = y;
    };
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  // Active section tracking on the homepage.
  useEffect(() => {
    if (!isHome) {
      setActive(pathname.startsWith("/projects") ? "work" : "home");
      return;
    }
    const ids: NavKey[] = ["studio", "services", "work", "contact"];
    const sections = ids.map((id) => document.getElementById(id)).filter(Boolean) as HTMLElement[];
    const observer = new IntersectionObserver(
      (entries) => {
        const visible = entries.filter((e) => e.isIntersecting).sort((a, b) => b.intersectionRatio - a.intersectionRatio)[0];
        if (visible) setActive(visible.target.id as NavKey);
        else if (window.scrollY < window.innerHeight * 0.5) setActive("home");
      },
      { rootMargin: "-35% 0px -55% 0px", threshold: [0, 0.25, 0.5] },
    );
    sections.forEach((s) => observer.observe(s));
    const onTop = () => window.scrollY < window.innerHeight * 0.4 && setActive("home");
    window.addEventListener("scroll", onTop, { passive: true });
    return () => {
      observer.disconnect();
      window.removeEventListener("scroll", onTop);
    };
  }, [isHome, pathname]);

  useEffect(() => {
    document.documentElement.style.overflow = open ? "hidden" : "";
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    window.addEventListener("keydown", onKey);
    return () => {
      document.documentElement.style.overflow = "";
      window.removeEventListener("keydown", onKey);
    };
  }, [open]);

  useEffect(() => setOpen(false), [pathname]);

  return (
    <>
      <a
        href="#main"
        className="fixed left-4 top-3 z-[70] -translate-y-24 rounded-full bg-ink px-4 py-2 text-sm text-paper transition-transform focus:translate-y-0"
      >
        {nav.skip}
      </a>
      <header
        className={`fixed inset-x-0 top-0 z-50 transition-[transform,background-color,border-color,backdrop-filter] duration-700 ease-[var(--ease-architect)] ${
          hidden && !open ? "-translate-y-full" : "translate-y-0"
        } ${scrolled && !open ? "border-b hairline bg-paper/80 backdrop-blur-xl" : "border-b border-transparent bg-transparent"}`}
      >
        <div className="container-x flex h-[var(--header-h)] items-center justify-between gap-6">
          <Wordmark general={general} href={localePath(locale, "/")} />

          <nav aria-label="Primary" className="hidden lg:block">
            <ul className="flex items-center gap-9">
              {items.map((item) => (
                <li key={item.key}>
                  <Link
                    href={item.href}
                    aria-current={active === item.key ? "page" : undefined}
                    className="group relative py-2 text-[0.9rem] text-ink/70 transition-colors duration-300 hover:text-ink aria-[current=page]:text-ink"
                  >
                    {item.label}
                    <span
                      aria-hidden
                      className={`absolute -bottom-0.5 left-0 h-px bg-ink transition-all duration-500 ease-[var(--ease-architect)] ${
                        active === item.key ? "w-full" : "w-0 group-hover:w-full"
                      }`}
                    />
                  </Link>
                </li>
              ))}
            </ul>
          </nav>

          <div className="flex items-center gap-4 sm:gap-6">
            <LanguageSwitcher locale={locale} label={nav.language} />
            <Link href={localePath(locale, "/#contact")} className="btn btn-solid hidden min-h-10 px-5 text-[0.82rem] md:inline-flex">
              {nav.cta}
            </Link>
            <button
              type="button"
              className="relative -mr-2 flex h-11 w-11 items-center justify-center lg:hidden"
              aria-expanded={open}
              aria-controls="mobile-nav"
              aria-label={open ? nav.close : nav.menu}
              onClick={() => setOpen((v) => !v)}
            >
              <span className="relative block h-3 w-6">
                <span
                  className={`absolute left-0 top-0 h-px w-6 bg-ink transition-transform duration-500 ease-[var(--ease-architect)] ${
                    open ? "translate-y-1.5 rotate-45" : ""
                  }`}
                />
                <span
                  className={`absolute bottom-0 left-0 h-px w-6 bg-ink transition-transform duration-500 ease-[var(--ease-architect)] ${
                    open ? "-translate-y-1.5 -rotate-45" : ""
                  }`}
                />
              </span>
            </button>
          </div>
        </div>
      </header>

      <AnimatePresence>
        {open && (
          <motion.div
            id="mobile-nav"
            role="dialog"
            aria-modal="true"
            aria-label={nav.menu}
            className="fixed inset-0 z-40 flex flex-col bg-paper pt-[var(--header-h)] lg:hidden"
            initial={reduce ? { opacity: 0 } : { clipPath: "inset(0 0 100% 0)" }}
            animate={reduce ? { opacity: 1 } : { clipPath: "inset(0 0 0% 0)" }}
            exit={reduce ? { opacity: 0 } : { clipPath: "inset(0 0 100% 0)" }}
            transition={{ duration: 0.7, ease: [0.22, 1, 0.36, 1] }}
          >
            <nav aria-label="Mobile" className="container-x flex flex-1 flex-col justify-center">
              <ul className="space-y-2">
                {items.map((item, i) => (
                  <motion.li
                    key={item.key}
                    initial={reduce ? false : { opacity: 0, y: 24 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.15 + i * 0.06, duration: 0.7, ease: [0.22, 1, 0.36, 1] }}
                  >
                    <Link
                      href={item.href}
                      onClick={() => setOpen(false)}
                      aria-current={active === item.key ? "page" : undefined}
                      className="flex items-baseline gap-4 py-2"
                    >
                      <span className="font-mono text-xs text-concrete">0{i + 1}</span>
                      <span className="display-lg">{item.label}</span>
                    </Link>
                  </motion.li>
                ))}
              </ul>
            </nav>
            <div className="container-x flex items-center justify-between border-t hairline py-6">
              <LanguageSwitcher locale={locale} label={nav.language} />
              <Link href={localePath(locale, "/#contact")} onClick={() => setOpen(false)} className="btn btn-solid min-h-11 text-sm">
                {nav.cta}
              </Link>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
