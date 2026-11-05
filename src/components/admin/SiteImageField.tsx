"use client";

/* eslint-disable @next/next/no-img-element */
import { useState } from "react";
import { mediaUrl } from "@/lib/storage";
import { IMAGE_RULES, checkImage, ext } from "@/lib/media-rules";
import { newId, uploadToStorage } from "@/lib/admin/upload-client";
import { processUploadedSiteImage } from "@/app/admin/actions/content";
import { Dropzone } from "./Dropzone";
import { Button, useToast } from "./ui";

/** Single image picker for site content. Returns the optimized path in the public bucket. */
export function SiteImageField({
  label,
  value,
  fallbackUrl,
  purpose,
  onChange,
  aspect = "aspect-[4/3]",
}: {
  label: string;
  value: string | null;
  fallbackUrl?: string | null;
  purpose: "service" | "studio" | "hero" | "og";
  onChange: (path: string | null) => void;
  aspect?: string;
}) {
  const toast = useToast();
  const [progress, setProgress] = useState<number | null>(null);
  const preview = mediaUrl(value) ?? fallbackUrl ?? null;

  const onFiles = async (files: File[]) => {
    const file = files[0];
    const problem = checkImage(file);
    if (problem) return toast("error", problem);
    try {
      setProgress(0);
      const e = ext(file.name) === "jpeg" ? "jpg" : ext(file.name);
      const tmpPath = `site/tmp/${newId()}.${e}`;
      await uploadToStorage({ bucket: "originals", path: tmpPath, file, onProgress: setProgress });
      setProgress(1);
      const res = await processUploadedSiteImage({ tmpPath, purpose });
      if (!res.ok) throw new Error(res.error);
      onChange(res.data.path);
      toast("info", "Image uploaded — remember to save.");
    } catch (e) {
      toast("error", e instanceof Error ? e.message : "Upload failed");
    } finally {
      setProgress(null);
    }
  };

  return (
    <div>
      <p className="mb-1.5 text-[0.8rem] font-medium text-black/75">{label}</p>
      <div className="grid gap-3 sm:grid-cols-[12rem_1fr]">
        <div className={`relative overflow-hidden rounded-lg bg-black/5 ${aspect}`}>
          {preview ? <img src={preview} alt="" className="h-full w-full object-cover" /> : <span className="absolute inset-0 flex items-center justify-center text-[0.75rem] text-black/40">No image</span>}
          {!value && fallbackUrl && <span className="absolute left-1.5 top-1.5 rounded bg-white/85 px-1.5 py-0.5 text-[0.65rem]">Default / demo</span>}
        </div>
        <div className="space-y-2">
          <Dropzone
            compact
            multiple={false}
            accept={IMAGE_RULES.accept}
            onFiles={onFiles}
            disabled={progress !== null}
            title={progress !== null ? `Uploading… ${Math.round(progress * 100)}%` : "Drop an image or click to choose"}
            hint={purpose === "og" ? "Cropped to 1200×630 for social sharing" : "JPG, PNG or WebP · optimized automatically"}
          />
          {value && (
            <Button size="sm" variant="ghost" className="text-[#a4442e]" onClick={() => onChange(null)}>
              Remove image
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}
