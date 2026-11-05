"use client";

import { motion, useReducedMotion, useScroll, useSpring, useTransform } from "framer-motion";
import { useRef } from "react";
import type { Dictionary } from "@/i18n/get-dictionary";
import { Reveal } from "../Reveal";
import { SectionLabel } from "../SectionLabel";

/** Five-step process with a construction line that draws itself as you scroll. */
export function Process({ t }: { t: Pick<Dictionary, "process"> }) {
  const ref = useRef<HTMLElement>(null);
  const reduce = useReducedMotion();
  const { scrollYProgress } = useScroll({ target: ref, offset: ["start 70%", "end 60%"] });
  const progress = useSpring(scrollYProgress, { stiffness: 90, damping: 26 });
  const scaleY = useTransform(progress, [0, 1], [0, 1]);

  return (
    <section ref={ref} id="process" aria-labelledby="process-title" className="section-y">
      <div className="container-x grid-12 gap-y-12">
        <div className="col-span-12 lg:col-span-4">
          <div className="lg:sticky lg:top-[calc(var(--header-h)+3rem)]">
            <SectionLabel index="05" label={t.process.label} />
            <Reveal>
              <h2 id="process-title" className="display-lg mt-8 text-balance">
                {t.process.title}
              </h2>
            </Reveal>
          </div>
        </div>

        <ol className="relative col-span-12 lg:col-span-7 lg:col-start-6">
          <span aria-hidden className="absolute bottom-6 left-[1.1rem] top-6 w-px bg-ink/10 md:left-[1.6rem]" />
          <motion.span
            aria-hidden
            className="absolute bottom-6 left-[1.1rem] top-6 w-px origin-top bg-ink md:left-[1.6rem]"
            style={reduce ? { scaleY: 1 } : { scaleY }}
          />
          {t.process.steps.map((step, i) => (
            <Reveal as="li" key={i} className="relative grid grid-cols-[2.2rem_1fr] gap-x-6 pb-14 last:pb-0 md:grid-cols-[3.2rem_1fr] md:gap-x-10">
              <span className="relative z-10 flex h-9 w-9 items-center justify-center rounded-full border border-ink/20 bg-paper font-mono text-[0.7rem] md:h-[3.2rem] md:w-[3.2rem] md:text-xs">
                {String(i + 1).padStart(2, "0")}
              </span>
              <div className="pt-1 md:pt-3">
                <h3 className="display-md">{step.title}</h3>
                <p className="mt-4 max-w-xl leading-relaxed text-graphite">{step.body}</p>
              </div>
            </Reveal>
          ))}
        </ol>
      </div>
    </section>
  );
}
