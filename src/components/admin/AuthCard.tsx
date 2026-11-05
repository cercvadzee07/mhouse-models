import type { ReactNode } from "react";

export function AuthCard({ title, subtitle, children, footer }: { title: string; subtitle?: ReactNode; children: ReactNode; footer?: ReactNode }) {
  return (
    <main className="flex min-h-screen items-center justify-center bg-[#efece6] px-4 py-12">
      <div className="w-full max-w-sm">
        <div className="mb-8 flex items-center gap-2.5">
          <span className="flex h-8 w-8 items-center justify-center rounded-md bg-[#161614] text-white">
            <span className="block h-3.5 w-3.5 border border-current">
              <span className="block h-1/2 w-1/2 bg-current" />
            </span>
          </span>
          <span className="text-sm font-semibold">Studio CMS</span>
        </div>
        <div className="rounded-2xl border border-black/[0.08] bg-white p-7 shadow-[0_30px_80px_-40px_rgba(0,0,0,0.3)]">
          <h1 className="text-xl font-semibold">{title}</h1>
          {subtitle && <p className="mt-1.5 text-sm text-black/55">{subtitle}</p>}
          <div className="mt-6">{children}</div>
        </div>
        {footer && <div className="mt-5 text-center text-[0.8rem] text-black/55">{footer}</div>}
      </div>
    </main>
  );
}
