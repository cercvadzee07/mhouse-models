import { env } from "@/lib/env";

export const BUCKETS = {
  media: "media",
  originals: "originals",
  inquiries: "inquiries",
} as const;

/** Public URL of an object in the public `media` bucket. */
export function mediaUrl(path: string | null | undefined): string | null {
  if (!path) return null;
  if (/^https?:\/\//.test(path)) return path;
  if (!env.supabaseUrl) return null;
  const clean = path.split("/").map(encodeURIComponent).join("/");
  return `${env.supabaseUrl}/storage/v1/object/public/${BUCKETS.media}/${clean}`;
}

type ImageLike = {
  optimized_path?: string | null;
  thumb_path?: string | null;
  external_url?: string | null;
};

/** Full-size URL for a project image (uploaded or external demo image). */
export function imageSrc(img: ImageLike | null | undefined): string | null {
  if (!img) return null;
  return mediaUrl(img.optimized_path) ?? img.external_url ?? null;
}

/** Thumbnail URL (falls back to the full-size image). */
export function imageThumb(img: ImageLike | null | undefined): string | null {
  if (!img) return null;
  if (img.thumb_path) return mediaUrl(img.thumb_path);
  if (img.external_url) return img.external_url.replace(/w=\d+/, "w=900");
  return imageSrc(img);
}
