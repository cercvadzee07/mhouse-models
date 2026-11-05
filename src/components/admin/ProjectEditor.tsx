"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import type { Category, Project, ProjectImage, ProjectModel, ProjectVideo } from "@/lib/types";
import { slugify } from "@/lib/slug";
import { saveProject, setProjectStatus, type ProjectInput } from "@/app/admin/actions/projects";
import { Badge, Bilingual, Button, Card, Select, TextInput, Toggle, useToast, useUnsavedWarning } from "./ui";
import { ImageManager } from "./ImageManager";
import { VideoManager } from "./VideoManager";
import { ModelManager } from "./ModelManager";

type Lang = "ka" | "en";
type T = { title: string; short_description: string; description: string; seo_title: string; seo_description: string };

function initialForm(p: Project) {
  const tr = (l: Lang): T => {
    const t = p.translations.find((x) => x.locale === l);
    return {
      title: t?.title ?? "",
      short_description: t?.short_description ?? "",
      description: t?.description ?? "",
      seo_title: t?.seo_title ?? "",
      seo_description: t?.seo_description ?? "",
    };
  };
  return {
    slug: p.slug,
    category_id: p.category_id,
    is_featured: p.is_featured,
    location_ka: p.location_ka ?? "",
    location_en: p.location_en ?? "",
    project_date: p.project_date ?? "",
    scale: p.scale ?? "",
    materials_ka: p.materials_ka ?? "",
    materials_en: p.materials_en ?? "",
    dimensions: p.dimensions ?? "",
    ka: tr("ka"),
    en: tr("en"),
  };
}

const SECTIONS = [
  { id: "basics", label: "1 · Name & description" },
  { id: "photos", label: "2 · Photographs" },
  { id: "models", label: "3 · 3D models" },
  { id: "videos", label: "4 · Videos" },
  { id: "details", label: "5 · Details" },
  { id: "seo", label: "6 · SEO" },
];

