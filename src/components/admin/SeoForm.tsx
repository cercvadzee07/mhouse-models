"use client";

import { useState } from "react";
import type { SeoSetting } from "@/lib/types";
import { saveSeo } from "@/app/admin/actions/content";
import { Bilingual, Button, Card, PageHeader, useToast, useUnsavedWarning } from "./ui";
import { SiteImageField } from "./SiteImageField";

const LABELS: Record<SeoSetting["page_key"], { title: string; description: string }> = {
  default: { title: "Site defaults", description: "Used for any page without its own settings. The Open Graph image is the default social-sharing image." },
  home: { title: "Homepage", description: "Title and description shown in Google and when the homepage is shared." },
  projects: { title: "Portfolio page", description: "The /projects page. Individual projects have their own SEO fields in the project editor." },
};

export function SeoForm({ initial }: { initial: SeoSetting[] }) {
  const toast = useToast();
  const [rows, setRows] = useState(initial);
  const [saved, setSaved] = useState(JSON.stringify(initial));
  const [saving, setSaving] = useState(false);
  const dirty = JSON.stringify(rows) !== saved;
  useUnsavedWarning(dirty);

  const patch = (key: SeoSetting["page_key"], p: Partial<SeoSetting>) => setRows((list) => list.map((r) => (r.page_key === key ? { ...r, ...p } : r)));

  const save = async () => {
    setSaving(true);
    const res = await saveSeo(rows);
    setSaving(false);
    if (!res.ok) return toast("error", res.error);
    setSaved(JSON.stringify(rows));
    toast("success", "SEO settings saved.");
  };

  return (
    <>
      <PageHeader title="SEO settings" description="Page titles, meta descriptions and social-sharing images in both languages." actions={<Button variant="primary" onClick={save} loading={saving} disabled={!dirty}>Save changes</Button>} />
      <div className="space-y-6">
        {rows.map((r) => (
          <Card key={r.page_key} title={LABELS[r.page_key].title} description={LABELS[r.page_key].description}>
            <div className="space-y-5">
              <Bilingual label="Page title" name={`${r.page_key}-t`} maxLength={70} values={{ ka: r.title_ka, en: r.title_en }} onChange={(l, v) => patch(r.page_key, { [`title_${l}`]: v })} />
              <Bilingual label="Meta description" name={`${r.page_key}-d`} multiline rows={2} maxLength={160} values={{ ka: r.description_ka, en: r.description_en }} onChange={(l, v) => patch(r.page_key, { [`description_${l}`]: v })} />
              <SiteImageField label="Open Graph image (1200×630)" purpose="og" aspect="aspect-[1200/630]" value={r.og_image_path} onChange={(p) => patch(r.page_key, { og_image_path: p })} />
            </div>
          </Card>
        ))}
      </div>
    </>
  );
}
