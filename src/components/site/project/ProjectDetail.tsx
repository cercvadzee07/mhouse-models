import Image from "next/image";
import Link from "next/link";
import { localePath, pick, type Locale } from "@/i18n/config";
import type { Dictionary } from "@/i18n/get-dictionary";
import type { Project } from "@/lib/types";
import {
  coverImage,
  formatProjectDate,
  galleryImages,
  productionImages,
  translation,
} from "@/lib/data/project-helpers";
import { imageSrc, imageThumb, mediaUrl } from "@/lib/storage";
import { Reveal, RevealImage } from "../Reveal";
import { SectionLabel } from "../SectionLabel";
import { Gallery, type GalleryItem } from "./Gallery";
import { VideoGallery, type VideoItem } from "./VideoGallery";
import { ProjectModels } from "./ProjectModels";

function toGallery(images: Project["images"], locale: Locale, fallbackAlt: string): GalleryItem[] {
  return images
    .map((img) => {
      const src = imageSrc(img);
      if (!src) return null;
      return {
        id: img.id,
        src,
        thumb: imageThumb(img) ?? src,
        width: img.width ?? 1600,
        height: img.height ?? 1200,
        alt: pick(img, "alt", locale) || fallbackAlt,
        blur: img.blur_data_url,
        credit: img.credit,
      };
    })
    .filter(Boolean) as GalleryItem[];
}

