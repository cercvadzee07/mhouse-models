"use client";

import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";

// ---------------------------------------------------------------------------
// Buttons
// ---------------------------------------------------------------------------
type Variant = "primary" | "secondary" | "ghost" | "danger";
const variants: Record<Variant, string> = {
  primary: "bg-[#161614] text-white hover:bg-[#2c2b28] disabled:bg-[#161614]/50",
  secondary: "border border-black/15 bg-white text-[#1b1b19] hover:border-black/35 disabled:opacity-50",
  ghost: "text-[#1b1b19] hover:bg-black/5 disabled:opacity-40",
  danger: "border border-[#a4442e]/30 bg-white text-[#a4442e] hover:bg-[#a4442e] hover:text-white disabled:opacity-50",
};

export function Button({
  variant = "secondary",
  size = "md",
  loading,
  children,
  className = "",
  ...rest
}: React.ComponentProps<"button"> & { variant?: Variant; size?: "sm" | "md"; loading?: boolean }) {
  return (
    <button
      type="button"
      {...rest}
      disabled={rest.disabled || loading}
      className={`inline-flex items-center justify-center gap-2 rounded-lg font-medium transition-colors disabled:cursor-not-allowed ${
        size === "sm" ? "h-8 px-3 text-[0.8rem]" : "h-10 px-4 text-sm"
      } ${variants[variant]} ${className}`}
    >
      {loading && <Spinner />}
      {children}
    </button>
  );
}

export function Spinner({ className = "h-3.5 w-3.5" }: { className?: string }) {
  return <span aria-hidden className={`inline-block animate-spin rounded-full border-2 border-current border-r-transparent ${className}`} />;
}

