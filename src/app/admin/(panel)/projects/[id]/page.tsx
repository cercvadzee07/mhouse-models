import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { z } from "zod";
import { requireAdminPage } from "@/lib/auth";
import { PROJECT_SELECT, sortProject } from "@/lib/data/project-helpers";
import type { Category, Project } from "@/lib/types";
import { env } from "@/lib/env";
import { ProjectEditor } from "@/components/admin/ProjectEditor";

export const metadata: Metadata = { title: "Edit project" };

export default async function EditProjectPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!z.string().uuid().safeParse(id).success) notFound();
  const { supabase } = await requireAdminPage();
  const [{ data: project }, { data: categories }] = await Promise.all([
    supabase.from("projects").select(PROJECT_SELECT).eq("id", id).maybeSingle(),
    supabase.from("project_categories").select("*").order("sort_order"),
  ]);
  if (!project) notFound();
  return <ProjectEditor key={id} project={sortProject(project as Project)} categories={(categories ?? []) as Category[]} siteUrl={env.siteUrl} />;
}
