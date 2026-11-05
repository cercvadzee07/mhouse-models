import type { Metadata } from "next";
import { requireAdminPage } from "@/lib/auth";
import { PROJECT_SELECT, sortProject } from "@/lib/data/project-helpers";
import type { Category, Project } from "@/lib/types";
import { ProjectsTable } from "@/components/admin/ProjectsTable";

export const metadata: Metadata = { title: "Projects" };

export default async function ProjectsPage({ searchParams }: { searchParams: Promise<{ status?: string }> }) {
  const { supabase } = await requireAdminPage();
  const { status } = await searchParams;
  const [{ data: projects, error }, { data: categories }] = await Promise.all([
    supabase.from("projects").select(PROJECT_SELECT).order("sort_order").order("created_at", { ascending: false }),
    supabase.from("project_categories").select("*").order("sort_order"),
  ]);
  if (error) throw new Error(error.message);
  return (
    <ProjectsTable
      initial={((projects ?? []) as Project[]).map(sortProject)}
      categories={(categories ?? []) as Category[]}
      initialStatus={status === "published" || status === "draft" ? status : "all"}
    />
  );
}
