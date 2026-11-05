import type { Metadata } from "next";
import { requireAdminPage } from "@/lib/auth";
import type { Service } from "@/lib/types";
import { ServicesManager } from "@/components/admin/ServicesManager";

export const metadata: Metadata = { title: "Services" };

export default async function ServicesPage() {
  const { supabase } = await requireAdminPage();
  const { data } = await supabase.from("services").select("*").order("sort_order");
  return <ServicesManager initial={(data ?? []) as Service[]} />;
}
