"use client";

/* eslint-disable @next/next/no-img-element */
import { useState } from "react";
import type { ProjectVideo } from "@/lib/types";
import { mediaUrl } from "@/lib/storage";
import { VIDEO_RULES, checkVideo, ext, formatBytes } from "@/lib/media-rules";
import { newId, uploadToStorage } from "@/lib/admin/upload-client";
import { inspectVideo } from "@/lib/admin/video-poster";
import { addExternalVideo, deleteVideo, registerVideo, reorderMedia, updateVideo } from "@/app/admin/actions/media";
import { Dropzone } from "./Dropzone";
import { UploadQueueView, useUploadQueue } from "./UploadQueue";
import { DragHandle, SortableList } from "./Sortable";
import { Badge, Button, Select, TextInput, useConfirm, useToast } from "./ui";

export const VIDEO_KINDS: { value: ProjectVideo["kind"]; label: string }[] = [
  { value: "finished", label: "Finished model" },
  { value: "production", label: "Production process" },
  { value: "behind_the_scenes", label: "Behind the scenes" },
  { value: "walkthrough", label: "Model walkthrough" },
  { value: "detail", label: "Close-up details" },
];

export function VideoManager({ projectId, videos, onChange }: { projectId: string; videos: ProjectVideo[]; onChange: (updater: (v: ProjectVideo[]) => ProjectVideo[]) => void }) {
  const toast = useToast();
  const confirm = useConfirm();
  const queue = useUploadQueue(1);
  const [kind, setKind] = useState<ProjectVideo["kind"]>("finished");
  const [link, setLink] = useState("");
  const [adding, setAdding] = useState(false);
  const [preview, setPreview] = useState<string | null>(null);

  const onFiles = (files: File[]) => {
    for (const file of files) {
      const problem = checkVideo(file);
      if (problem) {
        queue.reject(file, problem);
        continue;
      }
      const chosenKind = kind;
      queue.add(file, async (h) => {
        h.setStage("Reading video…");
        const info = await inspectVideo(file);
        const id = newId();
        const storagePath = `projects/${projectId}/videos/${id}.${ext(file.name)}`;
        h.setStage("Uploading");
        await uploadToStorage({ bucket: "media", path: storagePath, file, contentType: file.type || (ext(file.name) === "webm" ? "video/webm" : "video/mp4"), onProgress: h.setProgress, signal: h.signal });
        let posterPath: string | null = null;
        if (info.poster) {
          const posterExt = info.poster.type === "image/webp" ? "webp" : info.poster.type === "image/jpeg" ? "jpg" : "png";
          posterPath = `projects/${projectId}/videos/${id}-poster.${posterExt}`;
          await uploadToStorage({ bucket: "media", path: posterPath, file: info.poster, contentType: info.poster.type });
        }
        h.setStage("Processing…");
        const res = await registerVideo({ projectId, storagePath, posterPath, kind: chosenKind, durationSeconds: info.duration, width: info.width, height: info.height });
        if (!res.ok) throw new Error(res.error);
        onChange((v) => [...v, res.data]);
      });
    }
  };

  const addLink = async () => {
    setAdding(true);
    const res = await addExternalVideo({ projectId, url: link, kind, caption_ka: "", caption_en: "" });
    setAdding(false);
    if (!res.ok) return toast("error", res.error);
    onChange((v) => [...v, res.data]);
    setLink("");
    toast("success", "Video link added.");
  };

  const patch = async (v: ProjectVideo, p: { caption_ka?: string; caption_en?: string; kind?: string }) => {
    const res = await updateVideo(v.id, p);
    if (!res.ok) return toast("error", res.error);
    onChange((list) => list.map((x) => (x.id === v.id ? ({ ...x, ...p } as ProjectVideo) : x)));
  };

  const remove = async (v: ProjectVideo) => {
    if (!(await confirm({ title: "Delete this video?", message: v.source === "upload" ? "The video file and its poster will be deleted." : "The link will be removed.", confirmLabel: "Delete", danger: true }))) return;
    const res = await deleteVideo(v.id);
    if (!res.ok) return toast("error", res.error);
    onChange((list) => list.filter((x) => x.id !== v.id));
  };

  const reorder = async (next: ProjectVideo[]) => {
    onChange(() => next.map((v, i) => ({ ...v, sort_order: i + 1 })));
    const res = await reorderMedia("project_videos", next.map((v) => v.id));
    if (!res.ok) toast("error", res.error);
  };

  return (
    <div>
      <div className="mb-3 grid gap-3 sm:grid-cols-[14rem_1fr]">
        <Select label="Type for new videos" id="video-kind" value={kind} onChange={(e) => setKind(e.target.value as ProjectVideo["kind"])}>
          {VIDEO_KINDS.map((k) => (
            <option key={k.value} value={k.value}>
              {k.label}
            </option>
          ))}
        </Select>
        <div>
          <label htmlFor="video-link" className="mb-1.5 block text-[0.8rem] font-medium text-black/75">
            …or add an external link <span className="font-normal text-black/45">(YouTube, Vimeo, TikTok)</span>
          </label>
          <div className="flex gap-2">
            <TextInput id="video-link" type="url" placeholder="https://…" value={link} onChange={(e) => setLink(e.target.value)} />
            <Button onClick={addLink} loading={adding} disabled={!link.trim()}>
              Add link
            </Button>
          </div>
        </div>
      </div>
      <Dropzone
        accept={VIDEO_RULES.accept}
        onFiles={onFiles}
        title="Drop video files here, or click to choose"
        hint={`MP4 (H.264) or WebM · up to ${VIDEO_RULES.maxBytes / 1024 / 1024} MB · a poster frame is captured automatically`}
      />
      <UploadQueueView queue={queue} />

      {videos.length > 0 && (
        <SortableList items={videos} onReorder={reorder} layout="list" className="mt-5 space-y-3">
          {(v, handle) => (
            <div className="flex flex-col gap-3 rounded-lg border border-black/10 bg-white p-3 sm:flex-row">
              <div className="flex items-start gap-2">
                <DragHandle handle={handle} />
                <div className="relative aspect-video w-full overflow-hidden rounded-md bg-black/80 sm:w-48">
                  {preview === v.id && v.storage_path ? (
                    <video src={mediaUrl(v.storage_path)!} poster={mediaUrl(v.poster_path) ?? undefined} controls autoPlay playsInline className="h-full w-full object-contain" />
                  ) : (
                    <>
                      {v.poster_path && <img src={mediaUrl(v.poster_path)!} alt="" className="h-full w-full object-cover" />}
                      {v.source === "upload" ? (
                        <button type="button" onClick={() => setPreview(v.id)} className="absolute inset-0 flex items-center justify-center text-white" aria-label="Preview video">
                          <span className="flex h-10 w-10 items-center justify-center rounded-full bg-white/90 text-black">▶</span>
                        </button>
                      ) : (
                        <a href={v.external_url!} target="_blank" rel="noopener noreferrer" className="absolute inset-0 flex items-center justify-center p-2 text-center text-[0.7rem] text-white/85 underline">
                          {v.external_url}
                        </a>
                      )}
                    </>
                  )}
                </div>
              </div>
              <div className="grid flex-1 gap-2 sm:grid-cols-2">
                <TextInput aria-label="Caption Georgian" placeholder="Caption (GE)" lang="ka" defaultValue={v.caption_ka} onBlur={(e) => e.target.value !== v.caption_ka && patch(v, { caption_ka: e.target.value })} />
                <TextInput aria-label="Caption English" placeholder="Caption (EN)" defaultValue={v.caption_en} onBlur={(e) => e.target.value !== v.caption_en && patch(v, { caption_en: e.target.value })} />
                <Select aria-label="Video type" value={v.kind} onChange={(e) => patch(v, { kind: e.target.value })}>
                  {VIDEO_KINDS.map((k) => (
                    <option key={k.value} value={k.value}>
                      {k.label}
                    </option>
                  ))}
                </Select>
                <div className="flex items-center justify-between gap-2">
                  <span className="flex flex-wrap gap-1 text-[0.72rem] text-black/50">
                    <Badge>{v.source === "upload" ? (v.mime_type === "video/webm" ? "WebM" : "MP4") : "External"}</Badge>
                    {v.source === "upload" && <span>{formatBytes(v.size_bytes)}</span>}
                    {v.duration_seconds ? <span>· {Math.round(Number(v.duration_seconds))}s</span> : null}
                  </span>
                  <Button size="sm" variant="ghost" className="text-[#a4442e]" onClick={() => remove(v)}>
                    Delete
                  </Button>
                </div>
              </div>
            </div>
          )}
        </SortableList>
      )}
      {videos.length === 0 && queue.items.length === 0 && <p className="mt-4 text-[0.8rem] text-black/45">No videos yet.</p>}
    </div>
  );
}
