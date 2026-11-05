"use client";

import Image from "next/image";
import { useState } from "react";
import { embedUrl } from "@/lib/video";

export type VideoItem = {
  id: string;
  kind: string;
  kindLabel: string;
  caption: string;
  src: string | null;
  mime: string | null;
  poster: string | null;
  external: string | null;
  vertical: boolean;
};

/**
 * Videos load only when the visitor presses play (preload="none" + poster),
 * so project pages stay fast on mobile.
 */
function VideoCard({ v, labels }: { v: VideoItem; labels: { play: string; external: string } }) {
  const [playing, setPlaying] = useState(false);
  const embed = v.external ? embedUrl(v.external) : null;
  const ratio = v.vertical ? "aspect-[9/16]" : "aspect-video";

  return (
    <figure>
      <div className={`relative overflow-hidden bg-charcoal ${ratio}`}>
        {playing && v.src ? (
          <video
            className="absolute inset-0 h-full w-full object-cover"
            controls
            autoPlay
            playsInline
            preload="none"
            poster={v.poster ?? undefined}
          >
            <source src={v.src} type={v.mime ?? undefined} />
          </video>
        ) : playing && embed ? (
          <iframe
            src={embed}
            title={v.caption || v.kindLabel}
            className="absolute inset-0 h-full w-full"
            allow="accelerometer; autoplay; encrypted-media; gyroscope; picture-in-picture; fullscreen"
            allowFullScreen
            loading="lazy"
          />
        ) : (
          <>
            {v.poster && <Image src={v.poster} alt="" fill sizes="(min-width: 768px) 50vw, 100vw" className="object-cover opacity-90" />}
            {v.src || embed ? (
              <button
                type="button"
                onClick={() => setPlaying(true)}
                className="group absolute inset-0 flex items-center justify-center"
                aria-label={`${labels.play}: ${v.caption || v.kindLabel}`}
              >
                <span className="flex h-16 w-16 items-center justify-center rounded-full bg-paper/90 text-ink shadow-xl transition-transform duration-500 group-hover:scale-110">
                  <svg viewBox="0 0 24 24" className="ml-1 h-5 w-5" fill="currentColor" aria-hidden>
                    <path d="M7 4.5v15l13-7.5z" />
                  </svg>
                </span>
              </button>
            ) : v.external ? (
              <a
                href={v.external}
                target="_blank"
                rel="noopener noreferrer"
                className="absolute inset-0 flex items-center justify-center text-paper"
              >
                <span className="rounded-full border border-paper/40 px-5 py-2.5 text-sm hover:border-paper">{labels.external} ↗</span>
              </a>
            ) : null}
          </>
        )}
      </div>
      <figcaption className="mt-3 flex items-baseline justify-between gap-4">
        <span className="text-sm">{v.caption}</span>
        <span className="eyebrow shrink-0 text-concrete">{v.kindLabel}</span>
      </figcaption>
    </figure>
  );
}

export function VideoGallery({ items, labels }: { items: VideoItem[]; labels: { play: string; external: string } }) {
  if (!items.length) return null;
  return (
    <ul className="grid gap-x-6 gap-y-12 sm:grid-cols-2 lg:grid-cols-3">
      {items.map((v) => (
        <li key={v.id}>
          <VideoCard v={v} labels={labels} />
        </li>
      ))}
    </ul>
  );
}
