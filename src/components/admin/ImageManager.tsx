"use client";

/* eslint-disable @next/next/no-img-element -- admin thumbnails are already optimized WebP */
import { useRef, useState } from "react";
import type { ImageKind, ProjectImage } from "@/lib/types";
import { imageThumb } from "@/lib/storage";
import { IMAGE_RULES, checkImage, ext, formatBytes } from "@/lib/media-rules";
import { newId, uploadToStorage } from "@/lib/admin/upload-client";
import { deleteImage, registerImage, reorderMedia, replaceImage, setCoverImage, updateImage } from "@/app/admin/actions/media";
import { Dropzone } from "./Dropzone";
import { UploadQueueView, useUploadQueue } from "./UploadQueue";
import { DragHandle, SortableList } from "./Sortable";
import { Badge, Button, TextInput, useConfirm, useToast } from "./ui";

export function ImageManager({
  projectId,
  kind,
  images,
  coverId,
  onImagesChange,
  onCoverChange,
}: {
  projectId: string;
  kind: ImageKind;
  images: ProjectImage[];
  coverId: string | null;
  onImagesChange: (updater: (all: ProjectImage[]) => ProjectImage[]) => void;
  onCoverChange: (id: string | null) => void;
}) {
  const toast = useToast();
  const confirm = useConfirm();
  const queue = useUploadQueue(2);
  const [editing, setEditing] = useState<string | null>(null);
  const replaceInput = useRef<HTMLInputElement>(null);
  const replaceTarget = useRef<string | null>(null);
  const list = images.filter((i) => i.kind === kind);

  const uploadOriginal = async (file: File, helpers: { setProgress: (p: number) => void; setStage: (s: string) => void; signal: AbortSignal }) => {
    const path = `projects/${projectId}/originals/${newId()}.${ext(file.name) === "jpeg" ? "jpg" : ext(file.name)}`;
    helpers.setStage("Uploading");
    await uploadToStorage({ bucket: "originals", path, file, onProgress: helpers.setProgress, signal: helpers.signal });
    helpers.setStage("Optimizing…");
    return path;
  };

  const onFiles = (files: File[]) => {
    for (const file of files) {
      const problem = checkImage(file);
      if (problem) {
        queue.reject(file, problem);
        continue;
      }
      queue.add(file, async (h) => {
        const originalPath = await uploadOriginal(file, h);
        const res = await registerImage({ projectId, originalPath, kind, fileName: file.name });
        if (!res.ok) throw new Error(res.error);
        onImagesChange((all) => [...all, res.data.image]);
        if (res.data.isCover) onCoverChange(res.data.image.id);
      });
    }
  };

  const onReplace = (file: File | undefined) => {
    const target = replaceTarget.current;
    if (!file || !target) return;
    const problem = checkImage(file);
    if (problem) return toast("error", problem);
    queue.add(file, async (h) => {
      const originalPath = await uploadOriginal(file, h);
      const res = await replaceImage({ imageId: target, originalPath });
      if (!res.ok) throw new Error(res.error);
      onImagesChange((all) => all.map((i) => (i.id === target ? res.data : i)));
      toast("success", "Photo replaced.");
    });
  };

  const reorder = async (next: ProjectImage[]) => {
    onImagesChange((all) => [...all.filter((i) => i.kind !== kind), ...next.map((img, i) => ({ ...img, sort_order: i + 1 }))]);
    const res = await reorderMedia("project_images", next.map((i) => i.id));
    if (!res.ok) toast("error", res.error);
  };

  const remove = async (img: ProjectImage) => {
    const ok = await confirm({ title: "Delete this photo?", message: "The photo and its optimized versions will be removed permanently.", confirmLabel: "Delete", danger: true });
    if (!ok) return;
    const res = await deleteImage(img.id);
    if (!res.ok) return toast("error", res.error);
    onImagesChange((all) => all.filter((i) => i.id !== img.id));
    onCoverChange(res.data.coverId);
    toast("success", "Photo deleted.");
  };

  const saveAlt = async (img: ProjectImage, patch: { alt_ka?: string; alt_en?: string; kind?: ImageKind }) => {
    const res = await updateImage(img.id, patch);
    if (!res.ok) return toast("error", res.error);
    onImagesChange((all) => all.map((i) => (i.id === img.id ? { ...i, ...patch } : i)));
  };

  const makeCover = async (img: ProjectImage) => {
    const res = await setCoverImage(projectId, img.id);
    if (!res.ok) return toast("error", res.error);
    onCoverChange(img.id);
    toast("success", "Cover photo updated.");
  };

  return (
    <div>
      <Dropzone
        accept={IMAGE_RULES.accept}
        onFiles={onFiles}
        title={kind === "gallery" ? "Drop project photographs here, or click to choose" : "Drop production / process photographs here"}
        hint={`JPG, PNG or WebP · up to ${IMAGE_RULES.maxBytes / 1024 / 1024} MB each · optimized automatically (WebP + thumbnails)`}
      />
      <UploadQueueView queue={queue} />
      <input ref={replaceInput} type="file" accept={IMAGE_RULES.accept} className="hidden" onChange={(e) => { onReplace(e.target.files?.[0]); e.target.value = ""; }} />

      {list.length > 0 && (
        <SortableList items={list} onReorder={reorder} className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-4">
          {(img, handle) => {
            const thumb = imageThumb(img);
            const isCover = img.id === coverId;
            return (
              <div className={`overflow-hidden rounded-lg border bg-white ${isCover ? "border-[#161614] ring-1 ring-[#161614]" : "border-black/10"}`}>
                <div className="relative aspect-[4/3] bg-black/5">
                  {thumb && <img src={thumb} alt={img.alt_en || img.alt_ka} className="h-full w-full object-cover" loading="lazy" draggable={false} />}
                  <div className="absolute left-1.5 top-1.5 flex gap-1">
                    {isCover && <Badge tone="info">Cover</Badge>}
                    {img.external_url && <Badge>Demo</Badge>}
                  </div>
                  <div className="absolute right-1 top-1 rounded-md bg-white/85 backdrop-blur">
                    <DragHandle handle={handle} />
                  </div>
                </div>
                <div className="space-y-2 p-2.5">
                  <p className="truncate text-[0.72rem] text-black/50">
                    {img.width && img.height ? `${img.width}×${img.height}` : ""} · {formatBytes(img.size_bytes)}
                  </p>
                  {editing === img.id ? (
                    <div className="space-y-2">
                      <TextInput defaultValue={img.alt_ka} placeholder="Alt text (GE)" lang="ka" aria-label="Alt text Georgian" onBlur={(e) => e.target.value !== img.alt_ka && saveAlt(img, { alt_ka: e.target.value })} />
                      <TextInput defaultValue={img.alt_en} placeholder="Alt text (EN)" aria-label="Alt text English" onBlur={(e) => e.target.value !== img.alt_en && saveAlt(img, { alt_en: e.target.value })} />
                      <Button size="sm" variant="ghost" onClick={() => setEditing(null)}>
                        Done
                      </Button>
                    </div>
                  ) : (
                    <p className="line-clamp-2 min-h-[2.2em] text-[0.75rem] text-black/70">{img.alt_ka || img.alt_en || <span className="text-black/35">No alt text</span>}</p>
                  )}
                  <div className="flex flex-wrap gap-1">
                    {kind === "gallery" && !isCover && (
                      <Button size="sm" variant="ghost" onClick={() => makeCover(img)}>
                        Set cover
                      </Button>
                    )}
                    <Button size="sm" variant="ghost" onClick={() => setEditing(editing === img.id ? null : img.id)}>
                      Alt text
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => {
                        replaceTarget.current = img.id;
                        replaceInput.current?.click();
                      }}
                    >
                      Replace
                    </Button>
                    <Button size="sm" variant="ghost" onClick={() => saveAlt(img, { kind: kind === "gallery" ? "production" : "gallery" })} title="Move between gallery and production photos">
                      {kind === "gallery" ? "→ Production" : "→ Gallery"}
                    </Button>
                    <Button size="sm" variant="ghost" className="text-[#a4442e]" onClick={() => remove(img)}>
                      Delete
                    </Button>
                  </div>
                </div>
              </div>
            );
          }}
        </SortableList>
      )}
      {list.length === 0 && queue.items.length === 0 && <p className="mt-4 text-[0.8rem] text-black/45">No photos yet.</p>}
    </div>
  );
}
