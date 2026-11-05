import type { ContactSettings } from "@/lib/types";

export function whatsappHref(number: string | null | undefined): string | null {
  const digits = (number ?? "").replace(/\D/g, "");
  return digits.length >= 8 ? `https://wa.me/${digits}` : null;
}

export function telHref(phone: string | null | undefined): string | null {
  const clean = (phone ?? "").replace(/[^\d+]/g, "");
  return clean.length >= 6 ? `tel:${clean}` : null;
}

export type SocialName = "instagram" | "tiktok" | "facebook" | "linkedin";

export function socialLinks(c: ContactSettings): { name: SocialName; label: string; href: string }[] {
  const list: { name: SocialName; label: string; href: string | null }[] = [
    { name: "instagram", label: "Instagram", href: c.instagram_url },
    { name: "tiktok", label: "TikTok", href: c.tiktok_url },
    { name: "facebook", label: "Facebook", href: c.facebook_url },
    { name: "linkedin", label: "LinkedIn", href: c.linkedin_url },
  ];
  return list.filter((s): s is { name: SocialName; label: string; href: string } => !!s.href && /^https?:\/\//.test(s.href));
}
