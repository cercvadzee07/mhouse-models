"use client";

import { useRef, useState, type ReactNode } from "react";

export function Dropzone({
  accept,
  multiple = true,
  onFiles,
  title,
  hint,
  disabled,
  compact,
}: {
  accept: string;
  multiple?: boolean;
  onFiles: (files: File[]) => void;
  title: ReactNode;
  hint?: ReactNode;
  disabled?: boolean;
  compact?: boolean;
}) {
  const input = useRef<HTMLInputElement>(null);
  const [over, setOver] = useState(false);
  return (
    <div
      role="button"
      tabIndex={disabled ? -1 : 0}
      aria-disabled={disabled}
      onClick={() => !disabled && input.current?.click()}
      onKeyDown={(e) => {
        if (!disabled && (e.key === "Enter" || e.key === " ")) {
          e.preventDefault();
          input.current?.click();
        }
      }}
      onDragOver={(e) => {
        e.preventDefault();
        if (!disabled) setOver(true);
      }}
      onDragLeave={() => setOver(false)}
      onDrop={(e) => {
        e.preventDefault();
        setOver(false);
        if (disabled) return;
        const files = [...(e.dataTransfer.files ?? [])];
        if (files.length) onFiles(multiple ? files : files.slice(0, 1));
      }}
      className={`flex cursor-pointer flex-col items-center justify-center rounded-xl border-2 border-dashed text-center transition-colors ${
        compact ? "px-4 py-5" : "px-6 py-9"
      } ${over ? "border-[#161614] bg-black/[0.03]" : "border-black/15 hover:border-black/35"} ${disabled ? "cursor-not-allowed opacity-50" : ""}`}
    >
      <svg aria-hidden viewBox="0 0 24 24" className="mb-2 h-6 w-6 text-black/40" fill="none" stroke="currentColor" strokeWidth={1.5}>
        <path d="M12 16V4m0 0-4 4m4-4 4 4M4 16v2a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-2" />
      </svg>
      <p className="text-sm font-medium">{title}</p>
      {hint && <p className="mt-1 text-[0.78rem] text-black/50">{hint}</p>}
      <input
        ref={input}
        type="file"
        accept={accept}
        multiple={multiple}
        className="hidden"
        onChange={(e) => {
          const files = [...(e.target.files ?? [])];
          if (files.length) onFiles(files);
          e.target.value = "";
        }}
      />
    </div>
  );
}
