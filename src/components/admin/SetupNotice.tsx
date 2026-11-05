export function SetupNotice() {
  return (
    <main className="mx-auto max-w-2xl px-6 py-20">
      <p className="font-mono text-xs uppercase tracking-widest text-black/40">Admin · setup required</p>
      <h1 className="mt-4 text-2xl font-semibold">Connect the database to enable the CMS</h1>
      <p className="mt-3 text-sm leading-relaxed text-black/60">
        The public website is running in preview mode with built-in demonstration content. To log in, upload projects and manage
        content, connect a Supabase project:
      </p>
      <ol className="mt-6 list-decimal space-y-3 pl-5 text-sm leading-relaxed text-black/75">
        <li>Create a free project at supabase.com.</li>
        <li>
          Run the SQL files in <code className="rounded bg-black/5 px-1">supabase/migrations</code> and then{" "}
          <code className="rounded bg-black/5 px-1">supabase/seed.sql</code> in the Supabase SQL editor.
        </li>
        <li>
          Copy <code className="rounded bg-black/5 px-1">.env.example</code> to <code className="rounded bg-black/5 px-1">.env.local</code> and fill in{" "}
          <code className="rounded bg-black/5 px-1">NEXT_PUBLIC_SUPABASE_URL</code>, <code className="rounded bg-black/5 px-1">NEXT_PUBLIC_SUPABASE_ANON_KEY</code> and{" "}
          <code className="rounded bg-black/5 px-1">SUPABASE_SERVICE_ROLE_KEY</code>.
        </li>
        <li>
          Create the first administrator: <code className="rounded bg-black/5 px-1">npm run admin:create -- you@example.com</code>
        </li>
        <li>Restart the server and open /admin.</li>
      </ol>
      <p className="mt-6 text-sm text-black/50">Full instructions are in README.md and docs/ADMIN-GUIDE.md.</p>
    </main>
  );
}
