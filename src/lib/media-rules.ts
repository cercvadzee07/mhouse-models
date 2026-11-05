/**
 * Upload rules shared by the browser (fast feedback) and the server
 * (authoritative validation). Adjust limits here; remember Supabase's
 * project-wide upload limit (50 MB on the Free plan, configurable on Pro).
 */
export const MB = 1024 * 1024;

export const IMAGE_RULES = {
  maxBytes: 30 * MB,
  extensions: ["jpg", "jpeg", "png", "webp"],
  mimes: ["image/jpeg", "image/png", "image/webp"],
  accept: ".jpg,.jpeg,.png,.webp,image/jpeg,image/png,image/webp",
};

export const VIDEO_RULES = {
  maxBytes: 500 * MB,
  // MOV/AVI etc. are not reliably playable in all browsers — export to MP4 (H.264) or WebM.
  extensions: ["mp4", "webm"],
  mimes: ["video/mp4", "video/webm"],
  accept: ".mp4,.webm,video/mp4,video/webm",
};

export const MODEL_RULES = {
  maxBytes: 250 * MB,
  extensions: ["glb", "gltf", "obj", "fbx", "stl", "3mf"] as const,
  accept: ".glb,.gltf,.obj,.fbx,.stl,.3mf",
};

export type ModelExt = (typeof MODEL_RULES.extensions)[number];

export function ext(name: string): string {
  const m = /\.([a-z0-9]+)$/i.exec(name);
  return m ? m[1].toLowerCase() : "";
}

export function checkImage(file: { name: string; size: number; type: string }): string | null {
  if (!IMAGE_RULES.extensions.includes(ext(file.name))) return "Unsupported image format. Use JPG, PNG or WebP.";
  if (file.type && !IMAGE_RULES.mimes.includes(file.type)) return "Unsupported image type.";
  if (file.size > IMAGE_RULES.maxBytes) return `Image is larger than ${IMAGE_RULES.maxBytes / MB} MB.`;
  return null;
}

export function checkVideo(file: { name: string; size: number; type: string }): string | null {
  if (!VIDEO_RULES.extensions.includes(ext(file.name))) return "Unsupported video format. Use MP4 or WebM.";
  if (file.size > VIDEO_RULES.maxBytes) return `Video is larger than ${VIDEO_RULES.maxBytes / MB} MB.`;
  return null;
}

export function checkModel(file: { name: string; size: number }): string | null {
  if (!(MODEL_RULES.extensions as readonly string[]).includes(ext(file.name)))
    return "Unsupported 3D format. Use GLB, glTF, OBJ, FBX, STL or 3MF.";
  if (file.size > MODEL_RULES.maxBytes) return `3D file is larger than ${MODEL_RULES.maxBytes / MB} MB.`;
  return null;
}

export function formatBytes(n: number | null | undefined): string {
  if (!n) return "—";
  if (n < 1024) return `${n} B`;
  if (n < MB) return `${(n / 1024).toFixed(0)} KB`;
  return `${(n / MB).toFixed(1)} MB`;
}

/** Magic-byte sniffing (server-side) — the extension alone is never trusted. */
export function sniff(bytes: Uint8Array): string | null {
  const s = (o: number, len: number) => String.fromCharCode(...bytes.slice(o, o + len));
  if (bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) return "jpeg";
  if (s(0, 8) === "\x89PNG\r\n\x1a\n") return "png";
  if (s(0, 4) === "RIFF" && s(8, 4) === "WEBP") return "webp";
  if (s(4, 4) === "ftyp") return "mp4"; // MP4 / MOV (ISO BMFF)
  if (bytes[0] === 0x1a && bytes[1] === 0x45 && bytes[2] === 0xdf && bytes[3] === 0xa3) return "webm";
  if (s(0, 4) === "glTF") return "glb";
  if (s(0, 18) === "Kaydara FBX Binary") return "fbx";
  if (s(0, 2) === "PK") return "zip"; // 3MF is a ZIP container
  return null;
}

/** Validate that sniffed content is consistent with the declared model format. */
export function modelContentMatches(format: string, head: Uint8Array): boolean {
  const kind = sniff(head);
  const text = new TextDecoder("utf-8", { fatal: false }).decode(head.slice(0, 512)).trimStart();
  switch (format) {
    case "glb":
      return kind === "glb";
    case "3mf":
      return kind === "zip";
    case "gltf":
      return text.startsWith("{");
    case "fbx":
      return kind === "fbx" || /FBX|; FBX|FBXHeaderExtension/.test(text);
    case "stl":
      // ASCII STL starts with "solid"; binary STL has an 80-byte header + triangle count.
      return text.startsWith("solid") || head.length >= 84;
    case "obj":
      // OBJ is plain text: reject binary content.
      return !head.slice(0, 256).some((b) => b === 0);
    default:
      return false;
  }
}
