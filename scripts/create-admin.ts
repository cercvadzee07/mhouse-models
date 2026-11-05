/**
 * Initial administrator setup.
 *
 *   npm run admin:create -- owner@example.com
 *   npm run admin:create -- owner@example.com --password "a long passphrase"
 *   npm run admin:create -- owner@example.com --role editor
 *
 * - Creates the Supabase Auth user (email pre-confirmed) if it does not exist,
 *   otherwise keeps the existing account.
 * - Grants the CMS role in public.profiles using the service-role key.
 * - If no password is given for a new user, a strong one is generated and
 *   printed ONCE. Change it after the first login (Admin → General Settings).
 *
 * Requires NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in .env.local
 * (the key never leaves your machine/server).
 */
import { config } from "dotenv";
import { randomBytes } from "node:crypto";
import { createClient } from "@supabase/supabase-js";

config({ path: ".env.local" });
config();

const args = process.argv.slice(2);
const email = args.find((a) => !a.startsWith("--") && a.includes("@"))?.trim().toLowerCase();
const flag = (name: string) => {
  const i = args.indexOf(`--${name}`);
  return i >= 0 ? args[i + 1] : undefined;
};
const role = (flag("role") ?? "admin") as "admin" | "editor";
let password = flag("password");

async function main() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error("Set NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in .env.local first.");
  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw new Error("Usage: npm run admin:create -- you@example.com [--password …] [--role admin|editor]");
  if (!["admin", "editor"].includes(role)) throw new Error("--role must be admin or editor");
  if (password && password.length < 10) throw new Error("Password must be at least 10 characters.");

  const sb = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });

  // Find an existing user by email (paginate through the user list).
  let userId: string | null = null;
  for (let page = 1; page <= 50 && !userId; page++) {
    const { data, error } = await sb.auth.admin.listUsers({ page, perPage: 200 });
    if (error) throw error;
    userId = data.users.find((u) => u.email?.toLowerCase() === email)?.id ?? null;
    if (data.users.length < 200) break;
  }

  let generated = false;
  if (!userId) {
    if (!password) {
      password = randomBytes(18).toString("base64url");
      generated = true;
    }
    const { data, error } = await sb.auth.admin.createUser({ email, password, email_confirm: true });
    if (error || !data.user) throw error ?? new Error("Could not create user");
    userId = data.user.id;
    console.log(`✓ Created auth user ${email}`);
  } else {
    console.log(`• User ${email} already exists — keeping the existing password.`);
    if (password) {
      const { error } = await sb.auth.admin.updateUserById(userId, { password });
      if (error) throw error;
      console.log("✓ Password updated.");
    }
  }

  // The profile row is created by a trigger; upsert in case the trigger was added later.
  const { error: pErr } = await sb.from("profiles").upsert({ id: userId, email, role }, { onConflict: "id" });
  if (pErr) throw new Error(`Could not grant role: ${pErr.message}. Did you run the migrations?`);
  console.log(`✓ Granted role "${role}"`);

  if (generated) {
    console.log("\n  Temporary password (shown only once):\n");
    console.log(`    ${password}\n`);
    console.log("  Sign in at /admin/login and change it under General Settings → Your account.");
  }
}

main().catch((e) => {
  console.error(`✗ ${e instanceof Error ? e.message : e}`);
  process.exit(1);
});
