"use server";

import { randomUUID } from "node:crypto";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { adminAction, logActivity, type AdminContext } from "@/lib/auth";
import { BUCKETS } from "@/lib/storage";
import { assertProjectPath, download, objectSize, readHead, removeObjects, upload } from "@/lib/server-storage";
import { processImage } from "@/lib/image-processing";
import { IMAGE_RULES, MODEL_RULES, VIDEO_RULES, ext, modelContentMatches, sniff } from "@/lib/media-rules";
import { cleanupImageFiles, cleanupModelFiles, cleanupVideoFiles } from "@/lib/admin/cleanup";
import { isSafeExternalUrl } from "@/lib/video";
import type { ProjectImage, ProjectModel, ProjectVideo } from "@/lib/types";

const uuid = z.string().uuid();
const revalidateSite = () => revalidatePath("/", "layout");

async function nextOrder(ctx: AdminContext, table: string, projectId: string) {
  const { data } = await ctx.supabase.from(table).select("sort_order").eq("project_id", projectId).order("sort_order", { ascending: false }).limit(1).maybeSingle();
  return (data?.sort_order ?? 0) + 1;
}

async function ensureProject(ctx: AdminContext, projectId: string) {
  uuid.parse(projectId);
  const { data } = await ctx.supabase.from("projects").select("id, cover_image_id").eq("id", projectId).maybeSingle();
  if (!data) throw new Error("Project not found.");
  return data as { id: string; cover_image_id: string | null };
}

// ---------------------------------------------------------------------------
// Images
// ---------------------------------------------------------------------------

/** Process an original that the browser uploaded to the private "originals" bucket. */
async function buildImage(ctx: AdminContext, projectId: string, originalPath: string) {
  assertProjectPath(originalPath, projectId);
  const size = await objectSize(ctx.supabase, BUCKETS.originals, originalPath);
  if (size > IMAGE_RULES.maxBytes) throw new Error("Image exceeds the size limit.");
  const buffer = await download(ctx.supabase, BUCKETS.originals, originalPath);
  const processed = await processImage(buffer);
  const id = randomUUID();
  const optimizedPath = `projects/${projectId}/images/${id}.webp`;
  const thumbPath = `projects/${projectId}/images/${id}-thumb.webp`;
  await upload(ctx.supabase, BUCKETS.media, optimizedPath, processed.optimized, "image/webp");
  await upload(ctx.supabase, BUCKETS.media, thumbPath, processed.thumb, "image/webp");
  const kind = sniff(new Uint8Array(buffer.subarray(0, 16)));
  return {
    original_path: originalPath,
    optimized_path: optimizedPath,
    thumb_path: thumbPath,
    width: processed.width,
    height: processed.height,
    blur_data_url: processed.blurDataUrl,
    mime_type: kind === "png" ? "image/png" : kind === "webp" ? "image/webp" : "image/jpeg",
    size_bytes: size,
  };
}

export async function registerImage(input: { projectId: string; originalPath: string; kind: "gallery" | "production"; fileName: string }) {
  return adminAction(async (ctx) => {
    const project = await ensureProject(ctx, input.projectId);
    const kind = z.enum(["gallery", "production"]).parse(input.kind);
    try {
      const fields = await buildImage(ctx, input.projectId, input.originalPath);
      const altBase = input.fileName.replace(/\.[a-z0-9]+$/i, "").replace(/[-_]+/g, " ").slice(0, 120);
      const { data, error } = await ctx.supabase
        .from("project_images")
        .insert({
          ...fields,
          project_id: input.projectId,
          kind,
          alt_ka: "",
          alt_en: altBase,
          sort_order: await nextOrder(ctx, "project_images", input.projectId),
        })
        .select("*")
        .single();
      if (error || !data) throw new Error(error?.message ?? "Could not save image.");
      if (!project.cover_image_id && kind === "gallery") {
        await ctx.supabase.from("projects").update({ cover_image_id: data.id }).eq("id", input.projectId);
      }
      await logActivity(ctx, "upload", "image", data.id, `Uploaded photo to project`, { project_id: input.projectId });
      revalidateSite();
      return { image: data as ProjectImage, isCover: !project.cover_image_id && kind === "gallery" };
    } catch (e) {
      // Never leave an orphaned original behind on failure.
      await removeObjects(ctx.supabase, BUCKETS.originals, [input.originalPath]);
      throw e;
    }
  });
}

