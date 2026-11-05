import type { Metadata } from "next";
import { requireAdminPage } from "@/lib/auth";
import { defaultHomepage } from "@/content/defaults";
import type { HomepageContent } from "@/lib/types";
import { HomepageForm } from "@/components/admin/HomepageForm";

export const metadata: Metadata = { title: "Homepage content" };

export default async function HomepagePage() {
  const { supabase } = await requireAdminPage();
  const [{ data: home }, { data: projects }, { data: models }] = await Promise.all([
    supabase.from("homepage_content").select("*").eq("id", 1).maybeSingle(),
    supabase.from("projects").select("id, slug, status, is_featured, sort_order, translations:project_translations(locale, title)").order("sort_order"),
    supabase
      .from("project_models")
      .select("id, original_name, label_en, project_id, display_status, project:projects(status, translations:project_translations(locale, title))")
      .eq("display_status", "ready"),
  ]);

  type ProjectLite = { id: string; slug: string; status: string; is_featured: boolean; translations: { locale: string; title: string }[] };
  type ModelLite = { id: string; original_name: string; label_en: string; project: { status: string; translations: { locale: string; title: string }[] } | null };
  const title = (t: { locale: string; title: string }[]) => t.find((x) => x.locale === "en")?.title || t.find((x) => x.locale === "ka")?.title || "Untitled";

  return (
    <HomepageForm
      initial={{ ...defaultHomepage, ...((home ?? {}) as Partial<HomepageContent>) }}
      projects={((projects ?? []) as ProjectLite[]).map((p) => ({ id: p.id, title: title(p.translations), published: p.status === "published", featured: p.is_featured }))}
      models={((models ?? []) as unknown as ModelLite[]).map((m) => ({
        id: m.id,
        label: `${m.project ? title(m.project.translations) : "?"} — ${m.label_en || m.original_name}`,
        published: m.project?.status === "published",
      }))}
    />
  );
}
