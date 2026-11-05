/** Minimal monochrome glyphs for social links (drawn here to avoid brand-asset dependencies). */
export function SocialIcon({ name, className = "h-4 w-4" }: { name: "instagram" | "tiktok" | "facebook" | "linkedin" | "whatsapp"; className?: string }) {
  const common = { className, viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: 1.5, "aria-hidden": true } as const;
  switch (name) {
    case "instagram":
      return (
        <svg {...common}>
          <rect x="3.5" y="3.5" width="17" height="17" rx="5" />
          <circle cx="12" cy="12" r="4" />
          <circle cx="17.3" cy="6.7" r="0.6" fill="currentColor" />
        </svg>
      );
    case "tiktok":
      return (
        <svg {...common}>
          <path d="M14 3.5v11.2a3.8 3.8 0 1 1-3.8-3.8" />
          <path d="M14 3.5c.4 2.6 2.3 4.4 5 4.6" />
        </svg>
      );
    case "facebook":
      return (
        <svg {...common}>
          <path d="M14.5 8H16V4.8h-2c-2.4 0-3.6 1.5-3.6 3.9V11H8v3.2h2.4V20h3.3v-5.8h2.4l.4-3.2h-2.8V9.2c0-.8.3-1.2.8-1.2Z" />
        </svg>
      );
    case "linkedin":
      return (
        <svg {...common}>
          <rect x="3.5" y="3.5" width="17" height="17" rx="2" />
          <path d="M8 10.5V16M8 7.8v.01M11.5 16v-5.5M11.5 13c0-1.6 1-2.6 2.3-2.6s2.2.9 2.2 2.6V16" />
        </svg>
      );
    case "whatsapp":
      return (
        <svg {...common}>
          <path d="M4.5 19.5l1.2-3.6A7.8 7.8 0 1 1 8.4 18.5Z" />
          <path d="M9.3 8.6c.2-.4.5-.4.8-.4l.6.1.9 2-.6.8c.5 1 1.3 1.8 2.3 2.3l.8-.6 2 .9v.6c0 .4-.2.7-.5.9-.6.4-1.5.5-2.6 0a8.2 8.2 0 0 1-3.6-3.6c-.5-1.1-.4-2 .0-2.5Z" />
        </svg>
      );
  }
}
