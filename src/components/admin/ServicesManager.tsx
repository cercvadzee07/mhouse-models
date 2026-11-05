"use client";

/* eslint-disable @next/next/no-img-element */
import { useState } from "react";
import type { Service } from "@/lib/types";
import { mediaUrl } from "@/lib/storage";
import { deleteService, reorderServices, saveService } from "@/app/admin/actions/content";
import { Badge, Bilingual, Button, Card, PageHeader, Toggle, useConfirm, useToast } from "./ui";
import { DragHandle, SortableList } from "./Sortable";
import { SiteImageField } from "./SiteImageField";

type Draft = Pick<Service, "title_ka" | "title_en" | "description_ka" | "description_en" | "image_path" | "is_visible">;
const empty: Draft = { title_ka: "", title_en: "", description_ka: "", description_en: "", image_path: null, is_visible: true };

export function ServicesManager({ initial }: { initial: Service[] }) {
  const toast = useToast();
  const confirm = useConfirm();
  const [services, setServices] = useState(initial);
  const [editing, setEditing] = useState<string | "new" | null>(null);
  const [draft, setDraft] = useState<Draft>(empty);
  const [saving, setSaving] = useState(false);

  const open = (s: Service | null) => {
    setEditing(s ? s.id : "new");
    setDraft(s ? { title_ka: s.title_ka, title_en: s.title_en, description_ka: s.description_ka, description_en: s.description_en, image_path: s.image_path, is_visible: s.is_visible } : empty);
  };

  const save = async () => {
    setSaving(true);
    const id = editing === "new" ? null : editing;
    const res = await saveService(id, draft);
    setSaving(false);
    if (!res.ok) return toast("error", res.error);
    if (id) setServices((list) => list.map((s) => (s.id === id ? { ...s, ...draft, image_external_url: draft.image_path ? null : s.image_external_url } : s)));
    else
      setServices((list) => [...list, { ...draft, id: res.data.id, slug: "", image_external_url: null, sort_order: list.length + 1 }]);
    setEditing(null);
    toast("success", "Service saved — the website is updated.");
  };

  const remove = async (s: Service) => {
    if (!(await confirm({ title: `Delete “${s.title_en}”?`, confirmLabel: "Delete", danger: true }))) return;
    const res = await deleteService(s.id);
    if (!res.ok) return toast("error", res.error);
    setServices((list) => list.filter((x) => x.id !== s.id));
  };

  const reorder = async (next: Service[]) => {
    setServices(next);
    const res = await reorderServices(next.map((s) => s.id));
    if (!res.ok) toast("error", res.error);
  };

  const current = editing && editing !== "new" ? services.find((s) => s.id === editing) : null;

  const form = (
    <Card title={editing === "new" ? "New service" : "Edit service"}>
      <div className="space-y-5">
        <Bilingual label="Title" name="svc-title" required maxLength={160} values={{ ka: draft.title_ka, en: draft.title_en }} onChange={(l, v) => setDraft((d) => ({ ...d, [`title_${l}`]: v }))} />
        <Bilingual label="Description" name="svc-desc" multiline rows={3} maxLength={1200} values={{ ka: draft.description_ka, en: draft.description_en }} onChange={(l, v) => setDraft((d) => ({ ...d, [`description_${l}`]: v }))} />
        <SiteImageField label="Representative image" purpose="service" value={draft.image_path} fallbackUrl={current?.image_external_url} onChange={(p) => setDraft((d) => ({ ...d, image_path: p }))} />
        <Toggle checked={draft.is_visible} onChange={(v) => setDraft((d) => ({ ...d, is_visible: v }))} label="Visible on the website" />
        <div className="flex justify-end gap-2">
          <Button onClick={() => setEditing(null)}>Cancel</Button>
          <Button variant="primary" onClick={save} loading={saving}>
            Save service
          </Button>
        </div>
      </div>
    </Card>
  );

  return (
    <>
      <PageHeader title="Services" description="Shown in the Services section of the homepage, in this order." actions={<Button variant="primary" onClick={() => open(null)}>+ Add service</Button>} />
      {editing === "new" && <div className="mb-4">{form}</div>}
      <SortableList items={services} onReorder={reorder} layout="list" className="space-y-2">
        {(s, handle) =>
          editing === s.id ? (
            form
          ) : (
            <div className="flex items-center gap-3 rounded-xl border border-black/[0.08] bg-white p-3">
              <DragHandle handle={handle} />
              <div className="h-14 w-20 shrink-0 overflow-hidden rounded-md bg-black/5">
                {(mediaUrl(s.image_path) ?? s.image_external_url) && <img src={(mediaUrl(s.image_path) ?? s.image_external_url)!} alt="" className="h-full w-full object-cover" />}
              </div>
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-semibold">{s.title_en}</p>
                <p className="truncate text-[0.8rem] text-black/55" lang="ka">
                  {s.title_ka}
                </p>
              </div>
              {!s.is_visible && <Badge>Hidden</Badge>}
              <Button size="sm" variant="ghost" onClick={() => open(s)}>
                Edit
              </Button>
              <Button size="sm" variant="ghost" className="text-[#a4442e]" onClick={() => remove(s)}>
                Delete
              </Button>
            </div>
          )
        }
      </SortableList>
    </>
  );
}
