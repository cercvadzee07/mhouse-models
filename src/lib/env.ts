/**
 * Public (browser-safe) environment. Only NEXT_PUBLIC_* values belong here.
 * Server-only secrets are read in `src/lib/supabase/service.ts` and
 * `src/lib/email.ts`, both guarded by `server-only`.
 */
export const env = {
  supabaseUrl: process.env.NEXT_PUBLIC_SUPABASE_URL ?? "",
  supabaseAnonKey: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "",
  siteUrl: (process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000").replace(/\/$/, ""),
};

export function isSupabaseConfigured(): boolean {
  return Boolean(env.supabaseUrl && env.supabaseAnonKey);
}
