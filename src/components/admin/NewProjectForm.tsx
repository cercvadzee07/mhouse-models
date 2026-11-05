"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import type { Category } from "@/lib/types";
import { createProject } from "@/app/admin/actions/projects";
import { Bilingual, Button, Card, Select, useToast } from "./ui";

export function NewProjectForm({ categories }: { categories: Category[] }) {
  const router = useRouter();
  const toast = useToast();
  const [title, setTitle] = useState({ ka: "", en: "" });
  const [category, setCategory] = useState<string>("");
  const [loading, setLoading] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    const res = await createProject({ title_ka: title.ka, title_en: title.en, category_id: category || null });
    if (!res.ok) {
      setLoading(false);
      return toast("error", res.error);
    }
    router.push(`/admin/projects/${res.data.id}?created=1`);
  };

  return (
    <form onSubmit={submit}>
      <Card>
        <div className="space-y-5">
          <Bilingual label="Project name" name="new-title" required maxLength={200} values={title} onChange={(l, v) => setTitle((t) => ({ ...t, [l]: v }))} />
          <Select label="Category" id="new-category" value={category} onChange={(e) => setCategory(e.target.value)}>
            <option value="">— Choose later —</option>
            {categories.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name_en} · {c.name_ka}
              </option>
            ))}
          </Select>
          <div className="flex justify-end">
            <Button type="submit" variant="primary" loading={loading} disabled={!title.ka.trim() && !title.en.trim()}>
              Create draft & continue →
            </Button>
          </div>
        </div>
      </Card>
      <p className="mt-3 text-[0.78rem] text-black/45">The project stays a private draft until you press Publish.</p>
    </form>
  );
}
