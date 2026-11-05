import Image from "next/image";
import { pick, type Locale } from "@/i18n/config";
import type { Dictionary } from "@/i18n/get-dictionary";
import type { StudioInfo } from "@/lib/types";
import { mediaUrl } from "@/lib/storage";
import { UNSPLASH, unsplashUrl } from "@/content/defaults";
import { Reveal, RevealImage } from "../Reveal";
import { SectionLabel } from "../SectionLabel";

export function Studio({ locale, t, studio }: { locale: Locale; t: Dictionary; studio: StudioInfo }) {
  const image = mediaUrl(studio.studio_image_path) ?? unsplashUrl(UNSPLASH.slabsClose, 1600);
  const paragraphs = pick(studio, "about_body", locale).split(/\n{2,}/).filter(Boolean);

  return (
    <section id="studio" aria-labelledby="studio-title" className="section-y relative">
      <div className="container-x grid-12 gap-y-14">
        <div className="col-span-12 lg:col-span-7">
          <SectionLabel index="01" label={t.studio.label} />
          <Reveal>
            <h2 id="studio-title" className="display-lg mt-8 md:max-w-[18ch] text-balance">
              {pick(studio, "about_title", locale)}
            </h2>
          </Reveal>
          <Reveal delay={0.1} className="prose-studio lead mt-10 max-w-[40rem] text-graphite">
            {paragraphs.map((p, i) => (
              <p key={i}>{p}</p>
            ))}
          </Reveal>
        </div>

        <div className="col-span-12 sm:col-span-8 sm:col-start-3 lg:col-span-4 lg:col-start-9">
          <RevealImage className="relative aspect-[3/4] overflow-hidden bg-bone">
            <Image src={image} alt="" fill sizes="(min-width: 1024px) 30vw, 80vw" className="object-cover" />
          </RevealImage>
          <div className="mt-4 flex items-center justify-between text-graphite">
            <span className="eyebrow">{t.studio.independent}</span>
            <span className="eyebrow">GE</span>
          </div>
        </div>

        <ol className="col-span-12 mt-6 grid gap-x-8 gap-y-12 border-t hairline pt-12 sm:grid-cols-2 lg:grid-cols-4">
          {studio.principles.map((p, i) => (
            <Reveal as="li" key={i} delay={i * 0.08}>
              <span className="font-mono text-xs text-concrete">0{i + 1}</span>
              <h3 className="mt-4 text-lg font-medium">{pick(p, "title", locale)}</h3>
              <p className="mt-3 text-[0.95rem] leading-relaxed text-graphite">{pick(p, "body", locale)}</p>
            </Reveal>
          ))}
        </ol>
      </div>
    </section>
  );
}
