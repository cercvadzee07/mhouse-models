"use client";

import { AnimatePresence, motion } from "framer-motion";
import { useEffect, useRef, useState } from "react";
import type { Dictionary } from "@/i18n/get-dictionary";
import type { Locale } from "@/i18n/config";
import { createInquiryUpload, submitInquiry, type InquiryResult } from "@/app/actions/inquiry";
import { INQUIRY_MAX_FILE, PROJECT_TYPES, inquirySchema, validateAttachment } from "@/lib/validation/inquiry";
import { getBrowserClient } from "@/lib/supabase/browser";

type Status = "idle" | "sending" | "ok" | "error" | "not_configured" | "rate_limited";
type Labels = Dictionary["contact"];

export function ContactForm({ locale, t, configured }: { locale: Locale; t: Labels; configured: boolean }) {
  const [status, setStatus] = useState<Status>("idle");
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [file, setFile] = useState<File | null>(null);
  const [startedAt, setStartedAt] = useState(0);
  const formRef = useRef<HTMLFormElement>(null);
  const fileInput = useRef<HTMLInputElement>(null);
  const v = t.validation as Record<string, string>;

  useEffect(() => setStartedAt(Date.now()), []);

  const fieldError = (name: string) => (errors[name] ? v[errors[name]] ?? v.required : null);

  const onFile = (f: File | null) => {
    if (!f) {
      setFile(null);
      setErrors((e) => ({ ...e, attachment: "" }));
      return;
    }
    const problem = validateAttachment(f.name, f.size, f.type);
    if (problem) {
      setErrors((e) => ({ ...e, attachment: problem }));
      setFile(null);
      if (fileInput.current) fileInput.current.value = "";
      return;
    }
    setErrors((e) => ({ ...e, attachment: "" }));
    setFile(f);
  };

  const onSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    const raw: Record<string, string> = {};
    for (const key of ["fullName", "company", "email", "phone", "projectType", "message", "website"]) {
      raw[key] = String(fd.get(key) ?? "");
    }
    raw.locale = locale;
    raw.startedAt = String(startedAt);

    // Client-side validation (the server validates again).
    const check = inquirySchema.safeParse({ ...raw, attachmentPath: "", attachmentName: "" });
    if (!check.success) {
      const next: Record<string, string> = {};
      for (const issue of check.error.issues) next[String(issue.path[0])] ??= issue.message;
      setErrors(next);
      const first = Object.keys(next)[0];
      formRef.current?.querySelector<HTMLElement>(`[name="${first}"]`)?.focus();
      return;
    }
    setErrors({});

    if (!configured) {
      setStatus("not_configured");
      return;
    }

    setStatus("sending");
    try {
      if (file) {
        const upload = await createInquiryUpload({ name: file.name, size: file.size, type: file.type });
        if (upload.status === "rate_limited") return setStatus("rate_limited");
        if (upload.status === "not_configured") return setStatus("not_configured");
        if (upload.status === "invalid") {
          setErrors({ attachment: upload.code });
          return setStatus("idle");
        }
        if (upload.status !== "ok") return setStatus("error");
        const { error } = await getBrowserClient().storage.from("inquiries").uploadToSignedUrl(upload.path, upload.token, file, {
          contentType: file.type || "application/octet-stream",
        });
        if (error) return setStatus("error");
        raw.attachmentPath = upload.path;
        raw.attachmentName = file.name;
      }
      const result: InquiryResult = await submitInquiry(raw);
      if (result.status === "ok") {
        setStatus("ok");
        formRef.current?.reset();
        setFile(null);
      } else if (result.status === "invalid") {
        setErrors(result.fields);
        setStatus("idle");
      } else {
        setStatus(result.status);
      }
    } catch {
      setStatus("error");
    }
  };

  const input = (name: string, label: string, opts: { type?: string; required?: boolean; autoComplete?: string; inputMode?: "email" | "tel" } = {}) => (
    <div>
      <label htmlFor={`f-${name}`} className="flex items-baseline justify-between text-sm text-graphite">
        <span>
          {label}
          {opts.required && <span aria-hidden className="text-brass"> *</span>}
        </span>
        {!opts.required && <span className="text-xs text-concrete">{t.form.optional}</span>}
      </label>
      <input
        id={`f-${name}`}
        name={name}
        type={opts.type ?? "text"}
        required={opts.required}
        autoComplete={opts.autoComplete}
        inputMode={opts.inputMode}
        aria-invalid={!!fieldError(name)}
        aria-describedby={fieldError(name) ? `e-${name}` : undefined}
        className="field"
      />
      {fieldError(name) && (
        <p id={`e-${name}`} className="mt-2 text-xs text-danger">
          {fieldError(name)}
        </p>
      )}
    </div>
  );

  const message =
    status === "ok"
      ? { tone: "ok", text: t.form.success }
      : status === "error"
        ? { tone: "err", text: t.form.error }
        : status === "not_configured"
          ? { tone: "err", text: t.form.notConfigured }
          : status === "rate_limited"
            ? { tone: "err", text: t.form.rateLimited }
            : null;

  return (
    <form ref={formRef} onSubmit={onSubmit} noValidate className="space-y-8">
      <div className="grid gap-8 sm:grid-cols-2">
        {input("fullName", t.form.fullName, { required: true, autoComplete: "name" })}
        {input("company", t.form.company, { autoComplete: "organization" })}
        {input("email", t.form.email, { type: "email", required: true, autoComplete: "email", inputMode: "email" })}
        {input("phone", t.form.phone, { type: "tel", autoComplete: "tel", inputMode: "tel" })}
      </div>

      <div>
        <label htmlFor="f-projectType" className="flex items-baseline justify-between text-sm text-graphite">
          {t.form.projectType}
          <span className="text-xs text-concrete">{t.form.optional}</span>
        </label>
        <select id="f-projectType" name="projectType" defaultValue="" className="field cursor-pointer appearance-none">
          <option value="">{t.form.projectTypePlaceholder}</option>
          {PROJECT_TYPES.map((p) => (
            <option key={p} value={p}>
              {t.form.projectTypes[p]}
            </option>
          ))}
        </select>
      </div>

      <div>
        <label htmlFor="f-message" className="text-sm text-graphite">
          {t.form.description}
          <span aria-hidden className="text-brass"> *</span>
        </label>
        <textarea
          id="f-message"
          name="message"
          rows={5}
          required
          placeholder={t.form.descriptionPlaceholder}
          aria-invalid={!!fieldError("message")}
          aria-describedby={fieldError("message") ? "e-message" : undefined}
          className="field resize-y"
        />
        {fieldError("message") && (
          <p id="e-message" className="mt-2 text-xs text-danger">
            {fieldError("message")}
          </p>
        )}
      </div>

      {/* Honeypot (hidden from people and assistive tech) */}
      <div aria-hidden className="absolute -left-[9999px] h-0 w-0 overflow-hidden">
        <label>
          Website
          <input type="text" name="website" tabIndex={-1} autoComplete="off" />
        </label>
      </div>

      <div>
        <span className="text-sm text-graphite">{t.form.attachment}</span>
        <label
          htmlFor="f-attachment"
          onDragOver={(e) => e.preventDefault()}
          onDrop={(e) => {
            e.preventDefault();
            onFile(e.dataTransfer.files?.[0] ?? null);
          }}
          className="mt-3 flex cursor-pointer items-center justify-between gap-4 border border-dashed border-ink/25 px-5 py-4 transition-colors hover:border-ink/60"
        >
          <span className="truncate text-sm">{file ? file.name : t.form.attachmentHint}</span>
          <span className="shrink-0 font-mono text-xs text-graphite">
            {file ? `${(file.size / 1024 / 1024).toFixed(1)} MB` : `≤ ${INQUIRY_MAX_FILE / 1024 / 1024} MB`}
          </span>
        </label>
        <input
          ref={fileInput}
          id="f-attachment"
          type="file"
          className="sr-only"
          accept=".pdf,.jpg,.jpeg,.png,.webp,.docx,.doc,.zip"
          onChange={(e) => onFile(e.target.files?.[0] ?? null)}
        />
        {file && (
          <button
            type="button"
            className="mt-2 text-xs text-graphite underline underline-offset-4"
            onClick={() => {
              onFile(null);
              if (fileInput.current) fileInput.current.value = "";
            }}
          >
            {t.form.attachmentRemove}
          </button>
        )}
        {fieldError("attachment") && <p className="mt-2 text-xs text-danger">{fieldError("attachment")}</p>}
      </div>

      <div className="flex flex-col gap-6 pt-2 sm:flex-row sm:items-center sm:justify-between">
        <p className="max-w-sm text-xs leading-relaxed text-concrete">{t.form.privacy}</p>
        <button type="submit" disabled={status === "sending"} className="btn btn-solid group min-w-56 disabled:opacity-60">
          {status === "sending" ? t.form.submitting : t.form.submit}
          {status !== "sending" && (
            <span aria-hidden className="transition-transform duration-500 group-hover:translate-x-1">→</span>
          )}
        </button>
      </div>

      <div aria-live="polite" role="status">
        <AnimatePresence>
          {message && (
            <motion.p
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              className={`border-l-2 py-2 pl-4 text-sm ${message.tone === "ok" ? "border-success text-success" : "border-danger text-danger"}`}
            >
              {message.text}
            </motion.p>
          )}
        </AnimatePresence>
      </div>
    </form>
  );
}
