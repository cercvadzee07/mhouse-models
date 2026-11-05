import Link from "next/link";
import { localePath, type Locale } from "@/i18n/config";
import type { Dictionary } from "@/i18n/get-dictionary";
import type { Project } from "@/lib/types";
import { Reveal } from "../Reveal";
import { SectionLabel } from "../SectionLabel";
import { ProjectCard } from "../portfolio/ProjectCard";
import { toCardData } from "../portfolio/card-data";

/** Editorial selection of featured projects (Admin → Projects → "Featured"). */
export function FeaturedWork({
  locale,
  t,
  projects,
  showDemo,
}: {
  locale: Locale;
  t: Dictionary;
  projects: Project[];
  showDemo: boolean;
}) {
  const featured = projects.filter((p) => p.is_featured);
  const list = (featured.length ? featured : projects).slice(0, 5).map((p) => toCardData(p, locale));
  const labels = { demo: t.work.demo, view: t.work.view, model3d: t.project.model3d };
  // Asymmetric editorial layout: wide / narrow alternating rows.
  const layout = [
    "md:col-span-7",
    "md:col-span-4 md:col-start-9 md:mt-40",
    "md:col-span-5 md:col-start-2",
    "md:col-span-6 md:col-start-7 md:-mt-24",
    "md:col-span-8 md:col-start-3",
  ];
  const aspects = ["landscape", "portrait", "portrait", "landscape", "landscape"] as const;

  return (
    <section id="work" aria-labelledby="work-title" className="section-y">
      <div className="container-x">
        <div className="grid-12 items-end gap-y-8">
          <div className="col-span-12 md:col-span-7">
            <SectionLabel index="03" label={t.work.label} />
            <Reveal>
              <h2 id="work-title" className="display-lg mt-8 md:max-w-[16ch] text-balance">
                {t.work.intro}
              </h2>
            </Reveal>
          </div>
          <div className="col-span-12 md:col-span-4 md:col-start-9 md:text-right">
            <Link href={localePath(locale, "/projects")} className="btn btn-ghost group">
              {t.work.viewAll}
              <span aria-hidden className="transition-transform duration-500 group-hover:translate-x-1">→</span>
            </Link>
          </div>
        </div>

        {list.length === 0 ? (
          <p className="mt-20 text-graphite">{t.work.emptyAll}</p>
        ) : (
          <ul className="grid-12 mt-16 gap-y-16 md:mt-24 md:gap-y-28">
            {list.map((card, i) => (
              <Reveal as="li" key={card.id} className={`col-span-12 ${layout[i % layout.length]}`} amount={0.15}>
                <ProjectCard
                  card={card}
                  labels={labels}
                  aspect={aspects[i % aspects.length]}
                  sizes="(min-width: 768px) 55vw, 100vw"
                  showDemo={showDemo}
                />
              </Reveal>
            ))}
          </ul>
        )}
      </div>
    </section>
  );
}
