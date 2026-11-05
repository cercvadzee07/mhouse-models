import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";

/** Read the first bytes of an object without downloading it (signed URL + HTTP Range). */
export async function readHead(sb: SupabaseClient, bucket: string, path: string, bytes = 1024): Promise<Uint8Array> {
  const { data, error } = await sb.storage.from(bucket).createSignedUrl(path, 60);
  if (error || !data) throw new Error(`File not found in storage (${bucket}/${path})`);
  const res = await fetch(data.signedUrl, { headers: { Range: `bytes=0-${bytes - 1}` }, cache: "no-store" });
  if (!res.ok && res.status !== 206) throw new Error(`Could not read uploaded file (${res.status})`);
  return new Uint8Array(await res.arrayBuffer()).slice(0, bytes);
}

export async function objectSize(sb: SupabaseClient, bucket: string, path: string): Promise<number> {
  const { data, error } = await sb.storage.from(bucket).info(path);
  if (error || !data) throw new Error(`File not found in storage (${bucket}/${path})`);
  return Number(data.size ?? 0);
}

export async function download(sb: SupabaseClient, bucket: string, path: string): Promise<Buffer> {
  const { data, error } = await sb.storage.from(bucket).download(path);
  if (error || !data) throw new Error(`Could not download ${bucket}/${path}: ${error?.message ?? "unknown"}`);
  return Buffer.from(await data.arrayBuffer());
}

export async function upload(sb: SupabaseClient, bucket: string, path: string, body: Buffer, contentType: string) {
  const { error } = await sb.storage.from(bucket).upload(path, body, {
    contentType,
    upsert: false,
    cacheControl: "31536000",
  });
  if (error) throw new Error(`Upload failed (${bucket}/${path}): ${error.message}`);
}

/** Remove objects, ignoring empty paths. Errors are logged, not thrown (DB is the source of truth). */
export async function removeObjects(sb: SupabaseClient, bucket: string, paths: (string | null | undefined)[]) {
  const list = [...new Set(paths.filter((p): p is string => !!p && !/^https?:/.test(p)))];
  if (!list.length) return;
  const { error } = await sb.storage.from(bucket).remove(list);
  if (error) console.error(`[storage] remove from ${bucket}:`, error.message);
}

/** Paths must live inside the project's own folder — prevents referencing someone else's objects. */
export function assertProjectPath(path: string, projectId: string) {
  if (!path.startsWith(`projects/${projectId}/`) || path.includes("..")) {
    throw new Error("Invalid storage path");
  }
}
