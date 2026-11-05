import type { Metadata } from "next";
import { requireAdminPage } from "@/lib/auth";
import type { ContactSettings } from "@/lib/types";
import { ContactForm } from "@/components/admin/ContactSettingsForm";

export const metadata: Metadata = { title: "Contact information" };

export default async function ContactPage() {
  const { supabase } = await requireAdminPage();
  const { data } = await supabase.from("contact_settings").select("*").eq("id", 1).maybeSingle();
  const c = (data ?? {}) as Partial<ContactSettings>;
  const s = (v: string | null | undefined) => v ?? "";
  return (
    <ContactForm
      initial={{
        email: s(c.email),
        phone: s(c.phone),
        whatsapp: s(c.whatsapp),
        instagram_url: s(c.instagram_url),
        tiktok_url: s(c.tiktok_url),
        facebook_url: s(c.facebook_url),
        linkedin_url: s(c.linkedin_url),
        address_ka: s(c.address_ka),
        address_en: s(c.address_en),
        show_address: c.show_address ?? false,
        notify_email: s(c.notify_email),
      }}
      emailConfigured={Boolean(process.env.RESEND_API_KEY && process.env.CONTACT_FROM_EMAIL)}
    />
  );
}
