import type { Metadata } from "next";
import { requireAdminPage } from "@/lib/auth";
import type { Category } from "@/lib/types";
import { NewProjectForm } from "@/components/admin/NewProjectForm";
import { PageHeader } from "@/components/admin/ui";

export const metadata: Metadata = { title: "Add new project" };

export default async function NewProjectPage() {
  const { supabase } = await requireAdminPage();
  const { data } = await supabase.from("project_categories").select("*").order("sort_order");
  return (
    <div className="mx-auto max-w-3xl">
      <PageHeader
        title="Add new project"
        description="Start with the name and category. On the next screen you can add descriptions, photos, videos and 3D models, preview the page, and publish."
      />
      <NewProjectForm categories={(data ?? []) as Category[]} />
    </div>
  );
}