export async function replaceImage(input: { imageId: string; originalPath: string }) {
  return adminAction(async (ctx) => {
    const { data: old } = await ctx.supabase.from("project_images").select("*").eq("id", uuid.parse(input.imageId)).single();
    if (!old) throw new Error("Image not found.");
    try {
      const fields = await buildImage(ctx, old.project_id, input.originalPath);
      const { data, error } = await ctx.supabase.from("project_images").update({ ...fields, external_url: null }).eq("id", old.id).select("*").single();
      if (error) throw new Error(error.message);
      await cleanupImageFiles(ctx, [old]);
      await logActivity(ctx, "replace", "image", old.id, "Replaced photo", { project_id: old.project_id });
      revalidateSite();
      return data as ProjectImage;
    } catch (e) {
      await removeObjects(ctx.supabase, BUCKETS.originals, [input.originalPath]);
      throw e;
    }
  });
}

export async function updateImage(id: string, patch: { alt_ka?: string; alt_en?: string; kind?: "gallery" | "production" }) {
  return adminAction(async (ctx) => {
    const clean = z
      .object({ alt_ka: z.string().max(300).optional(), alt_en: z.string().max(300).optional(), kind: z.enum(["gallery", "production"]).optional() })
      .parse(patch);
    const { error } = await ctx.supabase.from("project_images").update(clean).eq("id", uuid.parse(id));
    if (error) throw new Error(error.message);
    revalidateSite();
    return null;
  });
}

export async function deleteImage(id: string) {
  return adminAction(async (ctx) => {
    const { data: img } = await ctx.supabase.from("project_images").select("*").eq("id", uuid.parse(id)).single();
    if (!img) throw new Error("Image not found.");
    const { error } = await ctx.supabase.from("project_images").delete().eq("id", id);
    if (error) throw new Error(error.message);
    await cleanupImageFiles(ctx, [img]);
    // If it was the cover, promote the next gallery image.
    const { data: project } = await ctx.supabase.from("projects").select("cover_image_id").eq("id", img.project_id).single();
    let newCover: string | null = project?.cover_image_id ?? null;
    if (!newCover) {
      const { data: next } = await ctx.supabase
        .from("project_images")
        .select("id")
        .eq("project_id", img.project_id)
        .eq("kind", "gallery")
        .order("sort_order")
        .limit(1)
        .maybeSingle();
      newCover = next?.id ?? null;
      if (newCover) await ctx.supabase.from("projects").update({ cover_image_id: newCover }).eq("id", img.project_id);
    }
    await logActivity(ctx, "delete", "image", id, "Deleted photo", { project_id: img.project_id });
    revalidateSite();
    return { coverId: newCover };
  });
}

export async function setCoverImage(projectId: string, imageId: string) {
  return adminAction(async (ctx) => {
    const { data: img } = await ctx.supabase.from("project_images").select("id, project_id").eq("id", uuid.parse(imageId)).single();
    if (!img || img.project_id !== projectId) throw new Error("Image does not belong to this project.");
    const { error } = await ctx.supabase.from("projects").update({ cover_image_id: imageId }).eq("id", projectId);
    if (error) throw new Error(error.message);
    await logActivity(ctx, "update", "project", projectId, "Changed cover photo");
    revalidateSite();
    return null;
  });
}

export async function reorderMedia(table: "project_images" | "project_videos" | "project_models", ids: string[]) {
  return adminAction(async (ctx) => {
    z.array(uuid).max(500).parse(ids);
    const { error } = await ctx.supabase.rpc("reorder_rows", { p_table: z.enum(["project_images", "project_videos", "project_models"]).parse(table), p_ids: ids });
    if (error) throw new Error(error.message);
    revalidateSite();
    return null;
  });
}

