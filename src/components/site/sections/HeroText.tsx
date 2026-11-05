"use client";

import Link from "next/link";
import { motion, useReducedMotion } from "framer-motion";

const ease = [0.22, 1, 0.36, 1] as const;

export function HeroText({
  eyebrow,
  headline,
  sub,
  primary,
  secondary,
}: {
  eyebrow: string;
  headline: string;
  sub: string;
  primary: { label: string; href: string };
  secondary: { label: string; href: string };
}) {
  const reduce = useReducedMotion();
  const words = headline.split(/\s+/).filter(Boolean);
  const anim = (delay: number) =>
    reduce
      ? {}
      : {
          initial: { opacity: 0, y: 18 },
          animate: { opacity: 1, y: 0 },
          transition: { duration: 1.1, ease, delay },
        };

  return (
    <div>
      <motion.p className="eyebrow mb-7 flex items-center gap-3 text-graphite" {...anim(0.1)}>
        <span aria-hidden className="inline-block h-px w-8 bg-current" />
        {eyebrow}
      </motion.p>
      <h1 id="hero-title" className="display-xl text-balance">
        {words.map((w, i) => (
          <span key={i} className="inline-block overflow-hidden pb-[0.08em] align-bottom">
            <motion.span
              className="inline-block"
              initial={reduce ? false : { y: "105%" }}
              animate={{ y: 0 }}
              transition={{ duration: 1.2, ease, delay: 0.2 + i * 0.07 }}
            >
              {w}
              {i < words.length - 1 ? " " : ""}
            </motion.span>
          </span>
        ))}
      </h1>
      <motion.p className="lead mt-8 max-w-[34rem] text-graphite" {...anim(0.55 + words.length * 0.05)}>
        {sub}
      </motion.p>
      <motion.div className="mt-10 flex flex-wrap gap-3" {...anim(0.7 + words.length * 0.05)}>
        <Link href={primary.href} className="btn btn-solid group">
          {primary.label}
          <span aria-hidden className="transition-transform duration-500 group-hover:translate-x-1">→</span>
        </Link>
        <Link href={secondary.href} className="btn btn-ghost">
          {secondary.label}
        </Link>
      </motion.div>
    </div>
  );
}
