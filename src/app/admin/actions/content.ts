"use server";

import { randomUUID } from "node:crypto";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { adminAction, logActivity } from "@/lib/auth";
import { BUCKETS } from "@/lib/storage";
import { download, objectSize, removeObjects, upload } from "@/lib/server-storage";
import { processSiteImage } from "@/lib/image-processing";
import { IMAGE_RULES } from "@/lib/media-rules";
import { SLUG_RE, slugify } from "@/lib/slug";
import { cleanupProjectFiles } from "@/lib/admin/cleanup";
import { PROJECT_SELECT } from "@/lib/data/project-helpers";
import type { Project } from "@/lib/types";

const revalidateSite = () => revalidatePath("/", "layout");
const s = (max: number) => z.string().trim().max(max);
const nullableUrl = z
  .string()
  .trim()
  .max(500)
  .transform((v) => (v === "" ? null : v))
  .refine((v) => v === null || /^https:\/\//.test(v), "Links must start with https://")
  .nullable();
const sitePath = z
  .string()
  .regex(/^site\/[a-z-]+\/[0-9a-f-]{36}\.(webp|jpg)$/)
  .nullable();

// ---------------------------------------------------------------------------
// Site images (service images, studio photo, hero image, Open Graph images)
// ---------------------------------------------------------------------------
/** The browser uploads an original to `originals/site/tmp/...`; we optimize it into the public bucket. */
export async function processUploadedSiteImage(input: { tmpPath: string; purpose: "service" | "studio" | "hero" | "og" }) {
  return adminAction(async (ctx) => {
    if (!/^site\/tmp\/[0-9a-f-]{36}\.(jpg|jpeg|png|webp)$/.test(input.tmpPath)) throw new Error("Invalid upload path.");
    const purpose = z.enum(["service", "studio", "hero", "og"]).parse(input.purpose);
    try {
      const size = await objectSize(ctx.supabase, BUCKETS.originals, input.tmpPath);
      if (size > IMAGE_RULES.maxBytes) throw new Error("Image exceeds the size limit.");
      const original = await download(ctx.supabase, BUCKETS.originals, input.tmpPath);
      const out = await processSiteImage(original, purpose === "hero" ? 2600 : 2000, purpose === "og");
      const path = `site/${purpose}/${randomUUID()}.${out.ext}`;
      await upload(ctx.supabase, BUCKETS.media, path, out.buffer, out.contentType);
      return { path };
    } finally {
      await removeObjects(ctx.supabase, BUCKETS.originals, [input.tmpPath]);
    }
  });
}

async function replaceSiteImage(oldPath: string | null | undefined, newPath: string | null | undefined, sb: Parameters<typeof removeObjects>[0]) {
  if (oldPath && oldPath !== newPath && oldPath.startsWith("site/")) await removeObjects(sb, BUCKETS.media, [oldPath]);
}

// ---------------------------------------------------------------------------
// Homepage
// ---------------------------------------------------------------------------
const homepageSchema = z.object({
  eyebrow_ka: s(160),
  eyebrow_en: s(160),
  headline_ka: s(200).min(1, "Georgian headline is required."),
  headline_en: s(200).min(1, "English headline is required."),
  subheadline_ka: s(500),
  subheadline_en: s(500),
  cta_primary_ka: s(60),
  cta_primary_en: s(60),
  cta_secondary_ka: s(60),
  cta_secondary_en: s(60),
  hero_mode: z.enum(["procedural", "model", "image"]),
  hero_model_id: z.string().uuid().nullable(),
  hero_image_path: sitePath,
  hero_auto_rotate: z.boolean(),
  hero_evening_lights: z.boolean(),
  why_title_ka: s(200),
  why_title_en: s(200),
});

export async function saveHomepage(input: z.input<typeof homepageSchema>, featuredIds: string[]) {
  return adminAction(async (ctx) => {
    const d = homepageSchema.parse(input);
    if (d.hero_mode === "model" && !d.hero_model_id) throw new Error("Choose a 3D model for the hero, or select another hero mode.");
    if (d.hero_mode === "image" && !d.hero_image_path) throw new Error("Upload a hero image, or select another hero mode.");
    const { data: old } = await ctx.supabase.from("homepage_content").select("hero_image_path").eq("id", 1).maybeSingle();
    const { error } = await ctx.supabase.from("homepage_content").upsert({ id: 1, ...d });
    if (error) throw new Error(error.message);
    await replaceSiteImage(old?.hero_image_path, d.hero_image_path, ctx.supabase);

    // Featured projects on the homepage
    const ids = z.array(z.string().uuid()).max(50).parse(featuredIds);
    await ctx.supabase.from("projects").update({ is_featured: false }).eq("is_featured", true).not("id", "in", `(${ids.length ? ids.join(",") : "00000000-0000-0000-0000-000000000000"})`);
    if (ids.length) await ctx.supabase.from("projects").update({ is_featured: true }).in("id", ids);

    await logActivity(ctx, "update", "homepage", "1", "Updated homepage content");
    revalidateSite();
    return null;
  });
}

// ---------------------------------------------------------------------------
// Studio information
// ---------------------------------------------------------------------------
const principle = z.object({ title_ka: s(120), title_en: s(120), body_ka: s(600), body_en: s(600) });
const studioSchema = z.object({
  about_title_ka: s(240),
  about_title_en: s(240),
  about_body_ka: s(6000),
  about_body_en: s(6000),
  description_ka: s(400),
  description_en: s(400),
  principles: z.array(principle).max(8),
  studio_image_path: sitePath,
});

export async function saveStudio(input: z.input<typeof studioSchema>) {
  return adminAction(async (ctx) => {
    const d = studioSchema.parse(input);
    const { data: old } = await ctx.supabase.from("studio_info").select("studio_image_path").eq("id", 1).maybeSingle();
    const { error } = await ctx.supabase.from("studio_info").upsert({ id: 1, ...d });
    if (error) throw new Error(error.message);
    await replaceSiteImage(old?.studio_image_path, d.studio_image_path, ctx.supabase);
    await logActivity(ctx, "update", "studio", "1", "Updated studio information");
    revalidateSite();
    return null;
  });
}

// ---------------------------------------------------------------------------
// Contact
// ---------------------------------------------------------------------------
const optional = (max: number) =>
  z
    .string()
    .trim()
    .max(max)
    .transform((v) => (v === "" ? null : v))
    .nullable();
const contactSchema = z.object({
  email: optional(254).refine((v) => v === null || /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v), "Invalid email address."),
  phone: optional(40),
  whatsapp: optional(30).refine((v) => v === null || /^\+?[\d\s()-]{8,}$/.test(v), "WhatsApp: use the international format, e.g. +995 555 12 34 56."),
  instagram_url: nullableUrl,
  tiktok_url: nullableUrl,
  facebook_url: nullableUrl,
  linkedin_url: nullableUrl,
  address_ka: optional(300),
  address_en: optional(300),
  show_address: z.boolean(),
  notify_email: optional(254).refine((v) => v === null || /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v), "Invalid notification email."),
});

