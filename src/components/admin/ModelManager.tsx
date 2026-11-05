"use client";

import dynamic from "next/dynamic";
import { useEffect, useRef, useState } from "react";
import type { ProjectModel } from "@/lib/types";
import { mediaUrl } from "@/lib/storage";
import { MODEL_RULES, checkModel, ext, formatBytes } from "@/lib/media-rules";
import { newId, uploadToStorage } from "@/lib/admin/upload-client";
import { deleteModel, originalDownloadUrl, registerModel, reorderMedia, updateModel } from "@/app/admin/actions/media";
import { Dropzone } from "./Dropzone";
import { UploadQueueView, useUploadQueue } from "./UploadQueue";
import { DragHandle, SortableList } from "./Sortable";
import { Badge, Button, TextInput, useConfirm, useToast } from "./ui";

const ModelViewer = dynamic(() => import("@/components/three/ModelViewer"), {
  ssr: false,
  loading: () => <div className="flex h-full items-center justify-center text-sm text-black/50">Loading 3D viewer…</div>,
});

const viewerLabels = {
  reset: "Reset camera",
  fullscreen: "Fullscreen",
  hint: "Drag to rotate · scroll to zoom · right-drag to pan",
  loading: "Loading model",
  error: "This model could not be displayed in the browser.",
  wireframe: "Wireframe",
  autoRotate: "Auto-rotate",
};

type Pending = { file: File; glb: Blob | null; url: string | null; triangles: number | null; error: string | null; converted: boolean; replaceId: string | null };

/**
 * 3D workflow: choose a file → it is parsed/converted to GLB in the browser →
 * inspect it in the preview → confirm upload. Original + GLB are stored.
 */
