import Image from "next/image";
import { localePath, pick, type Locale } from "@/i18n/config";
import type { Dictionary } from "@/i18n/get-dictionary";
import type { HomepageContent, ProjectModel } from "@/lib/types";
import { mediaUrl } from "@/lib/storage";
import { unsplashUrl, UNSPLASH } from "@/content/defaults";
import { HeroVisual } from "./HeroVisual";
import { HeroText } from "./HeroText";

export function Hero({
  locale,
  t,
  home,
  heroModel,
}: {
  locale: Locale;
  t: Dictionary;
  home: HomepageContent;
  heroModel: ProjectModel | null;
}) {
  const heroImage = mediaUrl(home.hero_image_path) ?? unsplashUrl(UNSPLASH.pavilionTable, 2000);
  const mode = home.hero_mode === "model" && heroModel?.display_path ? "model" : home.hero_mode === "image" ? "image" : "procedural";

  const imageEl = (
    <div className="relative h-full w-full overflow-hidden bg-bone">
      <Image src={heroImage} alt="" fill priority sizes="(min-width: 1024px) 60vw, 100vw" className="object-cover" />
    </div>
  );

  return (
    <section id="top" aria-labelledby="hero-title" className="relative isolate min-h-[100svh] overflow-hidden grain">
      {/* Architectural grid lines */}
      <div aria-hidden className="pointer-events-none absolute inset-0 -z-10">
        <div className="container-x grid-12 h-full">
          {Array.from({ length: 13 }).map((_, i) => (
            <span key={i} className={`h-full border-l hairline opacity-40 ${i % 3 ? "hidden lg:block" : ""}`} style={{ gridColumn: `${i + 1} / span 1` }} />
          ))}
        </div>
      </div>

      <div className="container-x grid-12 relative min-h-[100svh] items-end pb-10 pt-[calc(var(--header-h)+2rem)] lg:items-center lg:pb-16">
        <div className="relative z-10 col-span-12 lg:col-span-6 xl:col-span-5">
          <HeroText
            eyebrow={pick(home, "eyebrow", locale)}
            headline={pick(home, "headline", locale)}
            sub={pick(home, "subheadline", locale)}
            primary={{ label: pick(home, "cta_primary", locale), href: localePath(locale, "/projects") }}
            secondary={{ label: pick(home, "cta_secondary", locale), href: localePath(locale, "/#contact") }}
          />
        </div>

        {/* 3D model / image visual: below the text on mobile, to the right on desktop */}
        <div className="relative col-span-12 -mx-[var(--gutter)] mt-10 h-[56svh] min-h-[340px] lg:absolute lg:inset-y-0 lg:right-0 lg:mx-0 lg:mt-0 lg:h-auto lg:w-[64%]">
          {mode === "image" ? (
            imageEl
          ) : (
            <HeroVisual
              mode={mode}
              modelUrl={mode === "model" ? mediaUrl(heroModel?.display_path) : null}
              autoRotate={home.hero_auto_rotate}
              lightsDefault={home.hero_evening_lights}
              labels={{
                interact: t.hero.interact,
                lightsOn: t.hero.lightsOn,
                lightsOff: t.hero.lightsOff,
                loading: t.hero.loading,
              }}
              fallback={imageEl}
            />
          )}
          {mode === "procedural" && (
            <div className="pointer-events-none absolute bottom-6 left-[var(--gutter)] hidden items-center gap-3 md:flex lg:bottom-10 lg:left-10">
              <span className="dimension-line w-16 text-ink" />
              <span className="eyebrow text-graphite">{t.hero.scaleNote}</span>
            </div>
          )}
        </div>
      </div>
    </section>
  );
}
