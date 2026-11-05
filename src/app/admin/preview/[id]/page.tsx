import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { z } from "zod";
import { requireAdminPage } from "@/lib/auth";
import { PROJECT_SELECT, sortProject, translation } from "@/lib/data/project-helpers";
import { getDictionary } from "@/i18n/get-dictionary";
import type { Project } from "@/lib/types";
import { ProjectDetail } from "@/components/site/project/ProjectDetail";

export const metadata: Metadata = { title: "Preview", robots: { index: false } };

/**
 * Full-fidelity preview of a project page (including drafts), rendered with the
 * public components. Only CMS users can open it.
 */
export default async function PreviewPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ lang?: string }> }) {
  const { id } = await params;
  const { lang } = await searchParams;
  if (!z.string().uuid().safeParse(id).success) notFound();
  const { supabase } = await requireAdminPage();
  const { data } = await supabase.from("projects").select(PROJECT_SELECT).eq("id", id).maybeSingle();
  if (!data) notFound();
  const project = sortProject(data as Project);
  const locale = lang === "en" ? "en" : "ka";
  const t = getDictionary(locale);

  return (
    <div lang={locale} className="min-h-screen bg-paper text-ink" style={{ fontFamily: "var(--font-sans)" }}>
      <div className="sticky top-0 z-50 flex flex-wrap items-center justify-between gap-3 bg-[#161614] px-4 py-2.5 text-[0.8rem] text-white">
        <span className="flex items-center gap-2">
          <span className={`rounded px-1.5 py-0.5 text-[0.68rem] font-semibold ${project.status === "published" ? "bg-[#4f6b4a]" : "bg-[#e9b877] text-black"}`}>
            {project.status === "published" ? "PUBLISHED" : "DRAFT"}
          </span>
          Preview of “{translation(project, locale).title || "Untitled"}”
        </span>
        <span className="flex items-center gap-3">
          <Link href={`?lang=ka`} className={locale === "ka" ? "font-semibold underline" : "text-white/60 hover:text-white"}>
            GE
          </Link>
          <Link href={`?lang=en`} className={locale === "en" ? "font-semibold underline" : "text-white/60 hover:text-white"}>
            EN
          </Link>
          <Link href={`/admin/projects/${project.id}`} className="rounded-md bg-white px-3 py-1 font-medium text-black">
            Back to editor
          </Link>
        </span>
      </div>
      <ProjectDetail project={project} locale={locale} t={t} preview />
    </div>
  );
}