export async function saveContact(input: z.input<typeof contactSchema>) {
  return adminAction(async (ctx) => {
    const d = contactSchema.parse(input);
    const { error } = await ctx.supabase.from("contact_settings").upsert({ id: 1, ...d });
    if (error) throw new Error(error.message);
    await logActivity(ctx, "update", "contact", "1", "Updated contact information");
    revalidateSite();
    return null;
  });
}

// ---------------------------------------------------------------------------
// SEO
// ---------------------------------------------------------------------------
const seoRow = z.object({
  page_key: z.enum(["default", "home", "projects"]),
  title_ka: s(200),
  title_en: s(200),
  description_ka: s(400),
  description_en: s(400),
  og_image_path: sitePath,
});

export async function saveSeo(rows: z.input<typeof seoRow>[]) {
  return adminAction(async (ctx) => {
    const parsed = z.array(seoRow).max(3).parse(rows);
    const { data: old } = await ctx.supabase.from("seo_settings").select("page_key, og_image_path");
    const { error } = await ctx.supabase.from("seo_settings").upsert(parsed, { onConflict: "page_key" });
    if (error) throw new Error(error.message);
    for (const o of old ?? []) {
      const n = parsed.find((p) => p.page_key === o.page_key);
      if (n) await replaceSiteImage(o.og_image_path, n.og_image_path, ctx.supabase);
    }
    await logActivity(ctx, "update", "seo", null, "Updated SEO settings");
    revalidateSite();
    return null;
  });
}

