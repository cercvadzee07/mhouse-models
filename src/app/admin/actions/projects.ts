"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { adminAction, logActivity, type AdminContext } from "@/lib/auth";
import { SLUG_RE, slugify } from "@/lib/slug";
import { cleanupProjectFiles } from "@/lib/admin/cleanup";
import type { Project } from "@/lib/types";
import { PROJECT_SELECT } from "@/lib/data/project-helpers";

function revalidateSite() {
  // Public pages are statically cached; purge the whole site layout so
  // the homepage, portfolio, project pages and sitemap update immediately.
  revalidatePath("/", "layout");
}

const optText = (max: number) =>
  z
    .string()
    .trim()
    .max(max)
    .transform((v) => (v === "" ? null : v))
    .nullable()
    .optional();

const translationSchema = z.object({
  title: z.string().trim().max(200),
  short_description: z.string().trim().max(600),
  description: z.string().trim().max(20000),
  seo_title: optText(200),
  seo_description: optText(400),
});

const projectSchema = z.object({
  slug: z.string().trim().toLowerCase().max(120).regex(SLUG_RE, "The URL slug may contain only lowercase Latin letters, digits and hyphens."),
  category_id: z.string().uuid().nullable(),
  is_featured: z.boolean(),
  location_ka: optText(200),
  location_en: optText(200),
  project_date: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/)
    .nullable()
    .optional()
    .or(z.literal("").transform(() => null)),
  scale: optText(40),
  materials_ka: optText(400),
  materials_en: optText(400),
  dimensions: optText(120),
  ka: translationSchema,
  en: translationSchema,
});

export type ProjectInput = z.input<typeof projectSchema>;

async function uniqueSlug(ctx: AdminContext, base: string, excludeId?: string): Promise<string> {
  const root = base || "project";
  for (let i = 0; i < 50; i++) {
    const candidate = i === 0 ? root : `${root}-${i + 1}`;
    let q = ctx.supabase.from("projects").select("id").eq("slug", candidate);
    if (excludeId) q = q.neq("id", excludeId);
    const { data } = await q.maybeSingle();
    if (!data) return candidate;
  }
  return `${root}-${Date.now().toString(36)}`;
}

export async function createProject(input: { title_ka: string; title_en: string; category_id: string | null }) {
  return adminAction(async (ctx) => {
    const titleKa = input.title_ka.trim().slice(0, 200);
    const titleEn = input.title_en.trim().slice(0, 200);
    if (!titleKa && !titleEn) throw new Error("Enter a project title in Georgian or English.");
    const slug = await uniqueSlug(ctx, slugify(titleEn || titleKa));

    const { data: max } = await ctx.supabase.from("projects").select("sort_order").order("sort_order", { ascending: false }).limit(1).maybeSingle();
    const { data: project, error } = await ctx.supabase
      .from("projects")
      .insert({
        slug,
        category_id: input.category_id || null,
        status: "draft",
        sort_order: (max?.sort_order ?? 0) + 1,
        created_by: ctx.user.id,
      })
      .select("id")
      .single();
    if (error || !project) throw new Error(error?.message ?? "Could not create the project.");

    const { error: tErr } = await ctx.supabase.from("project_translations").insert([
      { project_id: project.id, locale: "ka", title: titleKa },
      { project_id: project.id, locale: "en", title: titleEn },
    ]);
    if (tErr) throw new Error(tErr.message);

    await logActivity(ctx, "create", "project", project.id, `Created project “${titleEn || titleKa}”`);
    return { id: project.id as string };
  });
}

export async function saveProject(id: string, input: ProjectInput, publish?: "publish" | "unpublish") {
  return adminAction(async (ctx) => {
    const parsed = projectSchema.safeParse(input);
    if (!parsed.success) throw new Error(parsed.error.issues[0]?.message ?? "Invalid project data.");
    const d = parsed.data;

    if (publish === "publish") {
      if (!d.ka.title && !d.en.title) throw new Error("A project needs a title before it can be published.");
    }

    const { data: clash } = await ctx.supabase.from("projects").select("id").eq("slug", d.slug).neq("id", id).maybeSingle();
    if (clash) throw new Error("Another project already uses this URL slug.");

    const update: Record<string, unknown> = {
      slug: d.slug,
      category_id: d.category_id,
      is_featured: d.is_featured,
      location_ka: d.location_ka ?? null,
      location_en: d.location_en ?? null,
      project_date: d.project_date ?? null,
      scale: d.scale ?? null,
      materials_ka: d.materials_ka ?? null,
      materials_en: d.materials_en ?? null,
      dimensions: d.dimensions ?? null,
    };
    if (publish === "publish") update.status = "published";
    if (publish === "unpublish") update.status = "draft";

    const { error } = await ctx.supabase.from("projects").update(update).eq("id", id);
    if (error) throw new Error(error.message);

    const { error: tErr } = await ctx.supabase.from("project_translations").upsert(
      (["ka", "en"] as const).map((locale) => ({
        project_id: id,
        locale,
        title: d[locale].title,
        short_description: d[locale].short_description,
        description: d[locale].description,
        seo_title: d[locale].seo_title ?? null,
        seo_description: d[locale].seo_description ?? null,
      })),
      { onConflict: "project_id,locale" },
    );
    if (tErr) throw new Error(tErr.message);

    const label = d.en.title || d.ka.title;
    await logActivity(
      ctx,
      publish === "publish" ? "publish" : publish === "unpublish" ? "unpublish" : "update",
      "project",
      id,
      `${publish === "publish" ? "Published" : publish === "unpublish" ? "Unpublished" : "Saved"} “${label}”`,
    );
    revalidateSite();
    const { data: status } = await ctx.supabase.from("projects").select("status, slug").eq("id", id).single();
    return status as { status: "draft" | "published"; slug: string };
  });
}

