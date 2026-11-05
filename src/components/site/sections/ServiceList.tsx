"use client";

import Image from "next/image";
import Link from "next/link";
import { AnimatePresence, motion, useMotionValue, useReducedMotion, useSpring } from "framer-motion";
import { useRef, useState } from "react";

type Item = { id: string; title: string; description: string; image: string | null };

/**
 * Editorial service index. On desktop, hovering a row reveals its image,
 * which follows the cursor with a soft spring. On touch devices the image
 * is shown inline.
 */
export function ServiceList({ items, discussLabel, contactHref }: { items: Item[]; discussLabel: string; contactHref: string }) {
  const [active, setActive] = useState<number | null>(null);
  const reduce = useReducedMotion();
  const listRef = useRef<HTMLUListElement>(null);
  const x = useMotionValue(0);
  const y = useMotionValue(0);
  const sx = useSpring(x, { stiffness: 180, damping: 24, mass: 0.6 });
  const sy = useSpring(y, { stiffness: 180, damping: 24, mass: 0.6 });

  const onMove = (e: React.MouseEvent) => {
    const rect = listRef.current?.getBoundingClientRect();
    if (!rect) return;
    x.set(e.clientX - rect.left);
    y.set(e.clientY - rect.top);
  };

  return (
    <ul ref={listRef} className="relative mt-16 border-t hairline md:mt-24" onMouseMove={onMove} onMouseLeave={() => setActive(null)}>
      {items.map((item, i) => (
        <li key={item.id} className="group border-b hairline" onMouseEnter={() => setActive(i)}>
          <div className="grid-12 items-start gap-y-4 py-8 md:py-10">
            <span className="col-span-2 pt-2 font-mono text-xs text-concrete md:col-span-1">{String(i + 1).padStart(2, "0")}</span>
            <h3 className="display-md col-span-10 transition-transform duration-700 ease-[var(--ease-architect)] group-hover:translate-x-3 md:col-span-5">
              {item.title}
            </h3>
            <div className="col-span-12 md:col-span-5 md:col-start-8 lg:col-span-4 lg:col-start-8">
              <p className="leading-relaxed text-graphite">{item.description}</p>
              {item.image && (
                <div className="relative mt-6 aspect-[4/3] overflow-hidden bg-stone md:hidden">
                  <Image src={item.image} alt="" fill sizes="100vw" className="object-cover" />
                </div>
              )}
            </div>
            <div className="col-span-12 hidden justify-end lg:col-span-1 lg:flex">
              <Link
                href={contactHref}
                aria-label={`${discussLabel}: ${item.title}`}
                className="flex h-11 w-11 items-center justify-center rounded-full border hairline transition-all duration-500 group-hover:border-ink group-hover:bg-ink group-hover:text-paper"
              >
                <span aria-hidden>↗</span>
              </Link>
            </div>
          </div>
        </li>
      ))}

      {!reduce && (
        <motion.div
          aria-hidden
          className="pointer-events-none absolute left-0 top-0 z-10 hidden md:block"
          style={{ x: sx, y: sy }}
        >
          <AnimatePresence>
            {active !== null && items[active]?.image && (
              <motion.div
                key={items[active].id}
                className="relative -ml-36 -mt-48 h-64 w-72 overflow-hidden bg-stone shadow-[0_40px_80px_-30px_rgba(22,22,20,0.45)]"
                initial={{ opacity: 0, scale: 0.92, rotate: -2 }}
                animate={{ opacity: 1, scale: 1, rotate: 0 }}
                exit={{ opacity: 0, scale: 0.96 }}
                transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
              >
                <Image src={items[active].image!} alt="" fill sizes="288px" className="object-cover" />
              </motion.div>
            )}
          </AnimatePresence>
        </motion.div>
      )}
    </ul>
  );
}
