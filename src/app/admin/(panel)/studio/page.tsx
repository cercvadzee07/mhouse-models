import type { Metadata } from "next";
import { requireAdminPage } from "@/lib/auth";
import { defaultStudio } from "@/content/defaults";
import type { StudioInfo } from "@/lib/types";
import { StudioForm } from "@/components/admin/StudioForm";

export const metadata: Metadata = { title: "Studio information" };

export default async function StudioPage() {
  const { supabase } = await requireAdminPage();
  const { data } = await supabase.from("studio_info").select("*").eq("id", 1).maybeSingle();
  return <StudioForm initial={{ ...defaultStudio, ...((data ?? {}) as Partial<StudioInfo>) }} />;
}