export function ProjectDetail({
  project,
  locale,
  t,
  neighbours,
  showDemo = true,
  preview = false,
}: {
  project: Project;
  locale: Locale;
  t: Dictionary;
  neighbours?: { prev: { href: string; title: string } | null; next: { href: string; title: string } | null };
  showDemo?: boolean;
  preview?: boolean;
}) {
  const tr = translation(project, locale);
  const cover = coverImage(project);
  const coverSrc = imageSrc(cover);
  const gallery = toGallery(
    galleryImages(project).filter((i) => i.id !== cover?.id || galleryImages(project).length === 1),
    locale,
    tr.title,
  );
  const production = toGallery(productionImages(project), locale, tr.title);
  const models = project.models
    .filter((m) => m.display_status === "ready" && m.display_path)
    .map((m) => ({ id: m.id, url: mediaUrl(m.display_path)!, label: pick(m, "label", locale) }));
  const videos: VideoItem[] = project.videos.map((v) => ({
    id: v.id,
    kind: v.kind,
    kindLabel: t.project.videoKinds[v.kind] ?? v.kind,
    caption: pick(v, "caption", locale),
    src: v.source === "upload" ? mediaUrl(v.storage_path) : null,
    mime: v.mime_type,
    poster: mediaUrl(v.poster_path),
    external: v.source === "external" ? v.external_url : null,
    vertical: !!(v.width && v.height && v.height > v.width),
  }));

  const facts = [
    { label: t.project.category, value: project.category ? pick(project.category, "name", locale) : null },
    { label: t.project.scale, value: project.scale },
    { label: t.project.dimensions, value: project.dimensions },
    { label: t.project.materials, value: pick(project, "materials", locale) || null },
    { label: t.project.location, value: pick(project, "location", locale) || null },
    { label: t.project.date, value: formatProjectDate(project.project_date, locale) },
  ].filter((f) => f.value);

  const paragraphs = tr.description.split(/\n{2,}/).filter((p) => p.trim());
  const galleryLabels = { close: t.project.close, next: t.project.next, prev: t.project.prev, photo: t.project.photo, credit: t.project.credit };

  return (
    <article className="pb-24">
      {/* Title block */}
      <header className="container-x pt-[calc(var(--header-h)+3rem)] md:pt-[calc(var(--header-h)+5rem)]">
        <Link href={localePath(locale, "/projects")} className="eyebrow inline-flex items-center gap-3 text-graphite hover:text-ink">
          <span aria-hidden>←</span> {t.project.back}
        </Link>
        <div className="grid-12 mt-10 gap-y-8">
          <div className="col-span-12 lg:col-span-8">
            <p className="eyebrow flex flex-wrap items-center gap-3 text-graphite">
              {project.category && <span>{pick(project.category, "name", locale)}</span>}
              {project.scale && (
                <>
                  <span aria-hidden className="h-px w-6 bg-current opacity-50" />
                  <span>{project.scale}</span>
                </>
              )}
              {showDemo && project.is_demo && (
                <span className="rounded-full border border-ink/20 px-2.5 py-0.5 text-[0.62rem]">{t.work.demo}</span>
              )}
              {preview && project.status !== "published" && (
                <span className="rounded-full bg-lamp px-2.5 py-0.5 text-[0.62rem] text-ink">DRAFT</span>
              )}
            </p>
            <Reveal>
              <h1 className="display-xl mt-6 text-balance">{tr.title}</h1>
            </Reveal>
          </div>
          {tr.short_description && (
            <Reveal className="col-span-12 self-end lg:col-span-4" delay={0.1}>
              <p className="lead text-graphite">{tr.short_description}</p>
            </Reveal>
          )}
        </div>
      </header>

      {/* Cover */}
      {coverSrc && cover && (
        <RevealImage className="container-x mt-14 md:mt-20">
          <div className="relative aspect-[4/3] overflow-hidden bg-stone md:aspect-[16/9]">
            <Image
              src={coverSrc}
              alt={pick(cover, "alt", locale) || tr.title}
              fill
              priority
              sizes="100vw"
              placeholder={cover.blur_data_url ? "blur" : "empty"}
              blurDataURL={cover.blur_data_url ?? undefined}
              className="object-cover"
            />
          </div>
        </RevealImage>
      )}

      {/* Facts + description */}
      <section className="container-x grid-12 mt-16 gap-y-12 md:mt-24">
        {facts.length > 0 && (
          <dl className="col-span-12 grid grid-cols-2 gap-x-6 gap-y-8 self-start lg:col-span-4 lg:grid-cols-1">
            {facts.map((f) => (
              <div key={f.label} className="border-t hairline pt-4">
                <dt className="eyebrow text-concrete">{f.label}</dt>
                <dd className="mt-2 text-[1.02rem]">{f.value}</dd>
              </div>
            ))}
          </dl>
        )}
        <div className={`col-span-12 ${facts.length ? "lg:col-span-7 lg:col-start-6" : "lg:col-span-8"}`}>
          <Reveal className="prose-studio lead max-w-[42rem] whitespace-pre-line text-ink/85">
            {paragraphs.map((p, i) => (
              <p key={i}>{p}</p>
            ))}
          </Reveal>
        </div>
      </section>

      {/* 3D */}
      {models.length > 0 && (
        <section className="container-x mt-24 md:mt-36" aria-labelledby="p-3d">
          <div className="mb-8 flex flex-wrap items-end justify-between gap-4">
            <div>
              <SectionLabel index="3D" label={t.project.model3d} />
              <h2 id="p-3d" className="display-md mt-5">{t.project.model3dHint}</h2>
            </div>
          </div>
          <ProjectModels
            models={models}
            labels={{
              reset: t.project.resetView,
              fullscreen: t.project.fullscreen,
              hint: t.project.model3dHint,
              loading: t.common.loading,
              error: t.project.model3dError,
              autoRotate: t.project.autoRotate,
            }}
          />
        </section>
      )}

      {/* Gallery */}
      {gallery.length > 0 && (
        <section className="container-x mt-24 md:mt-36" aria-labelledby="p-gallery">
          <SectionLabel index="01" label={t.project.gallery} />
          <h2 id="p-gallery" className="sr-only">{t.project.gallery}</h2>
          <div className="mt-8">
            <Gallery items={gallery} labels={galleryLabels} />
          </div>
        </section>
      )}

      {/* Production */}
      {production.length > 0 && (
        <section className="container-x mt-24 md:mt-36" aria-labelledby="p-production">
          <SectionLabel index="02" label={t.project.production} />
          <h2 id="p-production" className="display-md mb-8 mt-5">{t.project.production}</h2>
          <Gallery items={production} labels={galleryLabels} variant="strip" />
        </section>
      )}

      {/* Videos */}
      {videos.length > 0 && (
        <section className="container-x mt-24 md:mt-36" aria-labelledby="p-videos">
          <SectionLabel index="03" label={t.project.videos} />
          <h2 id="p-videos" className="sr-only">{t.project.videos}</h2>
          <div className="mt-8">
            <VideoGallery items={videos} labels={{ play: t.project.playVideo, external: t.project.externalVideo }} />
          </div>
        </section>
      )}

      {/* Inquiry CTA */}
      <section className="container-x mt-28 md:mt-40">
        <div className="flex flex-col items-start justify-between gap-8 border-y hairline py-12 md:flex-row md:items-center md:py-16">
          <h2 className="display-md max-w-xl">{t.project.inquire}</h2>
          <Link href={localePath(locale, "/#contact")} className="btn btn-solid group">
            {t.project.inquireCta}
            <span aria-hidden className="transition-transform duration-500 group-hover:translate-x-1">→</span>
          </Link>
        </div>
      </section>

      {/* Prev / next */}
      {neighbours && (neighbours.prev || neighbours.next) && (
        <nav aria-label={t.project.back} className="container-x mt-12 grid gap-6 sm:grid-cols-2">
          {neighbours.prev ? (
            <Link href={neighbours.prev.href} className="group block">
              <span className="eyebrow text-concrete">← {t.project.prev}</span>
              <span className="mt-2 block text-lg transition-colors group-hover:text-graphite">{neighbours.prev.title}</span>
            </Link>
          ) : (
            <span />
          )}
          {neighbours.next && (
            <Link href={neighbours.next.href} className="group block sm:text-right">
              <span className="eyebrow text-concrete">{t.project.next} →</span>
              <span className="mt-2 block text-lg transition-colors group-hover:text-graphite">{neighbours.next.title}</span>
            </Link>
          )}
        </nav>
      )}
    </article>
  );
}
