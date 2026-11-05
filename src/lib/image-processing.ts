import "server-only";
import sharp from "sharp";
import { sniff } from "@/lib/media-rules";

export interface ProcessedImage {
  optimized: Buffer;
  thumb: Buffer;
  width: number;
  height: number;
  blurDataUrl: string;
}

/**
 * Validate and optimize an uploaded photograph:
 *  - content is sniffed (JPEG/PNG/WebP only) and decoded by sharp
 *  - EXIF orientation applied, metadata stripped
 *  - full-size WebP (max 2560 px long edge, q86 — visually lossless for photography)
 *  - thumbnail WebP (960 px, q80) and a tiny blur placeholder
 */
export async function processImage(input: Buffer): Promise<ProcessedImage> {
  const kind = sniff(new Uint8Array(input.subarray(0, 16)));
  if (!kind || !["jpeg", "png", "webp"].includes(kind)) throw new Error("The file is not a valid JPG, PNG or WebP image.");

  const base = sharp(input, { failOn: "error", limitInputPixels: 120_000_000 }).rotate();
  const meta = await base.metadata();
  if (!meta.width || !meta.height) throw new Error("Could not read image dimensions.");

  const optimized = await base
    .clone()
    .resize({ width: 2560, height: 2560, fit: "inside", withoutEnlargement: true })
    .webp({ quality: 86, effort: 5, smartSubsample: true })
    .toBuffer({ resolveWithObject: true });

  const thumb = await base
    .clone()
    .resize({ width: 960, height: 960, fit: "inside", withoutEnlargement: true })
    .webp({ quality: 80, effort: 4 })
    .toBuffer();

  const blur = await base.clone().resize(20, 20, { fit: "inside" }).webp({ quality: 40 }).toBuffer();

  return {
    optimized: optimized.data,
    thumb,
    width: optimized.info.width,
    height: optimized.info.height,
    blurDataUrl: `data:image/webp;base64,${blur.toString("base64")}`,
  };
}

/** Site images (services, studio, hero, Open Graph): single optimized WebP. */
export async function processSiteImage(input: Buffer, maxEdge = 2200, og = false) {
  const kind = sniff(new Uint8Array(input.subarray(0, 16)));
  if (!kind || !["jpeg", "png", "webp"].includes(kind)) throw new Error("The file is not a valid JPG, PNG or WebP image.");
  const img = sharp(input, { failOn: "error" }).rotate();
  if (og) {
    // Open Graph images must be JPEG/PNG for some platforms; 1200×630 crop.
    return { buffer: await img.resize(1200, 630, { fit: "cover" }).jpeg({ quality: 86, mozjpeg: true }).toBuffer(), contentType: "image/jpeg", ext: "jpg" };
  }
  return {
    buffer: await img.resize({ width: maxEdge, height: maxEdge, fit: "inside", withoutEnlargement: true }).webp({ quality: 84 }).toBuffer(),
    contentType: "image/webp",
    ext: "webp",
  };
}
