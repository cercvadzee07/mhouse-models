"use client";

import { useState } from "react";
import { saveContact } from "@/app/admin/actions/content";
import { Badge, Bilingual, Button, Card, PageHeader, TextInput, Toggle, useToast, useUnsavedWarning } from "./ui";

type Form = {
  email: string;
  phone: string;
  whatsapp: string;
  instagram_url: string;
  tiktok_url: string;
  facebook_url: string;
  linkedin_url: string;
  address_ka: string;
  address_en: string;
  show_address: boolean;
  notify_email: string;
};

export function ContactForm({ initial, emailConfigured }: { initial: Form; emailConfigured: boolean }) {
  const toast = useToast();
  const [form, setForm] = useState(initial);
  const [saved, setSaved] = useState(JSON.stringify(initial));
  const [saving, setSaving] = useState(false);
  const dirty = JSON.stringify(form) !== saved;
  useUnsavedWarning(dirty);
  const set = (k: keyof Form) => (e: React.ChangeEvent<HTMLInputElement>) => setForm((f) => ({ ...f, [k]: e.target.value }));

  const save = async () => {
    setSaving(true);
    const res = await saveContact(form);
    setSaving(false);
    if (!res.ok) return toast("error", res.error);
    setSaved(JSON.stringify(form));
    toast("success", "Contact information saved.");
  };

  return (
    <>
      <PageHeader title="Contact information" description="Shown in the contact section and the footer. Empty fields are hidden." actions={<Button variant="primary" onClick={save} loading={saving} disabled={!dirty}>Save changes</Button>} />
      <div className="space-y-6">
        <Card title="Direct contact">
          <div className="grid gap-4 sm:grid-cols-3">
            <TextInput label="Email" id="c-email" type="email" value={form.email} onChange={set("email")} placeholder="studio@example.ge" />
            <TextInput label="Phone" id="c-phone" type="tel" value={form.phone} onChange={set("phone")} placeholder="+995 5XX XX XX XX" />
            <TextInput label="WhatsApp number" id="c-wa" type="tel" value={form.whatsapp} onChange={set("whatsapp")} placeholder="+995 5XX XX XX XX" hint="international format" />
          </div>
        </Card>
        <Card title="Social media" description="Full links starting with https://">
          <div className="grid gap-4 sm:grid-cols-2">
            <TextInput label="Instagram" id="c-ig" type="url" value={form.instagram_url} onChange={set("instagram_url")} placeholder="https://instagram.com/…" />
            <TextInput label="TikTok" id="c-tt" type="url" value={form.tiktok_url} onChange={set("tiktok_url")} placeholder="https://www.tiktok.com/@…" />
            <TextInput label="Facebook" id="c-fb" type="url" value={form.facebook_url} onChange={set("facebook_url")} placeholder="https://facebook.com/…" />
            <TextInput label="LinkedIn" id="c-li" type="url" value={form.linkedin_url} onChange={set("linkedin_url")} placeholder="https://linkedin.com/…" />
          </div>
        </Card>
        <Card title="Business location">
          <div className="space-y-4">
            <Bilingual label="Address / location" name="addr" maxLength={300} values={{ ka: form.address_ka, en: form.address_en }} onChange={(l, v) => setForm((f) => ({ ...f, [`address_${l}`]: v }))} />
            <Toggle checked={form.show_address} onChange={(v) => setForm((f) => ({ ...f, show_address: v }))} label="Show the location on the website" />
          </div>
        </Card>
        <Card title="Inquiry notifications" description="New contact-form inquiries are always stored in Admin → Inquiries. Optionally, they can also be emailed.">
          <div className="space-y-3">
            <TextInput label="Send new inquiries to" id="c-notify" type="email" value={form.notify_email} onChange={set("notify_email")} placeholder="Leave empty to use the contact email" />
            <p className="flex items-center gap-2 text-[0.8rem] text-black/55">
              Email delivery: {emailConfigured ? <Badge tone="success">configured</Badge> : <Badge tone="warning">not configured</Badge>}
              {!emailConfigured && <span>Set RESEND_API_KEY and CONTACT_FROM_EMAIL on the server to enable it.</span>}
            </p>
          </div>
        </Card>
      </div>
    </>
  );
}