// ---------------------------------------------------------------------------
// Layout
// ---------------------------------------------------------------------------
export function Card({ title, description, actions, children, className = "" }: { title?: ReactNode; description?: ReactNode; actions?: ReactNode; children: ReactNode; className?: string }) {
  return (
    <section className={`rounded-xl border border-black/[0.08] bg-white ${className}`}>
      {(title || actions) && (
        <header className="flex flex-wrap items-start justify-between gap-3 border-b border-black/[0.06] px-5 py-4">
          <div>
            {title && <h2 className="text-[0.95rem] font-semibold">{title}</h2>}
            {description && <p className="mt-1 text-[0.82rem] text-black/55">{description}</p>}
          </div>
          {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
        </header>
      )}
      <div className="p-5">{children}</div>
    </section>
  );
}

export function PageHeader({ title, description, actions }: { title: string; description?: ReactNode; actions?: ReactNode }) {
  return (
    <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
      <div>
        <h1 className="text-[1.45rem] font-semibold tracking-[-0.01em]">{title}</h1>
        {description && <p className="mt-1 max-w-2xl text-sm text-black/55">{description}</p>}
      </div>
      {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
    </div>
  );
}

export function Badge({ tone = "neutral", children }: { tone?: "neutral" | "success" | "warning" | "danger" | "info"; children: ReactNode }) {
  const tones = {
    neutral: "bg-black/[0.06] text-black/70",
    success: "bg-[#4f6b4a]/12 text-[#3d5638]",
    warning: "bg-[#e9b877]/30 text-[#7a5520]",
    danger: "bg-[#a4442e]/10 text-[#a4442e]",
    info: "bg-[#3d5a80]/10 text-[#2e4a6e]",
  };
  return <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[0.7rem] font-medium ${tones[tone]}`}>{children}</span>;
}

// ---------------------------------------------------------------------------
// Form fields
// ---------------------------------------------------------------------------
const inputCls =
  "w-full rounded-lg border border-black/15 bg-white px-3 py-2 text-sm text-[#1b1b19] placeholder:text-black/35 focus:border-black/50 focus:outline-none focus:ring-2 focus:ring-black/5 disabled:bg-black/[0.03]";

export function Label({ htmlFor, children, hint, required }: { htmlFor?: string; children: ReactNode; hint?: ReactNode; required?: boolean }) {
  return (
    <label htmlFor={htmlFor} className="mb-1.5 flex items-baseline justify-between gap-3 text-[0.8rem] font-medium text-black/75">
      <span>
        {children}
        {required && <span className="text-[#a4442e]"> *</span>}
      </span>
      {hint && <span className="text-[0.72rem] font-normal text-black/45">{hint}</span>}
    </label>
  );
}

export function TextInput({ label, hint, required, id, maxLength, value, ...rest }: React.InputHTMLAttributes<HTMLInputElement> & { label?: ReactNode; hint?: ReactNode }) {
  const counter = maxLength && typeof value === "string" ? `${value.length}/${maxLength}` : undefined;
  return (
    <div>
      {label && (
        <Label htmlFor={id} hint={hint ?? counter} required={required}>
          {label}
        </Label>
      )}
      <input id={id} value={value} maxLength={maxLength} required={required} {...rest} className={`${inputCls} ${rest.className ?? ""}`} />
    </div>
  );
}

export function TextArea({ label, hint, required, id, maxLength, value, rows = 4, ...rest }: React.TextareaHTMLAttributes<HTMLTextAreaElement> & { label?: ReactNode; hint?: ReactNode }) {
  const counter = maxLength && typeof value === "string" ? `${value.length}/${maxLength}` : undefined;
  return (
    <div>
      {label && (
        <Label htmlFor={id} hint={hint ?? counter} required={required}>
          {label}
        </Label>
      )}
      <textarea id={id} value={value} maxLength={maxLength} rows={rows} required={required} {...rest} className={`${inputCls} resize-y leading-relaxed ${rest.className ?? ""}`} />
    </div>
  );
}

export function Select({ label, id, children, hint, ...rest }: React.SelectHTMLAttributes<HTMLSelectElement> & { label?: ReactNode; hint?: ReactNode }) {
  return (
    <div>
      {label && (
        <Label htmlFor={id} hint={hint}>
          {label}
        </Label>
      )}
      <select id={id} {...rest} className={`${inputCls} cursor-pointer ${rest.className ?? ""}`}>
        {children}
      </select>
    </div>
  );
}

export function Toggle({ checked, onChange, label, description, id }: { checked: boolean; onChange: (v: boolean) => void; label: ReactNode; description?: ReactNode; id?: string }) {
  return (
    <label htmlFor={id} className="flex cursor-pointer items-start gap-3">
      <button
        id={id}
        type="button"
        role="switch"
        aria-checked={checked}
        onClick={() => onChange(!checked)}
        className={`relative mt-0.5 h-5 w-9 shrink-0 rounded-full transition-colors ${checked ? "bg-[#161614]" : "bg-black/20"}`}
      >
        <span className={`absolute top-0.5 h-4 w-4 rounded-full bg-white shadow transition-transform ${checked ? "translate-x-[1.1rem]" : "translate-x-0.5"}`} />
      </button>
      <span>
        <span className="block text-sm font-medium">{label}</span>
        {description && <span className="mt-0.5 block text-[0.8rem] text-black/55">{description}</span>}
      </span>
    </label>
  );
}

/** Georgian + English side by side (stacked on small screens). */
export function Bilingual({
  label,
  name,
  values,
  onChange,
  multiline,
  rows,
  maxLength,
  required,
  placeholder,
}: {
  label: string;
  name: string;
  values: { ka: string; en: string };
  onChange: (lang: "ka" | "en", value: string) => void;
  multiline?: boolean;
  rows?: number;
  maxLength?: number;
  required?: boolean;
  placeholder?: { ka?: string; en?: string };
}) {
  return (
    <fieldset>
      <legend className="mb-2 text-[0.8rem] font-semibold text-black/80">
        {label}
        {required && <span className="text-[#a4442e]"> *</span>}
      </legend>
      <div className="grid gap-3 lg:grid-cols-2">
        {(["ka", "en"] as const).map((lang) => {
          const common = {
            id: `${name}-${lang}`,
            value: values[lang],
            maxLength,
            placeholder: placeholder?.[lang],
            lang: lang === "ka" ? "ka" : "en",
            label: (
              <span className="inline-flex items-center gap-2">
                <span className="rounded bg-black/[0.06] px-1.5 py-0.5 font-mono text-[0.65rem]">{lang === "ka" ? "GE" : "EN"}</span>
                <span className="font-normal text-black/55">{lang === "ka" ? "ქართული" : "English"}</span>
              </span>
            ),
          };
          return multiline ? (
            <TextArea key={lang} {...common} rows={rows} onChange={(e) => onChange(lang, e.target.value)} />
          ) : (
            <TextInput key={lang} {...common} onChange={(e) => onChange(lang, e.target.value)} />
          );
        })}
      </div>
    </fieldset>
  );
}

// ---------------------------------------------------------------------------
// Toasts
// ---------------------------------------------------------------------------
type Toast = { id: number; tone: "success" | "error" | "info"; message: string };
const ToastCtx = createContext<(tone: Toast["tone"], message: string) => void>(() => {});

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const idRef = useRef(0);
  const push = useCallback((tone: Toast["tone"], message: string) => {
    const id = ++idRef.current;
    setToasts((t) => [...t, { id, tone, message }]);
    setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), tone === "error" ? 9000 : 4000);
  }, []);
  return (
    <ToastCtx.Provider value={push}>
      {children}
      <div aria-live="polite" className="pointer-events-none fixed bottom-4 right-4 z-[100] flex w-[min(24rem,calc(100vw-2rem))] flex-col gap-2">
        {toasts.map((t) => (
          <div
            key={t.id}
            role={t.tone === "error" ? "alert" : "status"}
            className={`pointer-events-auto rounded-lg border px-4 py-3 text-sm shadow-lg ${
              t.tone === "error" ? "border-[#a4442e]/30 bg-[#fff6f3] text-[#7d2f1d]" : t.tone === "success" ? "border-[#4f6b4a]/30 bg-[#f4f8f2] text-[#2f4a2a]" : "border-black/10 bg-white"
            }`}
          >
            {t.message}
          </div>
        ))}
      </div>
    </ToastCtx.Provider>
  );
}

export const useToast = () => useContext(ToastCtx);

// ---------------------------------------------------------------------------
// Confirm dialog
// ---------------------------------------------------------------------------
type ConfirmOptions = { title: string; message?: ReactNode; confirmLabel?: string; danger?: boolean };
const ConfirmCtx = createContext<(o: ConfirmOptions) => Promise<boolean>>(async () => false);

export function ConfirmProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<(ConfirmOptions & { resolve: (v: boolean) => void }) | null>(null);
  const confirmBtn = useRef<HTMLButtonElement>(null);
  const confirm = useCallback((o: ConfirmOptions) => new Promise<boolean>((resolve) => setState({ ...o, resolve })), []);
  const close = (v: boolean) => {
    state?.resolve(v);
    setState(null);
  };
  useEffect(() => {
    if (!state) return;
    confirmBtn.current?.focus();
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && close(false);
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state]);
  return (
    <ConfirmCtx.Provider value={confirm}>
      {children}
      {state &&
        createPortal(
          <div className="fixed inset-0 z-[110] flex items-center justify-center bg-black/40 p-4" onClick={() => close(false)}>
            <div role="alertdialog" aria-modal="true" aria-labelledby="confirm-title" className="w-full max-w-md rounded-xl bg-white p-6 shadow-2xl" onClick={(e) => e.stopPropagation()}>
              <h2 id="confirm-title" className="text-base font-semibold">
                {state.title}
              </h2>
              {state.message && <div className="mt-2 text-sm text-black/60">{state.message}</div>}
              <div className="mt-6 flex justify-end gap-2">
                <Button onClick={() => close(false)}>Cancel</Button>
                <Button ref={confirmBtn} variant={state.danger ? "danger" : "primary"} onClick={() => close(true)}>
                  {state.confirmLabel ?? "Confirm"}
                </Button>
              </div>
            </div>
          </div>,
          document.body,
        )}
    </ConfirmCtx.Provider>
  );
}

export const useConfirm = () => useContext(ConfirmCtx);

/** Warn before leaving the page with unsaved changes. */
export function useUnsavedWarning(dirty: boolean) {
  useEffect(() => {
    if (!dirty) return;
    const handler = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      e.returnValue = "";
    };
    window.addEventListener("beforeunload", handler);
    return () => window.removeEventListener("beforeunload", handler);
  }, [dirty]);
}