// ---------------------------------------------------------------------------
// Videos
// ---------------------------------------------------------------------------
const videoKind = z.enum(["finished", "production", "behind_the_scenes", "walkthrough", "detail"]);

export async function registerVideo(input: {
  projectId: string;
  storagePath: string;
  posterPath: string | null;
  kind: string;
  durationSeconds: number | null;
  width: number | null;
  height: number | null;
}) {
  return adminAction(async (ctx) => {
    await ensureProject(ctx, input.projectId);
    assertProjectPath(input.storagePath, input.projectId);
    if (input.posterPath) assertProjectPath(input.posterPath, input.projectId);
    const extension = ext(input.storagePath);
    if (!VIDEO_RULES.extensions.includes(extension)) throw new Error("Unsupported video format.");
    try {
      const size = await objectSize(ctx.supabase, BUCKETS.media, input.storagePath);
      if (size > VIDEO_RULES.maxBytes) throw new Error("Video exceeds the size limit.");
      const head = await readHead(ctx.supabase, BUCKETS.media, input.storagePath, 64);
      const kind = sniff(head);
      if (!(kind === "mp4" && extension === "mp4") && !(kind === "webm" && extension === "webm")) {
        throw new Error("The uploaded file is not a valid MP4 or WebM video.");
      }
      if (input.posterPath) {
        const posterHead = await readHead(ctx.supabase, BUCKETS.media, input.posterPath, 16);
        if (!["webp", "jpeg", "png"].includes(sniff(posterHead) ?? "")) throw new Error("Invalid video poster image.");
      }
      const { data, error } = await ctx.supabase
        .from("project_videos")
        .insert({
          project_id: input.projectId,
          kind: videoKind.parse(input.kind),
          source: "upload",
          storage_path: input.storagePath,
          poster_path: input.posterPath,
          mime_type: extension === "webm" ? "video/webm" : "video/mp4",
          size_bytes: size,
          duration_seconds: input.durationSeconds && Number.isFinite(input.durationSeconds) ? Math.round(input.durationSeconds * 100) / 100 : null,
          width: input.width,
          height: input.height,
          sort_order: await nextOrder(ctx, "project_videos", input.projectId),
        })
        .select("*")
        .single();
      if (error || !data) throw new Error(error?.message ?? "Could not save the video.");
      await logActivity(ctx, "upload", "video", data.id, "Uploaded video", { project_id: input.projectId });
      revalidateSite();
      return data as ProjectVideo;
    } catch (e) {
      await removeObjects(ctx.supabase, BUCKETS.media, [input.storagePath, input.posterPath]);
      throw e;
    }
  });
}

export async function addExternalVideo(input: { projectId: string; url: string; kind: string; caption_ka: string; caption_en: string }) {
  return adminAction(async (ctx) => {
    await ensureProject(ctx, input.projectId);
    const url = z.string().trim().url().max(500).parse(input.url);
    if (!isSafeExternalUrl(url)) throw new Error("Use a secure https:// video link.");
    const { data, error } = await ctx.supabase
      .from("project_videos")
      .insert({
        project_id: input.projectId,
        kind: videoKind.parse(input.kind),
        source: "external",
        external_url: url,
        caption_ka: input.caption_ka.slice(0, 300),
        caption_en: input.caption_en.slice(0, 300),
        sort_order: await nextOrder(ctx, "project_videos", input.projectId),
      })
      .select("*")
      .single();
    if (error || !data) throw new Error(error?.message ?? "Could not add the link.");
    await logActivity(ctx, "create", "video", data.id, "Added external video link", { project_id: input.projectId });
    revalidateSite();
    return data as ProjectVideo;
  });
}