export async function setProjectStatus(id: string, status: "draft" | "published") {
  return adminAction(async (ctx) => {
    if (status === "published") {
      const { data: t } = await ctx.supabase.from("project_translations").select("title").eq("project_id", id);
      if (!t?.some((r) => r.title?.trim())) throw new Error("Add a title before publishing.");
    }
    const { error } = await ctx.supabase.from("projects").update({ status }).eq("id", id);
    if (error) throw new Error(error.message);
    await logActivity(ctx, status === "published" ? "publish" : "unpublish", "project", id, `Set status to ${status}`);
    revalidateSite();
    return null;
  });
}

export async function setProjectFeatured(id: string, featured: boolean) {
  return adminAction(async (ctx) => {
    const { error } = await ctx.supabase.from("projects").update({ is_featured: featured }).eq("id", id);
    if (error) throw new Error(error.message);
    await logActivity(ctx, "update", "project", id, featured ? "Marked as featured" : "Removed from featured");
    revalidateSite();
    return null;
  });
}

export async function reorderProjects(ids: string[]) {
  return adminAction(async (ctx) => {
    const { error } = await ctx.supabase.rpc("reorder_rows", { p_table: "projects", p_ids: ids });
    if (error) throw new Error(error.message);
    revalidateSite();
    return null;
  });
}

export async function duplicateProject(id: string) {
  return adminAction(async (ctx) => {
    const { data: src, error } = await ctx.supabase.from("projects").select(PROJECT_SELECT).eq("id", id).single();
    if (error || !src) throw new Error("Project not found.");
    const p = src as Project;
    const slug = await uniqueSlug(ctx, `${p.slug}-copy`);
    const { data: max } = await ctx.supabase.from("projects").select("sort_order").order("sort_order", { ascending: false }).limit(1).maybeSingle();

    const { data: copy, error: cErr } = await ctx.supabase
      .from("projects")
      .insert({
        slug,
        category_id: p.category_id,
        status: "draft",
        is_featured: false,
        is_demo: p.is_demo,
        sort_order: (max?.sort_order ?? 0) + 1,
        location_ka: p.location_ka,
        location_en: p.location_en,
        project_date: p.project_date,
        scale: p.scale,
        materials_ka: p.materials_ka,
        materials_en: p.materials_en,
        dimensions: p.dimensions,
        created_by: ctx.user.id,
      })
      .select("id")
      .single();
    if (cErr || !copy) throw new Error(cErr?.message ?? "Could not duplicate.");

    await ctx.supabase.from("project_translations").insert(
      p.translations.map((t) => ({
        project_id: copy.id,
        locale: t.locale,
        title: t.title ? `${t.title} (${t.locale === "ka" ? "ასლი" : "copy"})` : "",
        short_description: t.short_description,
        description: t.description,
        seo_title: t.seo_title,
        seo_description: t.seo_description,
      })),
    );

    // Media rows reference the same files; files are only deleted when no row uses them anymore.
    const imageIdMap = new Map<string, string>();
    for (const img of p.images) {
      const { id: oldId, project_id: _pid, ...rest } = img;
      void _pid;
      const { data: newImg } = await ctx.supabase.from("project_images").insert({ ...rest, project_id: copy.id }).select("id").single();
      if (newImg) imageIdMap.set(oldId, newImg.id);
    }
    if (p.cover_image_id && imageIdMap.has(p.cover_image_id)) {
      await ctx.supabase.from("projects").update({ cover_image_id: imageIdMap.get(p.cover_image_id) }).eq("id", copy.id);
    }
    if (p.videos.length) {
      await ctx.supabase.from("project_videos").insert(
        p.videos.map(({ id: _i, project_id: _p, ...rest }) => {
          void _i;
          void _p;
          return { ...rest, project_id: copy.id };
        }),
      );
    }
    if (p.models.length) {
      await ctx.supabase.from("project_models").insert(
        p.models.map(({ id: _i, project_id: _p, created_at: _c, ...rest }) => {
          void _i;
          void _p;
          void _c;
          return { ...rest, project_id: copy.id };
        }),
      );
    }

    await logActivity(ctx, "duplicate", "project", copy.id, `Duplicated “${p.translations.find((t) => t.locale === "en")?.title || p.slug}”`);
    return { id: copy.id as string };
  });
}

export async function deleteProject(id: string) {
  return adminAction(async (ctx) => {
    const { data: src, error } = await ctx.supabase.from("projects").select(PROJECT_SELECT).eq("id", id).single();
    if (error || !src) throw new Error("Project not found.");
    const p = src as Project;
    const { error: dErr } = await ctx.supabase.from("projects").delete().eq("id", id);
    if (dErr) throw new Error(dErr.message);
    // Rows are gone (cascade); now remove files nobody references anymore.
    await cleanupProjectFiles(ctx, p);
    await logActivity(ctx, "delete", "project", id, `Deleted “${p.translations.find((t) => t.locale === "en")?.title || p.slug}”`);
    revalidateSite();
    return null;
  });
}
