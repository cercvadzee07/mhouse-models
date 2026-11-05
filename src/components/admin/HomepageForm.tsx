"use client";

import { useState } from "react";
import type { HomepageContent } from "@/lib/types";
import { saveHomepage } from "@/app/admin/actions/content";
import { Bilingual, Button, Card, PageHeader, Select, Toggle, useToast, useUnsavedWarning } from "./ui";
import { SiteImageField } from "./SiteImageField";

export function HomepageForm({
  initial,
  projects,
  models,
}: {
  initial: HomepageContent;
  projects: { id: string; title: string; published: boolean; featured: boolean }[];
  models: { id: string; label: string; published: boolean }[];
}) {
  const toast = useToast();
  const [form, setForm] = useState(initial);
  const [featured, setFeatured] = useState(projects.filter((p) => p.featured).map((p) => p.id));
  const [savedState, setSavedState] = useState(JSON.stringify([initial, projects.filter((p) => p.featured).map((p) => p.id)]));
  const [saving, setSaving] = useState(false);
  const dirty = JSON.stringify([form, featured]) !== savedState;
  useUnsavedWarning(dirty);

  const bi = (base: "eyebrow" | "headline" | "subheadline" | "cta_primary" | "cta_secondary" | "why_title") => ({
    values: { ka: String(form[`${base}_ka` as keyof HomepageContent] ?? ""), en: String(form[`${base}_en` as keyof HomepageContent] ?? "") },
    onChange: (l: "ka" | "en", v: string) => setForm((f) => ({ ...f, [`${base}_${l}`]: v })),
    name: base,
  });

  const save = async () => {
    setSaving(true);
    const res = await saveHomepage(form, featured);
    setSaving(false);
    if (!res.ok) return toast("error", res.error);
    setSavedState(JSON.stringify([form, featured]));
    toast("success", "Homepage saved — the website is updated.");
  };

  return (
    <>
      <PageHeader
        title="Homepage content"
        description="The first screen and key texts of the homepage."
        actions={
          <Button variant="primary" onClick={save} loading={saving} disabled={!dirty}>
            Save changes
          </Button>
        }
      />
      <div className="space-y-6">
        <Card title="Hero text">
          <div className="space-y-5">
            <Bilingual label="Small label above the headline" maxLength={160} {...bi("eyebrow")} />
            <Bilingual label="Main headline" required maxLength={200} {...bi("headline")} />
            <Bilingual label="Supporting description" multiline rows={3} maxLength={500} {...bi("subheadline")} />
            <Bilingual label="Primary button (opens the portfolio)" maxLength={60} {...bi("cta_primary")} />
            <Bilingual label="Secondary button (scrolls to contact)" maxLength={60} {...bi("cta_secondary")} />
          </div>
        </Card>

        <Card title="Hero visual" description="What appears next to the headline.">
          <div className="space-y-5">
            <div className="grid gap-3 sm:grid-cols-3">
              {(
                [
                  ["procedural", "Procedural 3D model", "The built-in interactive architectural model."],
                  ["model", "One of your 3D models", "Show an uploaded GLB from a published project."],
                  ["image", "Photograph", "A large still image."],
                ] as const
              ).map(([value, title, desc]) => (
                <button
                  key={value}
                  type="button"
                  onClick={() => setForm((f) => ({ ...f, hero_mode: value }))}
                  aria-pressed={form.hero_mode === value}
                  className={`rounded-xl border p-4 text-left transition-colors ${form.hero_mode === value ? "border-[#161614] bg-[#161614] text-white" : "border-black/10 hover:border-black/30"}`}
                >
                  <span className="block text-sm font-semibold">{title}</span>
                  <span className={`mt-1 block text-[0.78rem] ${form.hero_mode === value ? "text-white/70" : "text-black/55"}`}>{desc}</span>
                </button>
              ))}
            </div>
            {form.hero_mode === "model" && (
              <Select label="3D model" id="hero-model" value={form.hero_model_id ?? ""} onChange={(e) => setForm((f) => ({ ...f, hero_model_id: e.target.value || null }))}>
                <option value="">— Choose a model —</option>
                {models.map((m) => (
                  <option key={m.id} value={m.id} disabled={!m.published}>
                    {m.label}
                    {m.published ? "" : " (project not published)"}
                  </option>
                ))}
              </Select>
            )}
            {form.hero_mode === "model" && models.length === 0 && <p className="text-[0.8rem] text-black/55">Upload a GLB (or convertible) model to a project first.</p>}
            {form.hero_mode === "image" && (
              <SiteImageField label="Hero image" purpose="hero" aspect="aspect-[16/10]" value={form.hero_image_path} onChange={(p) => setForm((f) => ({ ...f, hero_image_path: p }))} />
            )}
            {form.hero_mode !== "image" && (
              <div className="grid gap-4 sm:grid-cols-2">
                <Toggle checked={form.hero_auto_rotate} onChange={(v) => setForm((f) => ({ ...f, hero_auto_rotate: v }))} label="Gentle automatic movement" description="Visitors with reduced-motion settings always see a still model." />
                {form.hero_mode === "procedural" && (
                  <Toggle checked={form.hero_evening_lights} onChange={(v) => setForm((f) => ({ ...f, hero_evening_lights: v }))} label="Window lights on by default" description="Visitors can toggle the lights themselves." />
                )}
              </div>
            )}
          </div>
        </Card>

        <Card title="Featured projects" description="Shown in “Selected work” on the homepage (up to 5, in portfolio order). If none are selected, the first published projects are shown.">
          {projects.length === 0 ? (
            <p className="text-sm text-black/50">No projects yet.</p>
          ) : (
            <ul className="grid gap-2 sm:grid-cols-2">
              {projects.map((p) => {
                const on = featured.includes(p.id);
                return (
                  <li key={p.id}>
                    <label className={`flex cursor-pointer items-center gap-3 rounded-lg border px-3 py-2.5 text-sm ${on ? "border-black/40 bg-black/[0.03]" : "border-black/10"}`}>
                      <input
                        type="checkbox"
                        checked={on}
                        onChange={() => setFeatured((list) => (on ? list.filter((x) => x !== p.id) : [...list, p.id]))}
                        className="h-4 w-4 accent-[#161614]"
                      />
                      <span className="min-w-0 flex-1 truncate">{p.title}</span>
                      {!p.published && <span className="text-[0.7rem] text-black/45">draft</span>}
                    </label>
                  </li>
                );
              })}
            </ul>
          )}
          {featured.length > 5 && <p className="mt-3 text-[0.78rem] text-[#7a5520]">Only the first 5 featured projects (by portfolio order) are shown on the homepage.</p>}
        </Card>

        <Card title="“Why physical models” section">
          <Bilingual label="Section headline" maxLength={200} {...bi("why_title")} />
        </Card>
      </div>
    </>
  );
}
