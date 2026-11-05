import { requireAdminPage } from "@/lib/auth";
import { AdminShell } from "@/components/admin/AdminShell";

export default async function PanelLayout({ children }: { children: React.ReactNode }) {
  const admin = await requireAdminPage();
  const [{ data: general }, { count }] = await Promise.all([
    admin.supabase.from("general_settings").select("studio_name").eq("id", 1).maybeSingle(),
    admin.supabase.from("inquiries").select("id", { count: "exact", head: true }).eq("status", "new"),
  ]);
  return (
    <AdminShell email={admin.email} studioName={general?.studio_name ?? "Studio"} newInquiries={count ?? 0}>
      {children}
    </AdminShell>
  );
}
