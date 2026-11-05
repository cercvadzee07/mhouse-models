/* eslint-disable @next/next/no-img-element */
import type { Metadata } from "next";
import Link from "next/link";
import { requireAdminPage } from "@/lib/auth";
import { imageThumb } from "@/lib/storage";
import { coverImage, sortProject, translation, PROJECT_SELECT } from "@/lib/data/project-helpers";
import type { Project } from "@/lib/types";
import { Badge, Card, PageHeader } from "@/components/admin/ui";

export const metadata: Metadata = { title: "Overview" };

function timeAgo(iso: string) {
  const s = (Date.now() - new Date(iso).getTime()) / 1000;
  if (s < 60) return "just now";
  if (s < 3600) return `${Math.floor(s / 60)} min ago`;
  if (s < 86400) return `${Math.floor(s / 3600)} h ago`;
  return new Date(iso).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });
}

export default async function OverviewPage() {
  const { supabase } = await requireAdminPage();
  const count = (table: string, filter?: [string, string]) => {
    let q = supabase.from(table).select("id", { count: "exact", head: true });
    if (filter) q = q.eq(filter[0], filter[1]);
    return q;
  };
  const [total, published, drafts, photos, models, videos, inquiries, recent, activity] = await Promise.all([
    count("projects"),
    count("projects", ["status", "published"]),
    count("projects", ["status", "draft"]),
    count("project_images"),
    count("project_models"),
    count("project_videos"),
    count("inquiries", ["status", "new"]),
    supabase.from("projects").select(PROJECT_SELECT).order("created_at", { ascending: false }).limit(5),
    supabase.from("activity_logs").select("*").order("created_at", { ascending: false }).limit(12),
  ]);

  const stats = [
    { label: "Total projects", value: total.count ?? 0, href: "/admin/projects" },
    { label: "Published", value: published.count ?? 0, href: "/admin/projects?status=published" },
    { label: "Drafts", value: drafts.count ?? 0, href: "/admin/projects?status=draft" },
    { label: "Photographs", value: photos.count ?? 0 },
    { label: "3D models", value: models.count ?? 0 },
    { label: "Videos", value: videos.count ?? 0 },
  ];
  const projects = ((recent.data ?? []) as Project[]).map(sortProject);

  return (
    <>
      <PageHeader
        title="Overview"
        description="A summary of your portfolio and recent changes."
        actions={
          <Link href="/admin/projects/new" className="inline-flex h-10 items-center gap-2 rounded-lg bg-[#161614] px-4 text-sm font-medium text-white hover:bg-[#2c2b28]">
            + Add new project
          </Link>
        }
      />

      <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-6">
        {stats.map((s) => {
          const body = (
            <>
              <p className="text-[0.75rem] text-black/50">{s.label}</p>
              <p className="mt-1 text-2xl font-semibold tabular-nums">{s.value}</p>
            </>
          );
          return s.href ? (
            <Link key={s.label} href={s.href} className="rounded-xl border border-black/[0.08] bg-white p-4 transition-colors hover:border-black/25">
              {body}
            </Link>
          ) : (
            <div key={s.label} className="rounded-xl border border-black/[0.08] bg-white p-4">
              {body}
            </div>
          );
        })}
      </div>

      {(inquiries.count ?? 0) > 0 && (
        <Link href="/admin/inquiries" className="mt-4 flex items-center justify-between rounded-xl border border-[#e9b877]/60 bg-[#fdf6ea] px-4 py-3 text-sm">
          <span>
            <strong>{inquiries.count}</strong> new project {inquiries.count === 1 ? "inquiry" : "inquiries"} waiting for a reply.
          </span>
          <span aria-hidden>→</span>
        </Link>
      )}

      <div className="mt-6 grid gap-6 xl:grid-cols-[1.3fr_1fr]">
        <Card title="Recently added projects" actions={<Link href="/admin/projects" className="text-[0.8rem] text-black/55 hover:text-black">All projects →</Link>}>
          {projects.length === 0 ? (
            <p className="text-sm text-black/50">
              No projects yet. <Link href="/admin/projects/new" className="underline">Add the first one</Link>.
            </p>
          ) : (
            <ul className="divide-y divide-black/[0.06]">
              {projects.map((p) => {
                const t = translation(p, "en");
                const thumb = imageThumb(coverImage(p));
                return (
                  <li key={p.id}>
                    <Link href={`/admin/projects/${p.id}`} className="-mx-2 flex items-center gap-3 rounded-lg px-2 py-2.5 hover:bg-black/[0.03]">
                      <span className="h-11 w-14 shrink-0 overflow-hidden rounded-md bg-black/5">{thumb && <img src={thumb} alt="" className="h-full w-full object-cover" />}</span>
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-sm font-medium">{t.title || translation(p, "ka").title || "Untitled"}</span>
                        <span className="block text-[0.75rem] text-black/50">{p.category?.name_en ?? "No category"} · {timeAgo(p.created_at)}</span>
                      </span>
                      {p.status === "published" ? <Badge tone="success">Published</Badge> : <Badge tone="warning">Draft</Badge>}
                    </Link>
                  </li>
                );
              })}
            </ul>
          )}
        </Card>

        <Card title="Recent activity">
          {(activity.data ?? []).length === 0 ? (
            <p className="text-sm text-black/50">No activity yet.</p>
          ) : (
            <ol className="space-y-3">
              {(activity.data ?? []).map((a) => (
                <li key={a.id} className="flex gap-3 text-[0.82rem]">
                  <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-black/30" />
                  <span className="min-w-0">
                    <span className="block text-black/80">{a.summary || `${a.action} ${a.entity_type}`}</span>
                    <span className="block text-[0.72rem] text-black/45">
                      {timeAgo(a.created_at)} · {a.actor_email}
                    </span>
                  </span>
                </li>
              ))}
            </ol>
          )}
        </Card>
      </div>
    </>
  );
}
