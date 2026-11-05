import type { Metadata } from "next";
import { requireAdminPage } from "@/lib/auth";
import { InquiriesList, type Inquiry } from "@/components/admin/InquiriesList";

export const metadata: Metadata = { title: "Inquiries" };

export default async function InquiriesPage() {
  const { supabase } = await requireAdminPage();
  const { data } = await supabase.from("inquiries").select("*").order("created_at", { ascending: false }).limit(500);
  return <InquiriesList initial={(data ?? []) as Inquiry[]} />;
}
