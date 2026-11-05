"use client";

import { getBrowserClient } from "@/lib/supabase/browser";

export class UploadCancelled extends Error {
  constructor() {
    super("Upload cancelled");
  }
}

/**
 * Upload a file straight from the browser to Supabase Storage with progress
 * reporting and cancellation. The request is authorized with the admin's own
 * session; Storage RLS policies only allow CMS users to write.
 */
export async function uploadToStorage({
  bucket,
  path,
  file,
  contentType,
  onProgress,
  signal,
}: {
  bucket: "media" | "originals";
  path: string;
  file: Blob;
  contentType?: string;
  onProgress?: (fraction: number) => void;
  signal?: AbortSignal;
}): Promise<void> {
  const sb = getBrowserClient();
  const {
    data: { session },
  } = await sb.auth.getSession();
  if (!session) throw new Error("Your session has expired. Please sign in again.");

  const url = `${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/${bucket}/${path
    .split("/")
    .map(encodeURIComponent)
    .join("/")}`;

  await new Promise<void>((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open("POST", url);
    xhr.setRequestHeader("Authorization", `Bearer ${session.access_token}`);
    xhr.setRequestHeader("apikey", process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!);
    xhr.setRequestHeader("x-upsert", "false");
    xhr.setRequestHeader("cache-control", "max-age=31536000");
    xhr.setRequestHeader("Content-Type", contentType || file.type || "application/octet-stream");
    xhr.upload.onprogress = (e) => {
      if (e.lengthComputable) onProgress?.(e.loaded / e.total);
    };
    xhr.onload = () => {
      if (xhr.status >= 200 && xhr.status < 300) {
        onProgress?.(1);
        resolve();
      } else {
        let message = `Upload failed (${xhr.status})`;
        try {
          const body = JSON.parse(xhr.responseText);
          message = body.message || body.error || message;
          if (/exceeded the maximum allowed size|Payload too large/i.test(message) || xhr.status === 413) {
            message = "The file is larger than your Supabase project's upload limit (Storage → Settings).";
          }
        } catch {
          /* ignore */
        }
        reject(new Error(message));
      }
    };
    xhr.onerror = () => reject(new Error("Network error during upload."));
    xhr.onabort = () => reject(new UploadCancelled());
    signal?.addEventListener("abort", () => xhr.abort(), { once: true });
    xhr.send(file);
  });
}

export function newId() {
  return crypto.randomUUID();
}
