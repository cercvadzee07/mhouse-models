"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState, type ReactNode } from "react";
import { signOut } from "@/app/admin/actions/auth";

const NAV: { href: string; label: string; icon: string; exact?: boolean }[] = [
  { href: "/admin", label: "Overview", icon: "M3 12h7V3H3zm11 9h7v-9h-7zM3 21h7v-5H3zm11-11h7V3h-7z", exact: true },
  { href: "/admin/projects", label: "Projects", icon: "M4 5h16v14H4zM4 9h16M9 9v10", exact: true },
  { href: "/admin/projects/new", label: "Add New Project", icon: "M12 5v14M5 12h14", exact: true },
  { href: "/admin/services", label: "Services", icon: "M4 6h16M4 12h16M4 18h10" },
  { href: "/admin/homepage", label: "Homepage Content", icon: "M3 11 12 4l9 7v9H3z" },
  { href: "/admin/studio", label: "Studio Information", icon: "M5 21V8l7-4 7 4v13M9 21v-6h6v6" },
  { href: "/admin/contact", label: "Contact Information", icon: "M4 6h16v12H4zM4 7l8 6 8-6" },
  { href: "/admin/inquiries", label: "Inquiries", icon: "M4 4h16v12H7l-3 3z" },
  { href: "/admin/seo", label: "SEO Settings", icon: "M11 4a7 7 0 1 0 0 14 7 7 0 0 0 0-14zm5 12 4 4" },
  { href: "/admin/settings", label: "General Settings", icon: "M12 9a3 3 0 1 0 0 6 3 3 0 0 0 0-6zM4 12h2m12 0h2M12 4v2m0 12v2" },
];

function Icon({ d }: { d: string }) {
  return (
    <svg aria-hidden viewBox="0 0 24 24" className="h-[1.05rem] w-[1.05rem] shrink-0" fill="none" stroke="currentColor" strokeWidth={1.6} strokeLinecap="round" strokeLinejoin="round">
      <path d={d} />
    </svg>
  );
}

export function AdminShell({ children, email, studioName, newInquiries }: { children: ReactNode; email: string; studioName: string; newInquiries: number }) {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  useEffect(() => setOpen(false), [pathname]);

  const isActive = (item: (typeof NAV)[number]) =>
    item.exact ? pathname === item.href || (item.href === "/admin/projects" && /^\/admin\/projects\/[0-9a-f-]{36}/.test(pathname)) : pathname.startsWith(item.href);

  const nav = (
    <nav aria-label="Admin" className="flex h-full flex-col">
      <div className="flex h-16 items-center gap-2.5 border-b border-white/10 px-5">
        <span className="flex h-7 w-7 items-center justify-center rounded-md bg-white text-[#161614]">
          <span className="block h-3 w-3 border border-current">
            <span className="block h-1/2 w-1/2 bg-current" />
          </span>
        </span>
        <div className="leading-tight">
          <p className="text-[0.85rem] font-semibold text-white">{studioName}</p>
          <p className="text-[0.68rem] text-white/45">Content management</p>
        </div>
      </div>
      <ul className="flex-1 space-y-0.5 overflow-y-auto p-3">
        {NAV.map((item) => (
          <li key={item.href}>
            <Link
              href={item.href}
              aria-current={isActive(item) ? "page" : undefined}
              className={`flex items-center gap-3 rounded-lg px-3 py-2 text-[0.85rem] transition-colors ${
                isActive(item) ? "bg-white/[0.12] text-white" : "text-white/65 hover:bg-white/[0.06] hover:text-white"
              }`}
            >
              <Icon d={item.icon} />
              <span className="flex-1">{item.label}</span>
              {item.href === "/admin/inquiries" && newInquiries > 0 && (
                <span className="rounded-full bg-[#e9b877] px-1.5 text-[0.68rem] font-semibold text-[#161614]">{newInquiries}</span>
              )}
            </Link>
          </li>
        ))}
      </ul>
      <div className="space-y-1 border-t border-white/10 p-3">
        <a href="/" target="_blank" rel="noopener noreferrer" className="flex items-center gap-3 rounded-lg px-3 py-2 text-[0.85rem] text-white/65 hover:bg-white/[0.06] hover:text-white">
          <Icon d="M14 4h6v6M20 4l-9 9M18 14v6H4V6h6" />
          View website
        </a>
        <form action={signOut}>
          <button type="submit" className="flex w-full items-center gap-3 rounded-lg px-3 py-2 text-left text-[0.85rem] text-white/65 hover:bg-white/[0.06] hover:text-white">
            <Icon d="M15 4h4v16h-4M10 16l-4-4 4-4M6 12h10" />
            Logout
          </button>
        </form>
        <p className="truncate px-3 pt-1 text-[0.7rem] text-white/35" title={email}>
          {email}
        </p>
      </div>
    </nav>
  );

  return (
    <div className="min-h-screen">
      <aside className="fixed inset-y-0 left-0 z-40 hidden w-64 bg-[#161614] lg:block">{nav}</aside>

      {/* Mobile top bar */}
      <div className="sticky top-0 z-30 flex h-14 items-center justify-between border-b border-black/10 bg-white/95 px-4 backdrop-blur lg:hidden">
        <span className="text-sm font-semibold">{studioName} · Admin</span>
        <button type="button" onClick={() => setOpen(true)} aria-label="Open menu" aria-expanded={open} className="rounded-md p-2 hover:bg-black/5">
          <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth={1.6} aria-hidden>
            <path d="M4 7h16M4 12h16M4 17h16" />
          </svg>
        </button>
      </div>
      {open && (
        <div className="fixed inset-0 z-50 lg:hidden">
          <button type="button" aria-label="Close menu" className="absolute inset-0 bg-black/40" onClick={() => setOpen(false)} />
          <aside className="absolute inset-y-0 left-0 w-72 max-w-[85vw] bg-[#161614] shadow-2xl">{nav}</aside>
        </div>
      )}

      <main className="lg:pl-64">
        <div className="mx-auto max-w-[1400px] px-4 py-6 sm:px-6 lg:py-8">{children}</div>
      </main>
    </div>
  );
}