export async function updateVideo(id: string, patch: { caption_ka?: string; caption_en?: string; kind?: string; posterPath?: string | null }) {
  return adminAction(async (ctx) => {
    const { data: v } = await ctx.supabase.from("project_videos").select("*").eq("id", uuid.parse(id)).single();
    if (!v) throw new Error("Video not found.");
    const update: Record<string, unknown> = {};
    if (patch.caption_ka !== undefined) update.caption_ka = patch.caption_ka.slice(0, 300);
    if (patch.caption_en !== undefined) update.caption_en = patch.caption_en.slice(0, 300);
    if (patch.kind !== undefined) update.kind = videoKind.parse(patch.kind);
    if (patch.posterPath !== undefined && patch.posterPath) {
      assertProjectPath(patch.posterPath, v.project_id);
      const head = await readHead(ctx.supabase, BUCKETS.media, patch.posterPath, 16);
      if (!["webp", "jpeg", "png"].includes(sniff(head) ?? "")) throw new Error("Invalid poster image.");
      update.poster_path = patch.posterPath;
    }
    const { error } = await ctx.supabase.from("project_videos").update(update).eq("id", id);
    if (error) throw new Error(error.message);
    if (update.poster_path && v.poster_path) await cleanupVideoFiles(ctx, [{ storage_path: null, poster_path: v.poster_path }]);
    revalidateSite();
    return null;
  });
}

export async function deleteVideo(id: string) {
  return adminAction(async (ctx) => {
    const { data: v } = await ctx.supabase.from("project_videos").select("*").eq("id", uuid.parse(id)).single();
    if (!v) throw new Error("Video not found.");
    const { error } = await ctx.supabase.from("project_videos").delete().eq("id", id);
    if (error) throw new Error(error.message);
    await cleanupVideoFiles(ctx, [v]);
    await logActivity(ctx, "delete", "video", id, "Deleted video", { project_id: v.project_id });
    revalidateSite();
    return null;
  });
}

// ---------------------------------------------------------------------------
// 3D models
// ---------------------------------------------------------------------------
export async function registerModel(input: {
  projectId: string;
  originalPath: string;
  originalBucket: "originals" | "media";
  originalName: string;
  displayPath: string | null;
  triangleCount: number | null;
  conversionError: string | null;
  replaceId?: string | null;
}) {
  return adminAction(async (ctx) => {
    await ensureProject(ctx, input.projectId);
    assertProjectPath(input.originalPath, input.projectId);
    if (input.displayPath) assertProjectPath(input.displayPath, input.projectId);
    const format = ext(input.originalName);
    if (!(MODEL_RULES.extensions as readonly string[]).includes(format)) throw new Error("Unsupported 3D format.");
    const bucket = z.enum(["originals", "media"]).parse(input.originalBucket);
    if (bucket === "media" && format !== "glb") throw new Error("Only GLB originals may be stored in the public bucket.");

    const toRemove: [string, string | null][] = [
      [bucket, input.originalPath],
      [BUCKETS.media, input.displayPath && input.displayPath !== input.originalPath ? input.displayPath : null],
    ];
    try {
      const originalSize = await objectSize(ctx.supabase, bucket, input.originalPath);
      if (originalSize > MODEL_RULES.maxBytes) throw new Error("3D file exceeds the size limit.");
      const head = await readHead(ctx.supabase, bucket, input.originalPath, 1024);
      if (!modelContentMatches(format, head)) throw new Error(`The file content does not look like a valid .${format} file.`);

      let displaySize: number | null = null;
      if (input.displayPath) {
        const dHead = await readHead(ctx.supabase, BUCKETS.media, input.displayPath, 16);
        if (sniff(dHead) !== "glb") throw new Error("The browser-ready model is not a valid GLB file.");
        displaySize = await objectSize(ctx.supabase, BUCKETS.media, input.displayPath);
      }

      const status = input.displayPath ? "ready" : "failed";
      const message = input.displayPath
        ? format === "glb"
          ? null
          : `Converted from .${format} to GLB in the browser. The original file is preserved.`
        : `Could not be converted for browser display${input.conversionError ? `: ${input.conversionError.slice(0, 300)}` : "."} The original file is stored and can be downloaded. Export the model as .glb and replace it to show it on the website.`;

      const { count } = await ctx.supabase.from("project_models").select("id", { count: "exact", head: true }).eq("project_id", input.projectId).eq("display_status", "ready");
      const row = {
        project_id: input.projectId,
        original_path: input.originalPath,
        original_bucket: bucket,
        original_name: input.originalName.slice(0, 200),
        original_format: format,
        original_size: originalSize,
        display_path: input.displayPath,
        display_size: displaySize,
        display_status: status,
        status_message: message,
        triangle_count: input.triangleCount,
      };

      let saved: ProjectModel;
      if (input.replaceId) {
        const { data: old } = await ctx.supabase.from("project_models").select("*").eq("id", uuid.parse(input.replaceId)).single();
        if (!old || old.project_id !== input.projectId) throw new Error("Model to replace was not found.");
        const { data, error } = await ctx.supabase.from("project_models").update(row).eq("id", old.id).select("*").single();
        if (error || !data) throw new Error(error?.message ?? "Could not replace the model.");
        await cleanupModelFiles(ctx, [old]);
        saved = data as ProjectModel;
      } else {
        const { data, error } = await ctx.supabase
          .from("project_models")
          .insert({
            ...row,
            is_primary: status === "ready" && !count,
            sort_order: await nextOrder(ctx, "project_models", input.projectId),
          })
          .select("*")
          .single();
        if (error || !data) throw new Error(error?.message ?? "Could not save the model.");
        saved = data as ProjectModel;
      }
      await logActivity(ctx, input.replaceId ? "replace" : "upload", "model", saved.id, `${input.replaceId ? "Replaced" : "Uploaded"} 3D model ${input.originalName}`, {
        project_id: input.projectId,
        status,
      });
      revalidateSite();
      return saved;
    } catch (e) {
      for (const [b, p] of toRemove) await removeObjects(ctx.supabase, b, [p]);
      throw e;
    }
  });
}

