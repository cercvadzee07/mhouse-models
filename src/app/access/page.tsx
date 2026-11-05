import { AccessForm } from "./AccessForm";

export const dynamic = "force-dynamic";

export default async function AccessPage({ searchParams }: { searchParams: Promise<{ next?: string }> }) {
  const { next } = await searchParams;
  return (
    <main className="grain flex min-h-[100svh] items-center justify-center px-5 py-16">
      <div className="w-full max-w-sm">
        <div className="mb-10 flex items-center gap-2.5">
          <span aria-hidden className="inline-block h-4 w-4 border border-ink">
            <span className="block h-1/2 w-1/2 bg-ink" />
          </span>
          <span className="font-display text-2xl leading-none">MHouse</span>
          <span className="font-mono text-[0.62rem] uppercase tracking-[0.22em] text-graphite">Models</span>
        </div>
        <h1 className="display-md" lang="ka">
          დახურული წინასწარი ხედვა
        </h1>
        <p className="mt-2 text-sm text-graphite">Private preview — please enter the password.</p>
        <p className="mt-4 text-sm leading-relaxed text-graphite" lang="ka">
          საიტი ჯერ არ არის საჯარო. შესასვლელად შეიყვანეთ პაროლი.
        </p>
        <AccessForm next={next ?? "/"} />
      </div>
    </main>
  );
}
