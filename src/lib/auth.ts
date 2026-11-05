import "server-only";
import { redirect } from "next/navigation";
import type { SupabaseClient, User } from "@supabase/supabase-js";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { isSupabaseConfigured } from "@/lib/env";

export interface AdminContext {
  supabase: SupabaseClient;
  user: User;
  role: "admin" | "editor";
  email: string;
}

/** Returns the signed-in CMS user, or null. Validates the session with Supabase Auth (getUser). */
export async function getAdmin(): Promise<AdminContext | null> {
  if (!isSupabaseConfigured()) return null;
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;
  const { data: profile } = await supabase.from("profiles").select("role, email").eq("id", user.id).maybeSingle();
  if (!profile?.role) return null;
  return { supabase, user, role: profile.role, email: profile.email || user.email || "" };
}

/** For admin pages: redirect anonymous users to login and users without a role to the "no access" screen. */
export async function requireAdminPage(): Promise<AdminContext> {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/admin/login");
  const admin = await getAdmin();
  if (!admin) redirect("/admin/login?error=forbidden");
  return admin;
}

export class AuthError extends Error {
  constructor() {
    super("Not authorized");
  }
}

/** For server actions: throws unless the caller is an authorized CMS user. */
export async function assertAdmin(): Promise<AdminContext> {
  const admin = await getAdmin();
  if (!admin) throw new AuthError();
  return admin;
}

export type ActionResult<T = undefined> = { ok: true; data: T } | { ok: false; error: string };

/** Wraps a server action with authorization and uniform error handling. */
export async function adminAction<T>(fn: (ctx: AdminContext) => Promise<T>): Promise<ActionResult<T>> {
  try {
    const ctx = await assertAdmin();
    const data = await fn(ctx);
    return { ok: true, data };
  } catch (e) {
    if (e instanceof AuthError) return { ok: false, error: "Your session has expired or you do not have access. Please sign in again." };
    const message = e instanceof Error ? e.message : "Unexpected error";
    console.error("[admin action]", message);
    return { ok: false, error: message };
  }
}

export async function logActivity(
  ctx: AdminContext,
  action: string,
  entityType: string,
  entityId: string | null,
  summary: string,
  details: Record<string, unknown> = {},
) {
  const { error } = await ctx.supabase.from("activity_logs").insert({
    actor_id: ctx.user.id,
    actor_email: ctx.email,
    action,
    entity_type: entityType,
    entity_id: entityId,
    summary: summary.slice(0, 300),
    details,
  });
  if (error) console.error("[activity]", error.message);
}