export async function updateModel(id: string, patch: { label_ka?: string; label_en?: string; is_primary?: boolean }) {
  return adminAction(async (ctx) => {
    const { data: m } = await ctx.supabase.from("project_models").select("id, project_id, display_status").eq("id", uuid.parse(id)).single();
    if (!m) throw new Error("Model not found.");
    if (patch.is_primary) {
      if (m.display_status !== "ready") throw new Error("Only a browser-ready model can be the primary model.");
      await ctx.supabase.from("project_models").update({ is_primary: false }).eq("project_id", m.project_id);
    }
    const update: Record<string, unknown> = {};
    if (patch.label_ka !== undefined) update.label_ka = patch.label_ka.slice(0, 120);
    if (patch.label_en !== undefined) update.label_en = patch.label_en.slice(0, 120);
    if (patch.is_primary !== undefined) update.is_primary = patch.is_primary;
    const { error } = await ctx.supabase.from("project_models").update(update).eq("id", id);
    if (error) throw new Error(error.message);
    revalidateSite();
    return null;
  });
}

export async function deleteModel(id: string) {
  return adminAction(async (ctx) => {
    const { data: m } = await ctx.supabase.from("project_models").select("*").eq("id", uuid.parse(id)).single();
    if (!m) throw new Error("Model not found.");
    const { error } = await ctx.supabase.from("project_models").delete().eq("id", id);
    if (error) throw new Error(error.message);
    await cleanupModelFiles(ctx, [m]);
    await logActivity(ctx, "delete", "model", id, `Deleted 3D model ${m.original_name}`, { project_id: m.project_id });
    revalidateSite();
    return null;
  });
}

/** Short-lived download link for a private original (photos or 3D source files). */
export async function originalDownloadUrl(bucket: "originals" | "media", path: string) {
  return adminAction(async (ctx) => {
    if (!path.startsWith("projects/")) throw new Error("Invalid path.");
    const { data, error } = await ctx.supabase.storage.from(z.enum(["originals", "media"]).parse(bucket)).createSignedUrl(path, 300, { download: true });
    if (error || !data) throw new Error(error?.message ?? "Could not create a download link.");
    return data.signedUrl;
  });
}