// ---------------------------------------------------------------------------
// General settings
// ---------------------------------------------------------------------------
const generalSchema = z.object({
  studio_name: s(80).min(1, "Studio name is required."),
  studio_name_short: s(40).min(1, "Short name is required."),
  wordmark_suffix: s(40),
  show_demo_badges: z.boolean(),
});

export async function saveGeneral(input: z.input<typeof generalSchema>) {
  return adminAction(async (ctx) => {
    const d = generalSchema.parse(input);
    const { error } = await ctx.supabase.from("general_settings").upsert({ id: 1, ...d });
    if (error) throw new Error(error.message);
    await logActivity(ctx, "update", "settings", "1", "Updated general settings");
    revalidateSite();
    return null;
  });
}

/** Removes every project flagged as a demonstration (and its files). */
export async function removeDemoContent() {
  return adminAction(async (ctx) => {
    const { data, error } = await ctx.supabase.from("projects").select(PROJECT_SELECT).eq("is_demo", true);
    if (error) throw new Error(error.message);
    const list = (data ?? []) as Project[];
    if (list.length) {
      const { error: dErr } = await ctx.supabase.from("projects").delete().eq("is_demo", true);
      if (dErr) throw new Error(dErr.message);
      for (const p of list) await cleanupProjectFiles(ctx, p);
    }
    // Demo service images point to Unsplash; clear them so real images can be uploaded.
    await ctx.supabase.from("services").update({ image_external_url: null }).not("image_external_url", "is", null);
    await logActivity(ctx, "delete", "project", null, `Removed ${list.length} demonstration projects`);
    revalidateSite();
    return { removed: list.length };
  });
}

// ---------------------------------------------------------------------------
// Services
// ---------------------------------------------------------------------------
const serviceSchema = z.object({
  title_ka: s(160).min(1, "Georgian title is required."),
  title_en: s(160).min(1, "English title is required."),
  description_ka: s(1200),
  description_en: s(1200),
  image_path: sitePath,
  is_visible: z.boolean(),
});

export async function saveService(id: string | null, input: z.input<typeof serviceSchema>) {
  return adminAction(async (ctx) => {
    const d = serviceSchema.parse(input);
    if (id) {
      const { data: old } = await ctx.supabase.from("services").select("image_path").eq("id", z.string().uuid().parse(id)).single();
      const update: Record<string, unknown> = { ...d };
      if (d.image_path) update.image_external_url = null;
      const { error } = await ctx.supabase.from("services").update(update).eq("id", id);
      if (error) throw new Error(error.message);
      await replaceSiteImage(old?.image_path, d.image_path, ctx.supabase);
      await logActivity(ctx, "update", "service", id, `Updated service “${d.title_en}”`);
      revalidateSite();
      return { id };
    }
    let slug = slugify(d.title_en) || "service";
    const { data: clash } = await ctx.supabase.from("services").select("id").eq("slug", slug).maybeSingle();
    if (clash) slug = `${slug}-${Date.now().toString(36)}`;
    const { data: max } = await ctx.supabase.from("services").select("sort_order").order("sort_order", { ascending: false }).limit(1).maybeSingle();
    const { data, error } = await ctx.supabase
      .from("services")
      .insert({ ...d, slug, sort_order: (max?.sort_order ?? 0) + 1 })
      .select("id")
      .single();
    if (error || !data) throw new Error(error?.message ?? "Could not create the service.");
    await logActivity(ctx, "create", "service", data.id, `Created service “${d.title_en}”`);
    revalidateSite();
    return { id: data.id as string };
  });
}

export async function deleteService(id: string) {
  return adminAction(async (ctx) => {
    const { data: old } = await ctx.supabase.from("services").select("image_path, title_en").eq("id", z.string().uuid().parse(id)).single();
    const { error } = await ctx.supabase.from("services").delete().eq("id", id);
    if (error) throw new Error(error.message);
    await replaceSiteImage(old?.image_path, null, ctx.supabase);
    await logActivity(ctx, "delete", "service", id, `Deleted service “${old?.title_en ?? ""}”`);
    revalidateSite();
    return null;
  });
}

