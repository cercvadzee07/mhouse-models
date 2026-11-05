"use client";

import { useState } from "react";
import { deleteInquiry, inquiryAttachmentUrl, setInquiryStatus } from "@/app/admin/actions/content";
import { Badge, Button, PageHeader, useConfirm, useToast } from "./ui";

export type Inquiry = {
  id: string;
  full_name: string;
  company: string | null;
  email: string;
  phone: string | null;
  project_type: string | null;
  message: string;
  attachment_path: string | null;
  attachment_name: string | null;
  locale: string;
  status: "new" | "read" | "archived";
  created_at: string;
};

export function InquiriesList({ initial }: { initial: Inquiry[] }) {
  const toast = useToast();
  const confirm = useConfirm();
  const [items, setItems] = useState(initial);
  const [filter, setFilter] = useState<"open" | "archived">("open");
  const [openId, setOpenId] = useState<string | null>(null);

  const setStatus = async (i: Inquiry, status: Inquiry["status"]) => {
    const res = await setInquiryStatus(i.id, status);
    if (!res.ok) return toast("error", res.error);
    setItems((list) => list.map((x) => (x.id === i.id ? { ...x, status } : x)));
  };

  const toggle = (i: Inquiry) => {
    setOpenId(openId === i.id ? null : i.id);
    if (i.status === "new") setStatus(i, "read");
  };

  const download = async (i: Inquiry) => {
    const res = await inquiryAttachmentUrl(i.id);
    if (!res.ok) return toast("error", res.error);
    window.open(res.data, "_blank", "noopener");
  };

  const remove = async (i: Inquiry) => {
    if (!(await confirm({ title: "Delete this inquiry?", message: "The message and any attached file will be permanently deleted.", confirmLabel: "Delete", danger: true }))) return;
    const res = await deleteInquiry(i.id);
    if (!res.ok) return toast("error", res.error);
    setItems((list) => list.filter((x) => x.id !== i.id));
  };

  const visible = items.filter((i) => (filter === "archived" ? i.status === "archived" : i.status !== "archived"));

  return (
    <>
      <PageHeader
        title="Inquiries"
        description="Messages sent through the website contact form."
        actions={
          <div className="flex rounded-lg border border-black/10 bg-white p-0.5 text-sm">
            {(["open", "archived"] as const).map((f) => (
              <button key={f} type="button" onClick={() => setFilter(f)} className={`rounded-md px-3 py-1.5 ${filter === f ? "bg-[#161614] text-white" : "text-black/60"}`}>
                {f === "open" ? "Inbox" : "Archived"}
              </button>
            ))}
          </div>
        }
      />
      {visible.length === 0 ? (
        <div className="rounded-xl border border-dashed border-black/15 bg-white px-6 py-16 text-center text-sm text-black/50">No inquiries here.</div>
      ) : (
        <ul className="space-y-2">
          {visible.map((i) => (
            <li key={i.id} className="overflow-hidden rounded-xl border border-black/[0.08] bg-white">
              <button type="button" onClick={() => toggle(i)} aria-expanded={openId === i.id} className="flex w-full items-center gap-3 px-4 py-3 text-left hover:bg-black/[0.02]">
                <span className={`h-2 w-2 shrink-0 rounded-full ${i.status === "new" ? "bg-[#e9b877]" : "bg-transparent"}`} />
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm font-semibold">
                    {i.full_name}
                    {i.company && <span className="font-normal text-black/55"> · {i.company}</span>}
                  </span>
                  <span className="block truncate text-[0.8rem] text-black/55">{i.message}</span>
                </span>
                <span className="hidden shrink-0 items-center gap-2 sm:flex">
                  {i.project_type && <Badge>{i.project_type}</Badge>}
                  {i.attachment_path && <Badge tone="info">📎 file</Badge>}
                  <span className="text-[0.75rem] text-black/45">{new Date(i.created_at).toLocaleString("en-GB", { dateStyle: "medium", timeStyle: "short" })}</span>
                </span>
              </button>
              {openId === i.id && (
                <div className="border-t border-black/[0.06] px-4 py-4">
                  <dl className="grid gap-x-6 gap-y-2 text-sm sm:grid-cols-2">
                    <div>
                      <dt className="text-[0.72rem] text-black/45">Email</dt>
                      <dd>
                        <a className="underline" href={`mailto:${i.email}`}>
                          {i.email}
                        </a>
                      </dd>
                    </div>
                    <div>
                      <dt className="text-[0.72rem] text-black/45">Phone</dt>
                      <dd>{i.phone ? <a className="underline" href={`tel:${i.phone}`}>{i.phone}</a> : "—"}</dd>
                    </div>
                    <div>
                      <dt className="text-[0.72rem] text-black/45">Project type</dt>
                      <dd>{i.project_type ?? "—"}</dd>
                    </div>
                    <div>
                      <dt className="text-[0.72rem] text-black/45">Site language</dt>
                      <dd>{i.locale === "ka" ? "Georgian" : "English"}</dd>
                    </div>
                  </dl>
                  <p className="mt-4 whitespace-pre-wrap rounded-lg bg-[#fbfaf8] p-4 text-sm leading-relaxed">{i.message}</p>
                  <div className="mt-4 flex flex-wrap gap-2">
                    <a href={`mailto:${i.email}?subject=${encodeURIComponent("Re: your project inquiry")}`} className="inline-flex h-8 items-center rounded-lg bg-[#161614] px-3 text-[0.8rem] font-medium text-white">
                      Reply by email
                    </a>
                    {i.attachment_path && (
                      <Button size="sm" onClick={() => download(i)}>
                        Download {i.attachment_name ?? "attachment"}
                      </Button>
                    )}
                    {i.status !== "archived" ? (
                      <Button size="sm" variant="ghost" onClick={() => setStatus(i, "archived")}>
                        Archive
                      </Button>
                    ) : (
                      <Button size="sm" variant="ghost" onClick={() => setStatus(i, "read")}>
                        Move to inbox
                      </Button>
                    )}
                    <Button size="sm" variant="ghost" className="text-[#a4442e]" onClick={() => remove(i)}>
                      Delete
                    </Button>
                  </div>
                </div>
              )}
            </li>
          ))}
        </ul>
      )}
    </>
  );
}
