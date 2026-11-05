import "server-only";
import type { AdminContext } from "@/lib/auth";
import type { Project } from "@/lib/types";
import { BUCKETS } from "@/lib/storage";
import { removeObjects } from "@/lib/server-storage";

/**
 * Delete storage objects only when no database row still references them
 * (duplicated projects share files). Call AFTER the referencing rows are deleted/updated.
 */
export async function removeUnreferenced(
  ctx: AdminContext,
  bucket: string,
  column: string,
  table: string,
  paths: (string | null | undefined)[],
) {
  const unique = [...new Set(paths.filter((p): p is string => !!p))];
  const free: string[] = [];
  for (const path of unique) {
    const { count, error } = await ctx.supabase.from(table).select("id", { count: "exact", head: true }).eq(column, path);
    if (!error && !count) free.push(path);
  }
  await removeObjects(ctx.supabase, bucket, free);
}

export async function cleanupImageFiles(ctx: AdminContext, images: Pick<Project["images"][number], "original_path" | "optimized_path" | "thumb_path">[]) {
  await removeUnreferenced(ctx, BUCKETS.originals, "original_path", "project_images", images.map((i) => i.original_path));
  await removeUnreferenced(ctx, BUCKETS.media, "optimized_path", "project_images", images.map((i) => i.optimized_path));
  await removeUnreferenced(ctx, BUCKETS.media, "thumb_path", "project_images", images.map((i) => i.thumb_path));
}

export async function cleanupVideoFiles(ctx: AdminContext, videos: Pick<Project["videos"][number], "storage_path" | "poster_path">[]) {
  await removeUnreferenced(ctx, BUCKETS.media, "storage_path", "project_videos", videos.map((v) => v.storage_path));
  await removeUnreferenced(ctx, BUCKETS.media, "poster_path", "project_videos", videos.map((v) => v.poster_path));
}

export async function cleanupModelFiles(
  ctx: AdminContext,
  models: Pick<Project["models"][number], "display_path" | "original_path" | "original_bucket">[],
) {
  await removeUnreferenced(ctx, BUCKETS.media, "display_path", "project_models", models.map((m) => m.display_path));
  await removeUnreferenced(ctx, BUCKETS.media, "original_path", "project_models", models.filter((m) => m.original_bucket === "media").map((m) => m.original_path));
  await removeUnreferenced(ctx, BUCKETS.originals, "original_path", "project_models", models.filter((m) => m.original_bucket === "originals").map((m) => m.original_path));
}

export async function cleanupProjectFiles(ctx: AdminContext, p: Pick<Project, "images" | "videos" | "models">) {
  await cleanupImageFiles(ctx, p.images);
  await cleanupVideoFiles(ctx, p.videos);
  await cleanupModelFiles(ctx, p.models);
}
