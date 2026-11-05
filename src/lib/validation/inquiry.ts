import { z } from "zod";

export const INQUIRY_MAX_FILE = 25 * 1024 * 1024;
export const INQUIRY_FILE_TYPES: Record<string, string[]> = {
  pdf: ["application/pdf"],
  jpg: ["image/jpeg"],
  jpeg: ["image/jpeg"],
  png: ["image/png"],
  webp: ["image/webp"],
  docx: ["application/vnd.openxmlformats-officedocument.wordprocessingml.document"],
  doc: ["application/msword"],
  zip: ["application/zip", "application/x-zip-compressed"],
};

export const PROJECT_TYPES = ["residential", "commercial", "urban", "conceptual", "interior", "other"] as const;

/** Error codes map to localized messages in the dictionary (contact.validation.*). */
export const inquirySchema = z.object({
  fullName: z.string().trim().min(2, "nameShort").max(120, "nameShort"),
  company: z.string().trim().max(160).optional().or(z.literal("")),
  email: z.string().trim().max(254, "email").regex(/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/, "email"),
  phone: z
    .string()
    .trim()
    .max(40, "phone")
    .regex(/^[+()\d\s.-]{6,}$/, "phone")
    .optional()
    .or(z.literal("")),
  projectType: z.enum(PROJECT_TYPES).optional().or(z.literal("")),
  message: z.string().trim().min(10, "messageShort").max(5000, "messageLong"),
  locale: z.enum(["ka", "en"]),
  attachmentPath: z.string().max(300).optional().or(z.literal("")),
  attachmentName: z.string().max(200).optional().or(z.literal("")),
});

export type InquiryInput = z.infer<typeof inquirySchema>;

export function fileExtension(name: string): string {
  const m = /\.([a-z0-9]+)$/i.exec(name);
  return m ? m[1].toLowerCase() : "";
}

export function validateAttachment(name: string, size: number, type: string): "fileSize" | "fileType" | null {
  if (size > INQUIRY_MAX_FILE) return "fileSize";
  const ext = fileExtension(name);
  const allowed = INQUIRY_FILE_TYPES[ext];
  if (!allowed) return "fileType";
  // Some browsers report an empty MIME type; the extension check still applies.
  if (type && !allowed.includes(type) && type !== "application/octet-stream") return "fileType";
  return null;
}
