"use client";

import { AnimatePresence, LayoutGroup, motion, useReducedMotion } from "framer-motion";
import { useEffect, useMemo, useState } from "react";
import type { CardData } from "./card-data";
import { ProjectCard } from "./ProjectCard";

type Filter = { slug: string; label: string };

/**
 * Filterable editorial masonry. The selected category is mirrored to the URL
 * (?category=…) so filtered views can be shared and survive navigation.
 */
export function PortfolioGrid({
  cards,
  filters,
  labels,
  showDemo,
}: {
  cards: CardData[];
  filters: Filter[];
  labels: { all: string; filterLabel: string; empty: string; emptyAll: string; demo: string; view: string; model3d: string; count: string };
  showDemo: boolean;
}) {
  const reduce = useReducedMotion();
  const [active, setActive] = useState<string>("all");

  useEffect(() => {
    const c = new URLSearchParams(window.location.search).get("category");
    if (c && filters.some((f) => f.slug === c)) setActive(c);
  }, [filters]);

  const select = (slug: string) => {
    setActive(slug);
    const url = new URL(window.location.href);
    if (slug === "all") url.searchParams.delete("category");
    else url.searchParams.set("category", slug);
    window.history.replaceState(null, "", url.toString());
  };

  const visible = useMemo(() => (active === "all" ? cards : cards.filter((c) => c.categorySlug === active)), [cards, active]);
  const usedFilters = filters.filter((f) => cards.some((c) => c.categorySlug === f.slug));

  // Distribute into two columns, balancing by image height, for an editorial masonry.
  const columns = useMemo(() => {
    const cols: CardData[][] = [[], []];
    const heights = [0, 0];
    visible.forEach((c) => {
      const h = c.image ? c.image.height / c.image.width : 0.75;
      const i = heights[0] <= heights[1] ? 0 : 1;
      cols[i].push(c);
      heights[i] += h + 0.25;
    });
    return cols;
  }, [visible]);

  const cardLabels = { demo: labels.demo, view: labels.view, model3d: labels.model3d };

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-6 border-b hairline pb-6">
        <div role="group" aria-label={labels.filterLabel} className="-mx-1 flex flex-wrap gap-1.5">
          {[{ slug: "all", label: labels.all }, ...usedFilters].map((f) => (
            <button
              key={f.slug}
              type="button"
              aria-pressed={active === f.slug}
              onClick={() => select(f.slug)}
              className={`relative rounded-full px-4 py-2 text-sm transition-colors duration-300 ${
                active === f.slug ? "text-paper" : "text-graphite hover:text-ink"
              }`}
            >
              {active === f.slug && (
                <motion.span
                  layoutId="filter-pill"
                  className="absolute inset-0 -z-0 rounded-full bg-ink"
                  transition={{ type: "spring", stiffness: 380, damping: 32 }}
                />
              )}
              <span className="relative z-10">{f.label}</span>
            </button>
          ))}
        </div>
        <p className="font-mono text-xs text-concrete" aria-live="polite">
          {labels.count.replace("{n}", String(visible.length))}
        </p>
      </div>

      {visible.length === 0 ? (
        <p className="py-24 text-center text-graphite">{cards.length === 0 ? labels.emptyAll : labels.empty}</p>
      ) : (
        <LayoutGroup>
          {/* Mobile: single column */}
          <ul className="mt-10 grid gap-14 md:hidden">
            {visible.map((c, i) => (
              <li key={c.id}>
                <ProjectCard card={c} labels={cardLabels} sizes="100vw" priority={i < 2} showDemo={showDemo} />
              </li>
            ))}
          </ul>
          {/* Desktop: offset two-column masonry */}
          <div className="mt-14 hidden grid-cols-2 gap-x-[clamp(2rem,5vw,6rem)] md:grid">
            {columns.map((col, ci) => (
              <ul key={ci} className={`flex flex-col gap-20 ${ci === 1 ? "pt-32" : ""}`}>
                <AnimatePresence mode="popLayout">
                  {col.map((c, i) => (
                    <motion.li
                      key={c.id}
                      layout={!reduce}
                      initial={reduce ? false : { opacity: 0, y: 30 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={reduce ? undefined : { opacity: 0, scale: 0.97 }}
                      transition={{ duration: 0.8, ease: [0.22, 1, 0.36, 1] }}
                    >
                      <ProjectCard card={c} labels={cardLabels} sizes="(min-width: 768px) 45vw, 100vw" priority={i === 0} showDemo={showDemo} />
                    </motion.li>
                  ))}
                </AnimatePresence>
              </ul>
            ))}
          </div>
        </LayoutGroup>
      )}
    </div>
  );
}
