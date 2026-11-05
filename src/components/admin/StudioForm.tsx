"use client";

import { useState } from "react";
import type { Principle, StudioInfo } from "@/lib/types";
import { saveStudio } from "@/app/admin/actions/content";
import { UNSPLASH, unsplashUrl } from "@/content/defaults";
import { Bilingual, Button, Card, PageHeader, useToast, useUnsavedWarning } from "./ui";
import { SiteImageField } from "./SiteImageField";

export function StudioForm({ initial }: { initial: StudioInfo }) {
  const toast = useToast();
  const [form, setForm] = useState(initial);
  const [saved, setSaved] = useState(JSON.stringify(initial));
  const [saving, setSaving] = useState(false);
  const dirty = JSON.stringify(form) !== saved;
  useUnsavedWarning(dirty);

  const bi = (base: "about_title" | "about_body" | "description") => ({
    name: base,
    values: { ka: form[`${base}_ka`], en: form[`${base}_en`] },
    onChange: (l: "ka" | "en", v: string) => setForm((f) => ({ ...f, [`${base}_${l}`]: v })),
  });

  const setPrinciple = (i: number, key: keyof Principle, v: string) =>
    setForm((f) => ({ ...f, principles: f.principles.map((p, j) => (j === i ? { ...p, [key]: v } : p)) }));

  const save = async () => {
    setSaving(true);
    const res = await saveStudio(form);
    setSaving(false);
    if (!res.ok) return toast("error", res.error);
    setSaved(JSON.stringify(form));
    toast("success", "Studio information saved.");
  };

  return (
    <>
      <PageHeader title="Studio information" description="The “Studio” section of the homepage and the short description used in the footer." actions={<Button variant="primary" onClick={save} loading={saving} disabled={!dirty}>Save changes</Button>} />
      <div className="space-y-6">
        <Card title="About the studio">
          <div className="space-y-5">
            <Bilingual label="Section headline" maxLength={240} {...bi("about_title")} />
            <Bilingual label="About text" multiline rows={8} maxLength={6000} {...bi("about_body")} placeholder={{ ka: "აბზაცები გამოყავით ცარიელი ხაზით.", en: "Separate paragraphs with an empty line." }} />
            <Bilingual label="Short studio description (footer & search engines)" multiline rows={2} maxLength={400} {...bi("description")} />
            <SiteImageField label="Studio photograph" purpose="studio" aspect="aspect-[3/4]" value={form.studio_image_path} fallbackUrl={unsplashUrl(UNSPLASH.slabsClose, 800)} onChange={(p) => setForm((f) => ({ ...f, studio_image_path: p }))} />
          </div>
        </Card>

        <Card
          title="Principles"
          description="Short statements shown below the about text (up to 8)."
          actions={
            form.principles.length < 8 && (
              <Button size="sm" onClick={() => setForm((f) => ({ ...f, principles: [...f.principles, { title_ka: "", title_en: "", body_ka: "", body_en: "" }] }))}>
                + Add principle
              </Button>
            )
          }
        >
          <div className="space-y-6">
            {form.principles.map((p, i) => (
              <div key={i} className="rounded-lg border border-black/[0.08] p-4">
                <div className="mb-3 flex items-center justify-between">
                  <span className="font-mono text-xs text-black/45">0{i + 1}</span>
                  <Button size="sm" variant="ghost" className="text-[#a4442e]" onClick={() => setForm((f) => ({ ...f, principles: f.principles.filter((_, j) => j !== i) }))}>
                    Remove
                  </Button>
                </div>
                <div className="space-y-4">
                  <Bilingual label="Title" name={`p${i}-t`} maxLength={120} values={{ ka: p.title_ka, en: p.title_en }} onChange={(l, v) => setPrinciple(i, `title_${l}`, v)} />
                  <Bilingual label="Text" name={`p${i}-b`} multiline rows={2} maxLength={600} values={{ ka: p.body_ka, en: p.body_en }} onChange={(l, v) => setPrinciple(i, `body_${l}`, v)} />
                </div>
              </div>
            ))}
          </div>
        </Card>
      </div>
    </>
  );
}
