"use client";

import Image from "next/image";
import Link from "next/link";
import { motion, useMotionValue, useReducedMotion, useSpring, useTransform } from "framer-motion";
import type { CardData } from "./card-data";

export function ProjectCard({
  card,
  labels,
  aspect = "auto",
  sizes = "(min-width: 1024px) 45vw, 100vw",
  priority = false,
  showDemo = true,
}: {
  card: CardData;
  labels: { demo: string; view: string; model3d: string };
  aspect?: "auto" | "portrait" | "landscape" | "square";
  sizes?: string;
  priority?: boolean;
  showDemo?: boolean;
}) {
  const reduce = useReducedMotion();
  const mx = useMotionValue(0.5);
  const my = useMotionValue(0.5);
  const rx = useSpring(useTransform(my, [0, 1], [3, -3]), { stiffness: 150, damping: 20 });
  const ry = useSpring(useTransform(mx, [0, 1], [-4, 4]), { stiffness: 150, damping: 20 });

  const ratio =
    aspect === "portrait" ? "aspect-[4/5]" : aspect === "landscape" ? "aspect-[3/2]" : aspect === "square" ? "aspect-square" : "";
  const natural = card.image ? { aspectRatio: `${card.image.width} / ${card.image.height}` } : { aspectRatio: "4 / 3" };

  return (
    <Link
      href={card.href}
      className="group block"
      onMouseMove={(e) => {
        const r = e.currentTarget.getBoundingClientRect();
        mx.set((e.clientX - r.left) / r.width);
        my.set((e.clientY - r.top) / r.height);
      }}
      onMouseLeave={() => {
        mx.set(0.5);
        my.set(0.5);
      }}
    >
      <div className="[perspective:1400px]">
        <motion.div
          className={`relative overflow-hidden bg-stone ${ratio}`}
          style={{ ...(ratio ? {} : natural), ...(reduce ? {} : { rotateX: rx, rotateY: ry, transformStyle: "preserve-3d" }) }}
        >
          {card.image ? (
            <Image
              src={card.image.src}
              alt={card.image.alt}
              fill
              sizes={sizes}
              priority={priority}
              placeholder={card.image.blur ? "blur" : "empty"}
              blurDataURL={card.image.blur ?? undefined}
              className="object-cover transition-transform duration-[1400ms] ease-[var(--ease-architect)] group-hover:scale-[1.045]"
            />
          ) : (
            <div className="absolute inset-0 flex items-center justify-center text-concrete">
              <span className="eyebrow">{card.title}</span>
            </div>
          )}
          <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-ink/35 via-transparent to-transparent opacity-0 transition-opacity duration-700 group-hover:opacity-100" />
          <div className="absolute left-3 top-3 flex flex-wrap gap-2">
            {showDemo && card.isDemo && (
              <span className="rounded-full bg-paper/85 px-2.5 py-1 font-mono text-[0.62rem] uppercase tracking-[0.12em] text-ink backdrop-blur">
                {labels.demo}
              </span>
            )}
            {card.has3d && (
              <span className="rounded-full bg-ink/80 px-2.5 py-1 font-mono text-[0.62rem] uppercase tracking-[0.12em] text-paper backdrop-blur">
                3D
              </span>
            )}
          </div>
          <span className="absolute bottom-4 right-4 flex translate-y-3 items-center gap-2 rounded-full bg-paper px-4 py-2 text-xs opacity-0 transition-all duration-500 ease-[var(--ease-architect)] group-hover:translate-y-0 group-hover:opacity-100">
            {labels.view} <span aria-hidden>→</span>
          </span>
        </motion.div>
      </div>
      <div className="mt-5 flex items-start justify-between gap-6">
        <div>
          <h3 className="text-[1.15rem] font-medium leading-snug transition-colors group-hover:text-graphite">{card.title}</h3>
          {card.category && <p className="mt-1.5 text-sm text-graphite">{card.category}</p>}
        </div>
        <div className="shrink-0 text-right font-mono text-[0.7rem] leading-6 tracking-[0.08em] text-concrete">
          {card.scale && <div>{card.scale}</div>}
          {card.year && <div>{card.year}</div>}
        </div>
      </div>
    </Link>
  );
}