export function ModelManager({ projectId, models, onChange }: { projectId: string; models: ProjectModel[]; onChange: (updater: (m: ProjectModel[]) => ProjectModel[]) => void }) {
  const toast = useToast();
  const confirm = useConfirm();
  const queue = useUploadQueue(1);
  const [pending, setPending] = useState<Pending | null>(null);
  const [converting, setConverting] = useState(false);
  const [viewing, setViewing] = useState<string | null>(models.find((m) => m.display_status === "ready")?.id ?? null);
  const replaceInput = useRef<HTMLInputElement>(null);
  const replaceTarget = useRef<string | null>(null);

  useEffect(() => () => {
    if (pending?.url) URL.revokeObjectURL(pending.url);
  }, [pending]);

  const prepare = async (file: File, replaceId: string | null = null) => {
    const problem = checkModel(file);
    if (problem) return toast("error", problem);
    setConverting(true);
    const { convertModel } = await import("@/lib/admin/model-convert");
    const result = await convertModel(file);
    setConverting(false);
    if (result.ok) {
      setPending({ file, glb: result.glb, url: URL.createObjectURL(result.glb), triangles: result.triangles, error: null, converted: result.converted, replaceId });
    } else {
      setPending({ file, glb: null, url: null, triangles: null, error: result.error, converted: false, replaceId });
    }
  };

  const confirmUpload = () => {
    if (!pending) return;
    const p = pending;
    setPending(null);
    queue.add(p.file, async (h) => {
      const id = newId();
      const format = ext(p.file.name);
      let originalPath: string;
      let originalBucket: "originals" | "media";
      let displayPath: string | null = null;

      if (format === "glb" && p.glb) {
        // GLB is already web-ready: store once in the public bucket.
        originalPath = `projects/${projectId}/models/${id}.glb`;
        originalBucket = "media";
        h.setStage("Uploading");
        await uploadToStorage({ bucket: "media", path: originalPath, file: p.file, contentType: "model/gltf-binary", onProgress: h.setProgress, signal: h.signal });
        displayPath = originalPath;
      } else {
        originalPath = `projects/${projectId}/models/${id}-original.${format}`;
        originalBucket = "originals";
        h.setStage("Uploading original");
        await uploadToStorage({
          bucket: "originals",
          path: originalPath,
          file: p.file,
          contentType: "application/octet-stream",
          onProgress: (f) => h.setProgress(p.glb ? f * 0.6 : f),
          signal: h.signal,
        });
        if (p.glb) {
          displayPath = `projects/${projectId}/models/${id}.glb`;
          h.setStage("Uploading GLB");
          await uploadToStorage({ bucket: "media", path: displayPath, file: p.glb, contentType: "model/gltf-binary", onProgress: (f) => h.setProgress(0.6 + f * 0.4), signal: h.signal });
        }
      }
      h.setStage("Processing…");
      const res = await registerModel({
        projectId,
        originalPath,
        originalBucket,
        originalName: p.file.name,
        displayPath,
        triangleCount: p.triangles,
        conversionError: p.error,
        replaceId: p.replaceId,
      });
      if (!res.ok) throw new Error(res.error);
      onChange((list) => (p.replaceId ? list.map((m) => (m.id === p.replaceId ? res.data : m)) : [...list, res.data]));
      if (res.data.display_status === "ready") setViewing(res.data.id);
      toast(res.data.display_status === "ready" ? "success" : "info", res.data.display_status === "ready" ? "3D model saved." : "Original saved, but it is not browser-ready.");
    });
  };

  const remove = async (m: ProjectModel) => {
    if (!(await confirm({ title: "Delete this 3D model?", message: "The original file and the browser version will be deleted.", confirmLabel: "Delete", danger: true }))) return;
    const res = await deleteModel(m.id);
    if (!res.ok) return toast("error", res.error);
    onChange((list) => list.filter((x) => x.id !== m.id));
    if (viewing === m.id) setViewing(null);
  };

  const patch = async (m: ProjectModel, p: { label_ka?: string; label_en?: string; is_primary?: boolean }) => {
    const res = await updateModel(m.id, p);
    if (!res.ok) return toast("error", res.error);
    onChange((list) => list.map((x) => (p.is_primary ? { ...x, is_primary: x.id === m.id } : x.id === m.id ? { ...x, ...p } : x)));
  };

  const downloadOriginal = async (m: ProjectModel) => {
    const res = await originalDownloadUrl(m.original_bucket, m.original_path);
    if (!res.ok) return toast("error", res.error);
    window.open(res.data, "_blank", "noopener");
  };

  const reorder = async (next: ProjectModel[]) => {
    onChange(() => next.map((m, i) => ({ ...m, sort_order: i + 1 })));
    const res = await reorderMedia("project_models", next.map((m) => m.id));
    if (!res.ok) toast("error", res.error);
  };

  const viewed = models.find((m) => m.id === viewing && m.display_status === "ready");

  return (
    <div>
      <Dropzone
        accept={MODEL_RULES.accept}
        multiple={false}
        disabled={converting || !!pending}
        onFiles={(f) => prepare(f[0])}
        title={converting ? "Reading and converting the model…" : "Drop a 3D model here, or click to choose"}
        hint={`GLB (recommended), glTF, OBJ, FBX, STL or 3MF · up to ${MODEL_RULES.maxBytes / 1024 / 1024} MB · you can inspect it before uploading`}
      />
      <input ref={replaceInput} type="file" accept={MODEL_RULES.accept} className="hidden" onChange={(e) => { const f = e.target.files?.[0]; if (f) prepare(f, replaceTarget.current); e.target.value = ""; }} />

      {pending && (
        <div className="mt-4 overflow-hidden rounded-xl border border-black/10 bg-[#fbfaf8]">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-black/[0.06] px-4 py-3">
            <div>
              <p className="text-sm font-semibold">
                Preview · {pending.file.name} <span className="font-normal text-black/50">({formatBytes(pending.file.size)})</span>
                {pending.replaceId && <span className="ml-2"><Badge tone="warning">Replacing</Badge></span>}
              </p>
              <p className="mt-0.5 text-[0.78rem] text-black/55">
                {pending.error
                  ? "This file could not be converted for browser display. You can still store the original."
                  : pending.converted
                    ? `Converted to GLB in your browser (${formatBytes(pending.glb?.size)}, ${pending.triangles?.toLocaleString()} triangles). The original will be preserved.`
                    : `Browser-ready GLB · ${pending.triangles?.toLocaleString()} triangles.`}
              </p>
            </div>
            <div className="flex gap-2">
              <Button onClick={() => setPending(null)}>Cancel</Button>
              <Button variant="primary" onClick={confirmUpload}>
                {pending.error ? "Store original only" : pending.replaceId ? "Replace model" : "Upload model"}
              </Button>
            </div>
          </div>
          {pending.url ? (
            <ModelViewer url={pending.url} labels={viewerLabels} showInspect className="h-[420px]" />
          ) : (
            <p className="px-4 py-6 text-sm text-[#a4442e]">{pending.error}</p>
          )}
        </div>
      )}

      <UploadQueueView queue={queue} />

      {viewed?.display_path && !pending && (
        <div className="mt-4 overflow-hidden rounded-xl border border-black/10">
          <ModelViewer key={viewed.id} url={mediaUrl(viewed.display_path)!} labels={viewerLabels} showInspect className="h-[420px]" />
        </div>
      )}

      {models.length > 0 && (
        <SortableList items={models} onReorder={reorder} layout="list" className="mt-4 space-y-2">
          {(m, handle) => (
            <div className={`flex flex-col gap-3 rounded-lg border bg-white p-3 lg:flex-row lg:items-center ${viewing === m.id ? "border-black/40" : "border-black/10"}`}>
              <div className="flex min-w-0 flex-1 items-start gap-2">
                <DragHandle handle={handle} />
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium">{m.original_name}</p>
                  <p className="mt-1 flex flex-wrap items-center gap-1.5 text-[0.72rem] text-black/55">
                    <Badge>.{m.original_format}</Badge>
                    {m.display_status === "ready" ? <Badge tone="success">Browser-ready</Badge> : <Badge tone="danger">Not displayable</Badge>}
                    {m.is_primary && <Badge tone="info">Primary</Badge>}
                    <span>original {formatBytes(m.original_size)}</span>
                    {m.display_size && m.display_path !== m.original_path && <span>· GLB {formatBytes(m.display_size)}</span>}
                    {m.triangle_count ? <span>· {m.triangle_count.toLocaleString()} tris</span> : null}
                  </p>
                  {m.status_message && <p className={`mt-1 text-[0.75rem] ${m.display_status === "ready" ? "text-black/50" : "text-[#a4442e]"}`}>{m.status_message}</p>}
                </div>
              </div>
              <div className="grid gap-2 sm:grid-cols-2 lg:w-80">
                <TextInput aria-label="Label Georgian" placeholder="Label (GE)" lang="ka" defaultValue={m.label_ka} onBlur={(e) => e.target.value !== m.label_ka && patch(m, { label_ka: e.target.value })} />
                <TextInput aria-label="Label English" placeholder="Label (EN)" defaultValue={m.label_en} onBlur={(e) => e.target.value !== m.label_en && patch(m, { label_en: e.target.value })} />
              </div>
              <div className="flex flex-wrap gap-1">
                {m.display_status === "ready" && (
                  <Button size="sm" variant="ghost" onClick={() => setViewing(m.id)}>
                    Inspect
                  </Button>
                )}
                {m.display_status === "ready" && !m.is_primary && (
                  <Button size="sm" variant="ghost" onClick={() => patch(m, { is_primary: true })}>
                    Make primary
                  </Button>
                )}
                <Button size="sm" variant="ghost" onClick={() => downloadOriginal(m)}>
                  Original
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => {
                    replaceTarget.current = m.id;
                    replaceInput.current?.click();
                  }}
                >
                  Replace
                </Button>
                <Button size="sm" variant="ghost" className="text-[#a4442e]" onClick={() => remove(m)}>
                  Delete
                </Button>
              </div>
            </div>
          )}
        </SortableList>
      )}
      {models.length === 0 && !pending && queue.items.length === 0 && <p className="mt-4 text-[0.8rem] text-black/45">No 3D models yet.</p>}
    </div>
  );
}
