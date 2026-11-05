import type { Metadata } from "next";
import { requireAdminPage } from "@/lib/auth";
import { defaultSeo } from "@/content/defaults";
import type { SeoSetting } from "@/lib/types";
import { SeoForm } from "@/components/admin/SeoForm";

export const metadata: Metadata = { title: "SEO settings" };

export default async function SeoPage() {
  const { supabase } = await requireAdminPage();
  const { data } = await supabase.from("seo_settings").select("*");
  const rows = defaultSeo.map((d) => {
    const row = (data ?? []).find((r: SeoSetting) => r.page_key === d.page_key);
    return row
      ? { page_key: d.page_key, title_ka: row.title_ka, title_en: row.title_en, description_ka: row.description_ka, description_en: row.description_en, og_image_path: row.og_image_path }
      : d;
  });
  return <SeoForm initial={rows} />;
}
