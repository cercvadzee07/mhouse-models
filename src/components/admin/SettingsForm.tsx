"use client";

import { useState } from "react";
import type { Category, GeneralSettings } from "@/lib/types";
import { deleteCategory, removeDemoContent, reorderCategories, saveCategory, saveGeneral } from "@/app/admin/actions/content";
import { getBrowserClient } from "@/lib/supabase/browser";
import { Bilingual, Button, Card, PageHeader, TextInput, Toggle, useConfirm, useToast } from "./ui";
import { DragHandle, SortableList } from "./Sortable";

export function SettingsForm({ initial, categories: initialCats, demoCount: initialDemo, email }: { initial: GeneralSettings; categories: Category[]; demoCount: number; email: string }) {
  const toast = useToast();
  const confirm = useConfirm();
  const [general, setGeneral] = useState(initial);
  const [savingGeneral, setSavingGeneral] = useState(false);
  const [cats, setCats] = useState(initialCats);
  const [catDraft, setCatDraft] = useState<{ id: string | null; name_ka: string; name_en: string; slug: string } | null>(null);
  const [demoCount, setDemoCount] = useState(initialDemo);
  const [pw, setPw] = useState({ a: "", b: "" });
  const [pwBusy, setPwBusy] = useState(false);

  const saveG = async () => {
    setSavingGeneral(true);
    const res = await saveGeneral(general);
    setSavingGeneral(false);
    if (!res.ok) return toast("error", res.error);
    toast("success", "Settings saved.");
  };

  const saveCat = async () => {
    if (!catDraft) return;
    const res = await saveCategory(catDraft.id, { name_ka: catDraft.name_ka, name_en: catDraft.name_en, slug: catDraft.slug || undefined });
    if (!res.ok) return toast("error", res.error);
    toast("success", "Category saved.");
    window.location.reload();
  };

  const removeCat = async (c: Category) => {
    if (!(await confirm({ title: `Delete category “${c.name_en}”?`, message: "Projects in this category are kept and become uncategorized.", confirmLabel: "Delete", danger: true }))) return;
    const res = await deleteCategory(c.id);
    if (!res.ok) return toast("error", res.error);
    setCats((list) => list.filter((x) => x.id !== c.id));
  };

  const reorderCats = async (next: Category[]) => {
    setCats(next);
    const res = await reorderCategories(next.map((c) => c.id));
    if (!res.ok) toast("error", res.error);
  };

  const removeDemo = async () => {
    if (
      !(await confirm({
        title: `Remove ${demoCount} demonstration projects?`,
        message: "All projects marked as demonstration content (with their images) will be deleted, and demo service images cleared. Your own projects are not affected.",
        confirmLabel: "Remove demo content",
        danger: true,
      }))
    )
      return;
    const res = await removeDemoContent();
    if (!res.ok) return toast("error", res.error);
    setDemoCount(0);
    toast("success", `Removed ${res.data.removed} demonstration projects.`);
  };

  const changePassword = async () => {
    if (pw.a.length < 10) return toast("error", "Use at least 10 characters.");
    if (pw.a !== pw.b) return toast("error", "The passwords do not match.");
    setPwBusy(true);
    const { error } = await getBrowserClient().auth.updateUser({ password: pw.a });
    setPwBusy(false);
    if (error) return toast("error", error.message);
    setPw({ a: "", b: "" });
    toast("success", "Password changed.");
  };

  return (
    <>
      <PageHeader title="General settings" />
      <div className="space-y-6">
        <Card title="Studio name & wordmark" description="The name is a placeholder — change it any time. It appears in the logo, footer, page titles and emails." actions={<Button variant="primary" onClick={saveG} loading={savingGeneral}>Save</Button>}>
          <div className="grid gap-4 sm:grid-cols-3">
            <TextInput label="Full studio name" id="g-name" maxLength={80} value={general.studio_name} onChange={(e) => setGeneral((g) => ({ ...g, studio_name: e.target.value }))} />
            <TextInput label="Wordmark (logo text)" id="g-short" maxLength={40} value={general.studio_name_short} onChange={(e) => setGeneral((g) => ({ ...g, studio_name_short: e.target.value }))} />
            <TextInput label="Wordmark suffix" id="g-suffix" maxLength={40} value={general.wordmark_suffix} onChange={(e) => setGeneral((g) => ({ ...g, wordmark_suffix: e.target.value }))} hint="small caps after the logo" />
          </div>
          <div className="mt-5">
            <Toggle checked={general.show_demo_badges} onChange={(v) => setGeneral((g) => ({ ...g, show_demo_badges: v }))} label="Label demonstration projects on the website" description="Keep this on while demo content is published, so visitors know it is not commissioned work." />
          </div>
        </Card>

        <Card
          title="Portfolio categories"
          description="Used for the portfolio filters. Drag to reorder."
          actions={<Button size="sm" onClick={() => setCatDraft({ id: null, name_ka: "", name_en: "", slug: "" })}>+ Add category</Button>}
        >
          {catDraft && (
            <div className="mb-4 rounded-lg border border-black/10 bg-[#fbfaf8] p-4">
              <Bilingual label="Category name" name="cat" required maxLength={80} values={{ ka: catDraft.name_ka, en: catDraft.name_en }} onChange={(l, v) => setCatDraft((d) => d && { ...d, [`name_${l}`]: v })} />
              <div className="mt-3 grid gap-3 sm:grid-cols-[1fr_auto]">
                <TextInput label="URL key (optional)" id="cat-slug" placeholder="e.g. residential" value={catDraft.slug} onChange={(e) => setCatDraft((d) => d && { ...d, slug: e.target.value.toLowerCase() })} />
                <div className="flex items-end gap-2">
                  <Button onClick={() => setCatDraft(null)}>Cancel</Button>
                  <Button variant="primary" onClick={saveCat}>
                    Save category
                  </Button>
                </div>
              </div>
            </div>
          )}
          <SortableList items={cats} onReorder={reorderCats} layout="list" className="space-y-1.5">
            {(c, handle) => (
              <div className="flex items-center gap-2 rounded-lg border border-black/[0.08] bg-white px-2 py-1.5">
                <DragHandle handle={handle} />
                <span className="flex-1 text-sm">
                  {c.name_en} <span className="text-black/45">· {c.name_ka}</span>
                </span>
                <span className="hidden font-mono text-[0.72rem] text-black/40 sm:block">?category={c.slug}</span>
                <Button size="sm" variant="ghost" onClick={() => setCatDraft({ id: c.id, name_ka: c.name_ka, name_en: c.name_en, slug: c.slug })}>
                  Edit
                </Button>
                <Button size="sm" variant="ghost" className="text-[#a4442e]" onClick={() => removeCat(c)}>
                  Delete
                </Button>
              </div>
            )}
          </SortableList>
        </Card>

        <Card title="Demonstration content" description="The site was installed with clearly labelled sample projects so it looks complete before your own work is uploaded.">
          {demoCount > 0 ? (
            <div className="flex flex-wrap items-center justify-between gap-3">
              <p className="text-sm text-black/70">{demoCount} demonstration projects are in the database.</p>
              <Button variant="danger" onClick={removeDemo}>
                Remove all demo content
              </Button>
            </div>
          ) : (
            <p className="text-sm text-black/55">No demonstration projects remain.</p>
          )}
        </Card>

        <Card title="Your account" description={`Signed in as ${email}`}>
          <div className="grid gap-3 sm:grid-cols-[1fr_1fr_auto]">
            <TextInput label="New password" id="pw-a" type="password" autoComplete="new-password" value={pw.a} onChange={(e) => setPw((p) => ({ ...p, a: e.target.value }))} />
            <TextInput label="Repeat new password" id="pw-b" type="password" autoComplete="new-password" value={pw.b} onChange={(e) => setPw((p) => ({ ...p, b: e.target.value }))} />
            <div className="flex items-end">
              <Button onClick={changePassword} loading={pwBusy} disabled={!pw.a}>
                Change password
              </Button>
            </div>
          </div>
        </Card>
      </div>
    </>
  );
}
