import Link from "next/link";
import type { GeneralSettings } from "@/lib/types";

/**
 * Typographic wordmark. The name comes from General Settings
 * (Admin → General Settings), so it can be changed without code.
 */
export function Wordmark({
  general,
  href,
  className = "",
  inverted = false,
}: {
  general: Pick<GeneralSettings, "studio_name" | "studio_name_short" | "wordmark_suffix">;
  href: string;
  className?: string;
  inverted?: boolean;
}) {
  return (
    <Link
      href={href}
      aria-label={general.studio_name}
      className={`group inline-flex items-baseline gap-2 ${inverted ? "text-paper" : "text-ink"} ${className}`}
    >
      <span className="relative inline-flex items-center">
        <span
          aria-hidden
          className="mr-2 inline-block h-[0.9em] w-[0.9em] translate-y-[0.08em] border border-current transition-transform duration-700 ease-[var(--ease-architect)] group-hover:rotate-45"
        >
          <span className="block h-1/2 w-1/2 bg-current" />
        </span>
        <span className="font-display text-[1.45rem] leading-none tracking-[-0.01em]">{general.studio_name_short}</span>
      </span>
      {general.wordmark_suffix ? (
        <span className="font-mono text-[0.62rem] uppercase tracking-[0.22em] opacity-60">{general.wordmark_suffix}</span>
      ) : null}
    </Link>
  );
}
