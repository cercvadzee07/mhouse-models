import type { Metadata } from "next";
import { requireAdminPage } from "@/lib/auth";
import { defaultGeneral } from "@/content/defaults";
import type { Category, GeneralSettings } from "@/lib/types";
import { SettingsForm } from "@/components/admin/SettingsForm";

export const metadata: Metadata = { title: "General settings" };

export default async function SettingsPage() {
  const { supabase, email } = await requireAdminPage();
  const [{ data: general }, { data: categories }, { count: demoCount }] = await Promise.all([
    supabase.from("general_settings").select("*").eq("id", 1).maybeSingle(),
    supabase.from("project_categories").select("*").order("sort_order"),
    supabase.from("projects").select("id", { count: "exact", head: true }).eq("is_demo", true),
  ]);
  const g = { ...defaultGeneral, ...((general ?? {}) as Partial<GeneralSettings>) };
  return (
    <SettingsForm
      initial={{ studio_name: g.studio_name, studio_name_short: g.studio_name_short, wordmark_suffix: g.wordmark_suffix, show_demo_badges: g.show_demo_badges }}
      categories={(categories ?? []) as Category[]}
      demoCount={demoCount ?? 0}
      email={email}
    />
  );
}