export function ProjectEditor({ project, categories, siteUrl }: { project: Project; categories: Category[]; siteUrl: string }) {
  const router = useRouter();
  const toast = useToast();
  const [form, setForm] = useState(() => initialForm(project));
  const [saved, setSaved] = useState(() => JSON.stringify(initialForm(project)));
  const [status, setStatus] = useState(project.status);
  const [slugTouched, setSlugTouched] = useState(project.slug !== slugify(project.translations.find((t) => t.locale === "en")?.title || ""));
  const [busy, setBusy] = useState<null | "save" | "publish" | "unpublish">(null);
  const [images, setImages] = useState<ProjectImage[]>(project.images);
  const [videos, setVideos] = useState<ProjectVideo[]>(project.videos);
  const [models, setModels] = useState<ProjectModel[]>(project.models);
  const [coverId, setCoverId] = useState(project.cover_image_id);

  const dirty = JSON.stringify(form) !== saved;
  useUnsavedWarning(dirty);

  const setT = (lang: Lang, key: keyof T, value: string) => {
    setForm((f) => {
      const next = { ...f, [lang]: { ...f[lang], [key]: value } };
      if (key === "title" && !slugTouched) {
        const base = lang === "en" ? value : f.en.title || value;
        const s = slugify(base);
        if (s) next.slug = s;
      }
      return next;
    });
  };

  const checklist = useMemo(
    () => [
      { ok: !!(form.ka.title && form.en.title), label: "Title in Georgian and English" },
      { ok: !!(form.ka.short_description && form.en.short_description), label: "Short descriptions" },
      { ok: !!form.category_id, label: "Category" },
      { ok: images.some((i) => i.kind === "gallery"), label: "At least one photograph" },
      { ok: !!coverId, label: "Cover photograph" },
      { ok: models.some((m) => m.display_status === "ready"), label: "3D model (optional)", optional: true },
      { ok: videos.length > 0, label: "Videos (optional)", optional: true },
    ],
    [form, images, models, videos, coverId],
  );

  const submit = async (mode: "save" | "publish" | "unpublish") => {
    setBusy(mode);
    const payload: ProjectInput = {
      ...form,
      project_date: form.project_date || null,
      category_id: form.category_id || null,
    };
    const res = await saveProject(project.id, payload, mode === "save" ? undefined : mode);
    setBusy(null);
    if (!res.ok) return toast("error", res.error);
    setSaved(JSON.stringify(form));
    setStatus(res.data.status);
    toast(
      "success",
      mode === "publish" ? "Published — the project is now live on the website." : mode === "unpublish" ? "Unpublished — the project is hidden from the website." : status === "published" ? "Saved — the live page has been updated." : "Draft saved.",
    );
    router.refresh();
  };

  const quickStatus = async (next: "draft" | "published") => {
    if (dirty) return submit(next === "published" ? "publish" : "unpublish");
    setBusy(next === "published" ? "publish" : "unpublish");
    const res = await setProjectStatus(project.id, next);
    setBusy(null);
    if (!res.ok) return toast("error", res.error);
    setStatus(next);
    toast("success", next === "published" ? "Published." : "Unpublished.");
    router.refresh();
  };

  const publicUrl = `${siteUrl}/projects/${form.slug}`;

  return (
    <div className="pb-28">
      <div className="mb-6 flex flex-wrap items-start justify-between gap-4">
        <div>
          <Link href="/admin/projects" className="text-[0.8rem] text-black/50 hover:text-black">
            ← All projects
          </Link>
          <h1 className="mt-1 text-[1.45rem] font-semibold tracking-[-0.01em]">{form.en.title || form.ka.title || "Untitled project"}</h1>
          <div className="mt-2 flex flex-wrap items-center gap-2 text-[0.8rem]">
            {status === "published" ? <Badge tone="success">● Published</Badge> : <Badge tone="warning">Draft</Badge>}
            {project.is_demo && <Badge>Demonstration</Badge>}
            {status === "published" && (
              <a href={publicUrl} target="_blank" rel="noopener noreferrer" className="text-black/55 underline underline-offset-2 hover:text-black">
                View live page ↗
              </a>
            )}
          </div>
        </div>
        <nav aria-label="Editor sections" className="flex flex-wrap gap-1">
          {SECTIONS.map((s) => (
            <a key={s.id} href={`#${s.id}`} className="rounded-md px-2.5 py-1.5 text-[0.78rem] text-black/60 hover:bg-black/5 hover:text-black">
              {s.label}
            </a>
          ))}
        </nav>
      </div>

      <div className="grid gap-6 xl:grid-cols-[1fr_18rem]">
        <div className="space-y-6">
          <div id="basics" className="scroll-mt-20">
            <Card title="Name & description" description="Georgian is shown by default on the website; English is shown at /en.">
              <div className="space-y-5">
                <Bilingual label="Project title" name="title" required maxLength={200} values={{ ka: form.ka.title, en: form.en.title }} onChange={(l, v) => setT(l, "title", v)} />
                <Bilingual
                  label="Short description"
                  name="short"
                  multiline
                  rows={2}
                  maxLength={600}
                  values={{ ka: form.ka.short_description, en: form.en.short_description }}
                  onChange={(l, v) => setT(l, "short_description", v)}
                  placeholder={{ ka: "1–2 წინადადება პორტფოლიოს ბარათისთვის", en: "1–2 sentences shown on portfolio cards" }}
                />
                <Bilingual
                  label="Full description"
                  name="description"
                  multiline
                  rows={8}
                  maxLength={20000}
                  values={{ ka: form.ka.description, en: form.en.description }}
                  onChange={(l, v) => setT(l, "description", v)}
                  placeholder={{ ka: "აბზაცები გამოყავით ცარიელი ხაზით.", en: "Separate paragraphs with an empty line." }}
                />
                <div className="grid gap-4 sm:grid-cols-2">
                  <Select label="Category" id="category" value={form.category_id ?? ""} onChange={(e) => setForm((f) => ({ ...f, category_id: e.target.value || null }))}>
                    <option value="">— No category —</option>
                    {categories.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.name_en} · {c.name_ka}
                      </option>
                    ))}
                  </Select>
                  <TextInput
                    label="URL slug"
                    id="slug"
                    hint={`/projects/${form.slug || "…"}`}
                    value={form.slug}
                    onChange={(e) => {
                      setSlugTouched(true);
                      setForm((f) => ({ ...f, slug: e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, "-") }));
                    }}
                    onBlur={() => setForm((f) => ({ ...f, slug: slugify(f.slug) || f.slug }))}
                  />
                </div>
              </div>
            </Card>
          </div>

          <div id="photos" className="scroll-mt-20 space-y-6">
            <Card title="Project photographs" description="The cover photo is used on portfolio cards and at the top of the project page. Drag to reorder.">
              <ImageManager projectId={project.id} kind="gallery" images={images} coverId={coverId} onImagesChange={setImages} onCoverChange={setCoverId} />
            </Card>
            <Card title="Production photographs" description="Optional: fabrication, assembly, painting, detailing — shown in a “Making of” section.">
              <ImageManager projectId={project.id} kind="production" images={images} coverId={coverId} onImagesChange={setImages} onCoverChange={setCoverId} />
            </Card>
          </div>

          <div id="models" className="scroll-mt-20">
            <Card title="3D models" description="Interactive viewer on the project page. GLB is shown directly; OBJ, FBX, STL, 3MF and embedded glTF are converted to GLB in your browser. Originals are always kept.">
              <ModelManager projectId={project.id} models={models} onChange={setModels} />
            </Card>
          </div>

          <div id="videos" className="scroll-mt-20">
            <Card title="Videos" description="Finished model, production process, behind the scenes, walkthroughs and close-ups. Videos load only when a visitor presses play.">
              <VideoManager projectId={project.id} videos={videos} onChange={setVideos} />
            </Card>
          </div>

          <div id="details" className="scroll-mt-20">
            <Card title="Project details" description="All optional — only filled fields are shown on the website.">
              <div className="space-y-5">
                <div className="grid gap-4 sm:grid-cols-3">
                  <TextInput label="Scale" id="scale" placeholder="1:200" maxLength={40} value={form.scale} onChange={(e) => setForm((f) => ({ ...f, scale: e.target.value }))} />
                  <TextInput label="Dimensions" id="dimensions" placeholder="120 × 80 × 45 cm" maxLength={120} value={form.dimensions} onChange={(e) => setForm((f) => ({ ...f, dimensions: e.target.value }))} />
                  <TextInput label="Project date" id="date" type="date" value={form.project_date} onChange={(e) => setForm((f) => ({ ...f, project_date: e.target.value }))} />
                </div>
                <Bilingual label="Location" name="location" maxLength={200} values={{ ka: form.location_ka, en: form.location_en }} onChange={(l, v) => setForm((f) => ({ ...f, [`location_${l}`]: v }))} />
                <Bilingual label="Materials" name="materials" maxLength={400} values={{ ka: form.materials_ka, en: form.materials_en }} onChange={(l, v) => setForm((f) => ({ ...f, [`materials_${l}`]: v }))} />
                <Toggle id="featured" checked={form.is_featured} onChange={(v) => setForm((f) => ({ ...f, is_featured: v }))} label="Featured project" description="Shown in the “Selected work” section on the homepage." />
              </div>
            </Card>
          </div>

          <div id="seo" className="scroll-mt-20">
            <Card title="Search engines & sharing" description="Leave empty to use the project title and short description automatically.">
              <div className="space-y-5">
                <Bilingual label="SEO title" name="seo-title" maxLength={70} values={{ ka: form.ka.seo_title, en: form.en.seo_title }} onChange={(l, v) => setT(l, "seo_title", v)} />
                <Bilingual label="SEO description" name="seo-desc" multiline rows={2} maxLength={160} values={{ ka: form.ka.seo_description, en: form.en.seo_description }} onChange={(l, v) => setT(l, "seo_description", v)} />
                <div className="rounded-lg border border-black/10 bg-[#fbfaf8] p-4">
                  <p className="text-[0.7rem] uppercase tracking-wide text-black/40">Google preview (GE)</p>
                  <p className="mt-2 truncate text-[0.8rem] text-[#3b6b3b]">{publicUrl}</p>
                  <p className="truncate text-[1.05rem] text-[#1a0dab]">{form.ka.seo_title || form.ka.title || "—"}</p>
                  <p className="line-clamp-2 text-[0.82rem] text-black/60">{form.ka.seo_description || form.ka.short_description || "—"}</p>
                </div>
              </div>
            </Card>
          </div>
        </div>

        <aside className="space-y-4 xl:sticky xl:top-20 xl:self-start">
          <Card title="Publishing checklist">
            <ul className="space-y-2 text-[0.82rem]">
              {checklist.map((c) => (
                <li key={c.label} className="flex items-start gap-2">
                  <span className={`mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded-full text-[0.6rem] ${c.ok ? "bg-[#4f6b4a] text-white" : c.optional ? "bg-black/10 text-black/40" : "bg-[#e9b877]/50 text-[#7a5520]"}`}>
                    {c.ok ? "✓" : c.optional ? "–" : "!"}
                  </span>
                  <span className={c.ok ? "text-black/70" : "text-black/55"}>{c.label}</span>
                </li>
              ))}
            </ul>
            <p className="mt-4 text-[0.75rem] leading-relaxed text-black/45">Photos, videos and 3D models are saved as soon as they finish uploading. Text changes are saved with the buttons below.</p>
          </Card>
        </aside>
      </div>

      {/* Sticky action bar */}
      <div className="fixed inset-x-0 bottom-0 z-30 border-t border-black/10 bg-white/95 backdrop-blur lg:left-64">
        <div className="mx-auto flex max-w-[1400px] flex-wrap items-center justify-between gap-3 px-4 py-3 sm:px-6">
          <p className="text-[0.8rem] text-black/55">{dirty ? <span className="text-[#7a5520]">● Unsaved changes</span> : "All changes saved"}</p>
          <div className="flex flex-wrap gap-2">
            <a href={`/admin/preview/${project.id}`} target="_blank" rel="noopener noreferrer" className="inline-flex h-10 items-center rounded-lg px-4 text-sm font-medium hover:bg-black/5">
              Preview ↗
            </a>
            {status === "published" ? (
              <>
                <Button onClick={() => quickStatus("draft")} loading={busy === "unpublish"}>
                  Unpublish
                </Button>
                <Button variant="primary" onClick={() => submit("save")} loading={busy === "save"} disabled={!dirty}>
                  Save & update live page
                </Button>
              </>
            ) : (
              <>
                <Button onClick={() => submit("save")} loading={busy === "save"}>
                  Save draft
                </Button>
                <Button variant="primary" onClick={() => quickStatus("published")} loading={busy === "publish"}>
                  Publish
                </Button>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
