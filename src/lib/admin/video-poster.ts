"use client";

/** Read duration/size and capture a poster frame from a local video file, in the browser. */
export async function inspectVideo(file: File): Promise<{ poster: Blob | null; duration: number | null; width: number | null; height: number | null }> {
  const url = URL.createObjectURL(file);
  try {
    const video = document.createElement("video");
    video.preload = "metadata";
    video.muted = true;
    video.playsInline = true;
    video.src = url;
    await new Promise<void>((resolve, reject) => {
      video.onloadedmetadata = () => resolve();
      video.onerror = () => reject(new Error("This browser cannot decode the video. It will still be uploaded."));
      setTimeout(() => reject(new Error("Timed out reading the video.")), 20000);
    });
    const duration = Number.isFinite(video.duration) ? video.duration : null;
    const width = video.videoWidth || null;
    const height = video.videoHeight || null;

    // Seek ~1s in (or 10% for short clips) to avoid black first frames.
    const target = duration ? Math.min(1.2, duration * 0.1) : 0.5;
    await new Promise<void>((resolve) => {
      video.onseeked = () => resolve();
      video.currentTime = target;
      setTimeout(resolve, 6000);
    });

    let poster: Blob | null = null;
    if (width && height) {
      const scale = Math.min(1, 1600 / Math.max(width, height));
      const canvas = document.createElement("canvas");
      canvas.width = Math.round(width * scale);
      canvas.height = Math.round(height * scale);
      canvas.getContext("2d")?.drawImage(video, 0, 0, canvas.width, canvas.height);
      poster = await new Promise<Blob | null>((r) => canvas.toBlob(r, "image/webp", 0.85));
    }
    return { poster, duration, width, height };
  } catch {
    return { poster: null, duration: null, width: null, height: null };
  } finally {
    URL.revokeObjectURL(url);
  }
}
