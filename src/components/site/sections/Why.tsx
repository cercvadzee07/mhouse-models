import { pick, type Locale } from "@/i18n/config";
import type { Dictionary } from "@/i18n/get-dictionary";
import type { HomepageContent } from "@/lib/types";
import { Reveal } from "../Reveal";
import { SectionLabel } from "../SectionLabel";

export function Why({ locale, t, home }: { locale: Locale; t: Dictionary; home: HomepageContent }) {
  const title = pick(home, "why_title", locale) || t.why.title;
  return (
    <section aria-labelledby="why-title" className="section-y relative overflow-hidden bg-ink text-paper">
      <div aria-hidden className="pointer-events-none absolute -right-40 top-10 h-[38rem] w-[38rem] rounded-full bg-lamp/10 blur-[120px]" />
      <div className="container-x grid-12 relative gap-y-12">
        <div className="col-span-12 lg:col-span-5">
          <SectionLabel index="04" label={t.why.label} inverted />
          <Reveal>
            <h2 id="why-title" className="display-lg mt-8 md:max-w-[14ch] text-balance">
              {title}
            </h2>
          </Reveal>
          <Reveal delay={0.1}>
            <p className="lead mt-8 max-w-md text-paper/60">{t.why.intro}</p>
          </Reveal>
        </div>
        <ul className="col-span-12 grid gap-px overflow-hidden bg-paper/10 sm:grid-cols-2 lg:col-span-7">
          {t.why.items.map((item, i) => (
            <Reveal as="li" key={i} delay={(i % 2) * 0.08} className="group bg-ink p-7 transition-colors duration-500 hover:bg-charcoal md:p-9">
              <span className="font-mono text-xs text-lamp/80">{String(i + 1).padStart(2, "0")}</span>
              <h3 className="mt-6 text-xl font-medium">{item.title}</h3>
              <p className="mt-3 text-[0.95rem] leading-relaxed text-paper/55">{item.body}</p>
            </Reveal>
          ))}
        </ul>
      </div>
    </section>
  );
}