export async function reorderServices(ids: string[]) {
  return adminAction(async (ctx) => {
    const { error } = await ctx.supabase.rpc("reorder_rows", { p_table: "services", p_ids: z.array(z.string().uuid()).parse(ids) });
    if (error) throw new Error(error.message);
    revalidateSite();
    return null;
  });
}

// ---------------------------------------------------------------------------
// Categories
// ---------------------------------------------------------------------------
const categorySchema = z.object({
  name_ka: s(80).min(1, "Georgian name is required."),
  name_en: s(80).min(1, "English name is required."),
  slug: s(80).regex(SLUG_RE, "Slug: lowercase Latin letters, digits and hyphens.").optional(),
});

export async function saveCategory(id: string | null, input: z.input<typeof categorySchema>) {
  return adminAction(async (ctx) => {
    const d = categorySchema.parse(input);
    const slug = d.slug || slugify(d.name_en) || `category-${Date.now().toString(36)}`;
    if (id) {
      const { error } = await ctx.supabase.from("project_categories").update({ name_ka: d.name_ka, name_en: d.name_en, slug }).eq("id", id);
      if (error) throw new Error(error.message.includes("duplicate") ? "This slug is already used." : error.message);
    } else {
      const { data: max } = await ctx.supabase.from("project_categories").select("sort_order").order("sort_order", { ascending: false }).limit(1).maybeSingle();
      const { error } = await ctx.supabase.from("project_categories").insert({ name_ka: d.name_ka, name_en: d.name_en, slug, sort_order: (max?.sort_order ?? 0) + 1 });
      if (error) throw new Error(error.message.includes("duplicate") ? "This slug is already used." : error.message);
    }
    await logActivity(ctx, id ? "update" : "create", "category", id, `${id ? "Updated" : "Created"} category “${d.name_en}”`);
    revalidateSite();
    return null;
  });
}

export async function deleteCategory(id: string) {
  return adminAction(async (ctx) => {
    const { error } = await ctx.supabase.from("project_categories").delete().eq("id", z.string().uuid().parse(id));
    if (error) throw new Error(error.message);
    await logActivity(ctx, "delete", "category", id, "Deleted category (projects keep existing, uncategorized)");
    revalidateSite();
    return null;
  });
}

export async function reorderCategories(ids: string[]) {
  return adminAction(async (ctx) => {
    const { error } = await ctx.supabase.rpc("reorder_rows", { p_table: "project_categories", p_ids: z.array(z.string().uuid()).parse(ids) });
    if (error) throw new Error(error.message);
    revalidateSite();
    return null;
  });
}

// ---------------------------------------------------------------------------
// Inquiries
// ---------------------------------------------------------------------------
export async function setInquiryStatus(id: string, status: "new" | "read" | "archived") {
  return adminAction(async (ctx) => {
    const { error } = await ctx.supabase
      .from("inquiries")
      .update({ status: z.enum(["new", "read", "archived"]).parse(status) })
      .eq("id", z.string().uuid().parse(id));
    if (error) throw new Error(error.message);
    return null;
  });
}

export async function deleteInquiry(id: string) {
  return adminAction(async (ctx) => {
    const { data } = await ctx.supabase.from("inquiries").select("attachment_path, full_name").eq("id", z.string().uuid().parse(id)).single();
    const { error } = await ctx.supabase.from("inquiries").delete().eq("id", id);
    if (error) throw new Error(error.message);
    if (data?.attachment_path) await removeObjects(ctx.supabase, BUCKETS.inquiries, [data.attachment_path]);
    await logActivity(ctx, "delete", "inquiry", id, `Deleted inquiry from ${data?.full_name ?? "—"}`);
    return null;
  });
}

export async function inquiryAttachmentUrl(id: string) {
  return adminAction(async (ctx) => {
    const { data } = await ctx.supabase.from("inquiries").select("attachment_path, attachment_name").eq("id", z.string().uuid().parse(id)).single();
    if (!data?.attachment_path) throw new Error("No attachment.");
    const { data: signed, error } = await ctx.supabase.storage
      .from(BUCKETS.inquiries)
      .createSignedUrl(data.attachment_path, 300, { download: data.attachment_name || true });
    if (error || !signed) throw new Error(error?.message ?? "Could not create a download link.");
    return signed.signedUrl;
  });
}
