"use client";

/* eslint-disable @next/next/no-img-element */
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import type { Category, Project } from "@/lib/types";
import { coverImage, translation } from "@/lib/data/project-helpers";
import { imageThumb } from "@/lib/storage";
import { deleteProject, duplicateProject, reorderProjects, setProjectFeatured, setProjectStatus } from "@/app/admin/actions/projects";
import { Badge, Button, PageHeader, Select, TextInput, useConfirm, useToast } from "./ui";
import { DragHandle, SortableList } from "./Sortable";

export function ProjectsTable({ initial, categories, initialStatus }: { initial: Project[]; categories: Category[]; initialStatus: "all" | "draft" | "published" }) {
  const router = useRouter();
  const toast = useToast();
  const confirm = useConfirm();
  const [projects, setProjects] = useState(initial);
  const [q, setQ] = useState("");
  const [status, setStatus] = useState(initialStatus);
  const [category, setCategory] = useState("all");
  const [busy, setBusy] = useState<string | null>(null);

  const filtered = useMemo(() => {
    const needle = q.trim().toLowerCase();
    return projects.filter((p) => {
      if (status !== "all" && p.status !== status) return false;
      if (category !== "all" && (category === "none" ? p.category_id : p.category_id !== category)) return false;
      if (!needle) return true;
      const hay = [p.slug, ...p.translations.map((t) => `${t.title} ${t.short_description}`)].join(" ").toLowerCase();
      return hay.includes(needle);
    });
  }, [projects, q, status, category]);

  const canReorder = !q && status === "all" && category === "all";

  const run = async (id: string, fn: () => Promise<{ ok: boolean; error?: string }>, success: string, after?: () => void) => {
    setBusy(id);
    const res = await fn();
    setBusy(null);
    if (!res.ok) return toast("error", res.error ?? "Failed");
    after?.();
    toast("success", success);
  };

  const togglePublish = (p: Project) =>
    run(p.id, () => setProjectStatus(p.id, p.status === "published" ? "draft" : "published"), p.status === "published" ? "Unpublished." : "Published — now live.", () =>
      setProjects((list) => list.map((x) => (x.id === p.id ? { ...x, status: p.status === "published" ? "draft" : "published" } : x))),
    );

  const toggleFeatured = (p: Project) =>
    run(p.id, () => setProjectFeatured(p.id, !p.is_featured), p.is_featured ? "Removed from featured." : "Marked as featured.", () =>
      setProjects((list) => list.map((x) => (x.id === p.id ? { ...x, is_featured: !p.is_featured } : x))),
    );

  const duplicate = async (p: Project) => {
    setBusy(p.id);
    const res = await duplicateProject(p.id);
    setBusy(null);
    if (!res.ok) return toast("error", res.error);
    toast("success", "Duplicated as a draft.");
    router.push(`/admin/projects/${res.data.id}`);
  };

  const remove = async (p: Project) => {
    const title = translation(p, "en").title || translation(p, "ka").title || p.slug;
    const ok = await confirm({
      title: `Delete “${title}”?`,
      message: "The project, its photos, videos and 3D models will be permanently deleted. This cannot be undone.",
      confirmLabel: "Delete project",
      danger: true,
    });
    if (!ok) return;
    run(p.id, () => deleteProject(p.id), "Project deleted.", () => setProjects((list) => list.filter((x) => x.id !== p.id)));
  };

  const reorder = async (next: Project[]) => {
    setProjects(next);
    const res = await reorderProjects(next.map((p) => p.id));
    if (!res.ok) toast("error", res.error);
    else toast("success", "Portfolio order saved.");
  };

  return (
    <>
      <PageHeader
        title="Projects"
        description="Drag to set the order of the public portfolio. Published projects appear on the website immediately."
        actions={
          <Link href="/admin/projects/new" className="inline-flex h-10 items-center rounded-lg bg-[#161614] px-4 text-sm font-medium text-white hover:bg-[#2c2b28]">
            + Add new project
          </Link>
        }
      />

      <div className="mb-4 grid gap-3 rounded-xl border border-black/[0.08] bg-white p-3 sm:grid-cols-[1fr_11rem_13rem]">
        <TextInput aria-label="Search projects" placeholder="Search by title or slug…" value={q} onChange={(e) => setQ(e.target.value)} type="search" />
        <Select aria-label="Filter by status" value={status} onChange={(e) => setStatus(e.target.value as typeof status)}>
          <option value="all">All statuses</option>
          <option value="published">Published</option>
          <option value="draft">Drafts</option>
        </Select>
        <Select aria-label="Filter by category" value={category} onChange={(e) => setCategory(e.target.value)}>
          <option value="all">All categories</option>
          {categories.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name_en}
            </option>
          ))}
          <option value="none">No category</option>
        </Select>
      </div>

      {!canReorder && filtered.length > 1 && <p className="mb-3 text-[0.78rem] text-black/45">Clear search and filters to reorder by dragging.</p>}

      {filtered.length === 0 ? (
        <div className="rounded-xl border border-dashed border-black/15 bg-white px-6 py-16 text-center text-sm text-black/55">
          {projects.length === 0 ? (
            <>
              No projects yet.{" "}
              <Link href="/admin/projects/new" className="font-medium text-black underline">
                Add your first project
              </Link>
            </>
          ) : (
            "No projects match these filters."
          )}
        </div>
      ) : (
        <SortableList items={filtered} onReorder={canReorder ? reorder : () => {}} layout="list" className="space-y-2">
          {(p, handle) => {
            const tEn = translation(p, "en");
            const tKa = translation(p, "ka");
            const thumb = imageThumb(coverImage(p));
            const photos = p.images.length;
            const ready3d = p.models.filter((m) => m.display_status === "ready").length;
            return (
              <div className={`flex flex-col gap-3 rounded-xl border border-black/[0.08] bg-white p-3 md:flex-row md:items-center ${busy === p.id ? "opacity-60" : ""}`}>
                <div className="flex min-w-0 flex-1 items-center gap-3">
                  {canReorder ? <DragHandle handle={handle} /> : <span className="w-8" />}
                  <Link href={`/admin/projects/${p.id}`} className="h-14 w-20 shrink-0 overflow-hidden rounded-md bg-black/5">
                    {thumb && <img src={thumb} alt="" className="h-full w-full object-cover" />}
                  </Link>
                  <div className="min-w-0">
                    <Link href={`/admin/projects/${p.id}`} className="block truncate text-sm font-semibold hover:underline">
                      {tEn.title || tKa.title || "Untitled"}
                    </Link>
                    <p className="truncate text-[0.78rem] text-black/50" lang="ka">
                      {tKa.title}
                    </p>
                    <div className="mt-1 flex flex-wrap items-center gap-1.5 text-[0.72rem] text-black/50">
                      {p.status === "published" ? <Badge tone="success">Published</Badge> : <Badge tone="warning">Draft</Badge>}
                      {p.is_featured && <Badge tone="info">★ Featured</Badge>}
                      {p.is_demo && <Badge>Demo</Badge>}
                      <span>{p.category?.name_en ?? "No category"}</span>
                      <span>· {photos} photos</span>
                      {p.videos.length > 0 && <span>· {p.videos.length} videos</span>}
                      {ready3d > 0 && <span>· 3D</span>}
                    </div>
                  </div>
                </div>
                <div className="flex flex-wrap gap-1 md:justify-end">
                  <Button size="sm" variant={p.status === "published" ? "secondary" : "primary"} onClick={() => togglePublish(p)} disabled={busy === p.id}>
                    {p.status === "published" ? "Unpublish" : "Publish"}
                  </Button>
                  <Button size="sm" variant="ghost" onClick={() => toggleFeatured(p)} disabled={busy === p.id} title="Show on homepage">
                    {p.is_featured ? "★ Unfeature" : "☆ Feature"}
                  </Button>
                  <Link href={`/admin/projects/${p.id}`} className="inline-flex h-8 items-center rounded-lg px-3 text-[0.8rem] font-medium hover:bg-black/5">
                    Edit
                  </Link>
                  <a href={`/admin/preview/${p.id}`} target="_blank" rel="noopener noreferrer" className="inline-flex h-8 items-center rounded-lg px-3 text-[0.8rem] font-medium hover:bg-black/5">
                    Preview
                  </a>
                  <Button size="sm" variant="ghost" onClick={() => duplicate(p)} disabled={busy === p.id}>
                    Duplicate
                  </Button>
                  <Button size="sm" variant="ghost" className="text-[#a4442e]" onClick={() => remove(p)} disabled={busy === p.id}>
                    Delete
                  </Button>
                </div>
              </div>
            );
          }}
        </SortableList>
      )}
    </>
  );
}
