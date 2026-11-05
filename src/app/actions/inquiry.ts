"use server";

import { createHash, randomUUID } from "node:crypto";
import { headers } from "next/headers";
import { getServiceClient } from "@/lib/supabase/service";
import { sendEmail } from "@/lib/email";
import { BUCKETS } from "@/lib/storage";
import { fileExtension, inquirySchema, validateAttachment } from "@/lib/validation/inquiry";

export type InquiryResult =
  | { status: "ok"; emailed: boolean }
  | { status: "invalid"; fields: Record<string, string> }
  | { status: "not_configured" }
  | { status: "rate_limited" }
  | { status: "error" };

async function clientIpHash(): Promise<string> {
  const h = await headers();
  const ip = h.get("x-forwarded-for")?.split(",")[0]?.trim() || h.get("x-real-ip") || "unknown";
  const salt = process.env.SUPABASE_SERVICE_ROLE_KEY?.slice(-16) ?? "mhouse";
  return createHash("sha256").update(`${salt}:${ip}`).digest("hex").slice(0, 32);
}

const WINDOW_MINUTES = 15;
const MAX_PER_WINDOW = 4;

async function isRateLimited(ipHash: string) {
  const sb = getServiceClient();
  if (!sb) return false;
  const since = new Date(Date.now() - WINDOW_MINUTES * 60_000).toISOString();
  const { count } = await sb
    .from("inquiries")
    .select("id", { count: "exact", head: true })
    .eq("ip_hash", ipHash)
    .gte("created_at", since);
  return (count ?? 0) >= MAX_PER_WINDOW;
}

/**
 * Step 1 (optional): request a one-time signed upload URL for an attachment.
 * The file goes straight from the browser to the private `inquiries` bucket,
 * so large files never pass through the serverless function.
 */
export async function createInquiryUpload(input: { name: string; size: number; type: string }) {
  const sb = getServiceClient();
  if (!sb) return { status: "not_configured" as const };
  const problem = validateAttachment(input.name, input.size, input.type);
  if (problem) return { status: "invalid" as const, code: problem };
  const ipHash = await clientIpHash();
  if (await isRateLimited(ipHash)) return { status: "rate_limited" as const };

  const path = `pending/${new Date().toISOString().slice(0, 10)}/${randomUUID()}.${fileExtension(input.name)}`;
  const { data, error } = await sb.storage.from(BUCKETS.inquiries).createSignedUploadUrl(path);
  if (error || !data) {
    console.error("[inquiry] signed upload url:", error?.message);
    return { status: "error" as const };
  }
  return { status: "ok" as const, path: data.path, token: data.token };
}

/** Step 2: validate and store the inquiry. */
export async function submitInquiry(raw: Record<string, string>): Promise<InquiryResult> {
  // Honeypot: real users never fill the hidden "website" field.
  if (raw.website) return { status: "ok", emailed: false };
  // Submissions faster than 2 seconds after render are bots.
  const startedAt = Number(raw.startedAt);
  if (Number.isFinite(startedAt) && Date.now() - startedAt < 2000) return { status: "error" };

  const parsed = inquirySchema.safeParse(raw);
  if (!parsed.success) {
    const fields: Record<string, string> = {};
    for (const issue of parsed.error.issues) {
      const key = String(issue.path[0] ?? "form");
      if (!fields[key]) fields[key] = issue.message;
    }
    return { status: "invalid", fields };
  }

  const sb = getServiceClient();
  if (!sb) return { status: "not_configured" };

  const ipHash = await clientIpHash();
  if (await isRateLimited(ipHash)) return { status: "rate_limited" };

  const data = parsed.data;
  let attachmentPath: string | null = null;
  if (data.attachmentPath) {
    // Only accept paths minted by createInquiryUpload, and verify the object exists.
    if (!/^pending\/\d{4}-\d{2}-\d{2}\/[0-9a-f-]{36}\.[a-z0-9]{2,5}$/.test(data.attachmentPath)) {
      return { status: "invalid", fields: { attachment: "fileType" } };
    }
    const folder = data.attachmentPath.split("/").slice(0, 2).join("/");
    const file = data.attachmentPath.split("/").pop()!;
    const { data: listed } = await sb.storage.from(BUCKETS.inquiries).list(folder, { search: file, limit: 1 });
    if (!listed?.length) return { status: "invalid", fields: { attachment: "fileType" } };
    attachmentPath = data.attachmentPath;
  }

  const { data: row, error } = await sb
    .from("inquiries")
    .insert({
      full_name: data.fullName,
      company: data.company || null,
      email: data.email,
      phone: data.phone || null,
      project_type: data.projectType || null,
      message: data.message,
      attachment_path: attachmentPath,
      attachment_name: attachmentPath ? (data.attachmentName || "attachment").slice(0, 200) : null,
      locale: data.locale,
      ip_hash: ipHash,
    })
    .select("id")
    .single();

  if (error || !row) {
    console.error("[inquiry] insert:", error?.message);
    return { status: "error" };
  }

  // Optional email notification.
  const { data: settings } = await sb.from("contact_settings").select("notify_email, email").eq("id", 1).maybeSingle();
  const to = settings?.notify_email || settings?.email;
  let emailed = false;
  if (to) {
    const result = await sendEmail({
      to,
      replyTo: data.email,
      subject: `New project inquiry — ${data.fullName}${data.company ? ` (${data.company})` : ""}`,
      text: [
        `Name: ${data.fullName}`,
        `Company: ${data.company || "—"}`,
        `Email: ${data.email}`,
        `Phone: ${data.phone || "—"}`,
        `Project type: ${data.projectType || "—"}`,
        `Language: ${data.locale}`,
        `Attachment: ${attachmentPath ? "yes (see Admin → Inquiries)" : "no"}`,
        "",
        data.message,
      ].join("\n"),
    });
    emailed = result.sent;
    if (!result.sent && result.error !== "not_configured") console.error("[inquiry] email:", result.error);
  }

  return { status: "ok", emailed };
}
