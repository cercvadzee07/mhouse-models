"use client";

import Image from "next/image";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { useCallback, useEffect, useRef, useState } from "react";

export type GalleryItem = { id: string; src: string; thumb: string; width: number; height: number; alt: string; blur: string | null; credit: string | null };

/** Editorial image grid with an accessible, keyboard- and swipe-friendly lightbox. */
export function Gallery({
  items,
  labels,
  variant = "grid",
}: {
  items: GalleryItem[];
  labels: { close: string; next: string; prev: string; photo: string; credit: string };
  variant?: "grid" | "strip";
}) {
  const [index, setIndex] = useState<number | null>(null);
  const reduce = useReducedMotion();
  const dialogRef = useRef<HTMLDivElement>(null);
  const lastFocus = useRef<HTMLElement | null>(null);
  const touchX = useRef<number | null>(null);

  const open = (i: number) => {
    lastFocus.current = document.activeElement as HTMLElement;
    setIndex(i);
  };
  const close = useCallback(() => {
    setIndex(null);
    lastFocus.current?.focus();
  }, []);
  const go = useCallback((d: number) => setIndex((i) => (i === null ? i : (i + d + items.length) % items.length)), [items.length]);

  useEffect(() => {
    if (index === null) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") close();
      if (e.key === "ArrowRight") go(1);
      if (e.key === "ArrowLeft") go(-1);
      if (e.key === "Tab" && dialogRef.current) {
        const f = dialogRef.current.querySelectorAll<HTMLElement>("button");
        if (!f.length) return;
        const first = f[0];
        const last = f[f.length - 1];
        if (e.shiftKey && document.activeElement === first) {
          e.preventDefault();
          last.focus();
        } else if (!e.shiftKey && document.activeElement === last) {
          e.preventDefault();
          first.focus();
        }
      }
    };
    document.documentElement.style.overflow = "hidden";
    window.addEventListener("keydown", onKey);
    dialogRef.current?.querySelector<HTMLElement>("button")?.focus();
    return () => {
      document.documentElement.style.overflow = "";
      window.removeEventListener("keydown", onKey);
    };
  }, [index, close, go]);

  if (!items.length) return null;

  const grid =
    variant === "strip" ? (
      <ul className="-mx-[var(--gutter)] flex snap-x snap-mandatory gap-4 overflow-x-auto px-[var(--gutter)] pb-4 [scrollbar-width:thin]">
        {items.map((img, i) => (
          <li key={img.id} className="w-[78vw] shrink-0 snap-start sm:w-[44vw] lg:w-[30vw]">
            <button type="button" onClick={() => open(i)} className="group relative block aspect-[4/3] w-full overflow-hidden bg-stone" aria-label={`${labels.photo} ${i + 1}: ${img.alt}`}>
              <Image src={img.thumb} alt={img.alt} fill sizes="(min-width:1024px) 30vw, 78vw" className="object-cover transition-transform duration-1000 group-hover:scale-105" />
            </button>
          </li>
        ))}
      </ul>
    ) : (
      <ul className="grid grid-cols-2 gap-3 md:grid-cols-12 md:gap-5">
        {items.map((img, i) => {
          // Rhythm: a large image, then pairs.
          const span = i % 3 === 0 ? "col-span-2 md:col-span-12" : "col-span-1 md:col-span-6";
          const ratio = i % 3 === 0 ? "aspect-[16/10]" : "aspect-[4/5]";
          return (
            <li key={img.id} className={span}>
              <button type="button" onClick={() => open(i)} className={`group relative block w-full overflow-hidden bg-stone ${ratio}`} aria-label={`${labels.photo} ${i + 1}: ${img.alt}`}>
                <Image
                  src={i % 3 === 0 ? img.src : img.thumb}
                  alt={img.alt}
                  fill
                  sizes={i % 3 === 0 ? "100vw" : "(min-width: 768px) 50vw, 50vw"}
                  placeholder={img.blur ? "blur" : "empty"}
                  blurDataURL={img.blur ?? undefined}
                  className="object-cover transition-transform duration-[1400ms] ease-[var(--ease-architect)] group-hover:scale-[1.03]"
                />
              </button>
            </li>
          );
        })}
      </ul>
    );

  const current = index !== null ? items[index] : null;

  return (
    <>
      {grid}
      <AnimatePresence>
        {current && (
          <motion.div
            ref={dialogRef}
            role="dialog"
            aria-modal="true"
            aria-label={`${labels.photo} ${index! + 1} / ${items.length}`}
            className="fixed inset-0 z-[80] flex flex-col bg-ink/96 text-paper backdrop-blur"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.35 }}
            onTouchStart={(e) => (touchX.current = e.touches[0].clientX)}
            onTouchEnd={(e) => {
              if (touchX.current === null) return;
              const dx = e.changedTouches[0].clientX - touchX.current;
              if (Math.abs(dx) > 50) go(dx < 0 ? 1 : -1);
              touchX.current = null;
            }}
          >
            <div className="flex items-center justify-between px-5 py-4 font-mono text-xs">
              <span>
                {String(index! + 1).padStart(2, "0")} / {String(items.length).padStart(2, "0")}
              </span>
              <button type="button" onClick={close} className="rounded-full border border-paper/25 px-4 py-2 hover:border-paper">
                {labels.close} ✕
              </button>
            </div>
            <div className="relative flex-1">
              <AnimatePresence mode="wait" initial={false}>
                <motion.div
                  key={current.id}
                  className="absolute inset-0 px-4 pb-4 md:px-20"
                  initial={reduce ? { opacity: 0 } : { opacity: 0, scale: 0.985 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0 }}
                  transition={{ duration: 0.45, ease: [0.22, 1, 0.36, 1] }}
                >
                  <div className="relative h-full w-full">
                    <Image src={current.src} alt={current.alt} fill sizes="100vw" className="object-contain" priority />
                  </div>
                </motion.div>
              </AnimatePresence>
              {items.length > 1 && (
                <>
                  <button type="button" onClick={() => go(-1)} aria-label={labels.prev} className="absolute left-3 top-1/2 hidden h-12 w-12 -translate-y-1/2 items-center justify-center rounded-full border border-paper/25 hover:border-paper md:flex">
                    ←
                  </button>
                  <button type="button" onClick={() => go(1)} aria-label={labels.next} className="absolute right-3 top-1/2 hidden h-12 w-12 -translate-y-1/2 items-center justify-center rounded-full border border-paper/25 hover:border-paper md:flex">
                    →
                  </button>
                </>
              )}
            </div>
            <div className="flex items-center justify-between gap-4 px-5 py-4 text-sm text-paper/70">
              <p className="truncate">{current.alt}</p>
              {current.credit && (
                <p className="shrink-0 font-mono text-xs">
                  {labels.credit}: {current.credit}
                </p>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
