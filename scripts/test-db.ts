/**
 * Database test: applies the migrations + seed to an in-process Postgres
 * (PGlite) with minimal stand-ins for Supabase's `auth` and `storage`
 * schemas, then verifies constraints and Row Level Security as different roles.
 *
 * Run: npm run test:db
 */
import { PGlite } from "@electric-sql/pglite";
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";

const root = join(__dirname, "..");
const db = new PGlite();
let failures = 0;
let passes = 0;

function ok(name: string, cond: boolean, extra = "") {
  if (cond) {
    passes++;
    console.log(`  ✓ ${name}`);
  } else {
    failures++;
    console.log(`  ✗ ${name} ${extra}`);
  }
}

async function expectError(name: string, sql: string, pattern?: RegExp) {
  try {
    await db.exec(sql);
    ok(name, false, "(expected an error, statement succeeded)");
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    ok(name, pattern ? pattern.test(msg) : true, `(got: ${msg})`);
  }
}

async function count(sql: string): Promise<number> {
  const r = await db.query<{ n: number }>(sql);
  return Number(r.rows[0]?.n ?? 0);
}

/** Run statements as a Supabase API role with a given JWT subject. */
async function as(role: "anon" | "authenticated", uid: string | null, fn: () => Promise<void>) {
  await db.exec(`reset role; select set_config('request.jwt.claim.sub', '${uid ?? ""}', false); set role ${role};`);
  try {
    await fn();
  } finally {
    await db.exec(`reset role; select set_config('request.jwt.claim.sub', '', false);`);
  }
}

const SUPABASE_STUBS = `
  create role anon nologin;
  create role authenticated nologin;
  create role service_role nologin bypassrls;
  create schema auth;
  create table auth.users (id uuid primary key, email text, raw_user_meta_data jsonb default '{}'::jsonb);
  create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $$;
  create schema storage;
  create table storage.buckets (id text primary key, name text, public boolean, file_size_limit bigint, allowed_mime_types text[]);
  create table storage.objects (id uuid primary key default gen_random_uuid(), bucket_id text references storage.buckets(id), name text, owner uuid);
  alter table storage.objects enable row level security;
  grant usage on schema public, auth, storage to anon, authenticated, service_role;
  grant execute on function auth.uid() to anon, authenticated;
  alter default privileges in schema public grant all on tables to anon, authenticated, service_role;
  alter default privileges in schema public grant all on sequences to anon, authenticated, service_role;
  grant all on storage.objects to anon, authenticated;
`;

async function main() {
  console.log("Applying Supabase stubs…");
  await db.exec(SUPABASE_STUBS);

  const migrations = readdirSync(join(root, "supabase", "migrations")).filter((f) => f.endsWith(".sql")).sort();
  for (const m of migrations) {
    console.log(`Applying ${m}`);
    await db.exec(readFileSync(join(root, "supabase", "migrations", m), "utf8"));
  }
  console.log("Applying seed.sql");
  await db.exec(readFileSync(join(root, "supabase", "seed.sql"), "utf8"));
  console.log("Re-applying seed.sql (must be idempotent)");
  await db.exec(readFileSync(join(root, "supabase", "seed.sql"), "utf8"));

  console.log("\nSeed");
  ok("9 demo projects", (await count("select count(*) n from projects where is_demo")) === 9);
  ok("18 translations", (await count("select count(*) n from project_translations")) === 18);
  ok("every demo project has a cover", (await count("select count(*) n from projects where cover_image_id is null")) === 0);
  ok("6 services", (await count("select count(*) n from services")) === 6);
  ok("5 categories", (await count("select count(*) n from project_categories")) === 5);
  ok("3 buckets", (await count("select count(*) n from storage.buckets")) === 3);
  ok("media bucket is public, originals private", (await count("select count(*) n from storage.buckets where (id='media' and public) or (id in ('originals','inquiries') and not public)")) === 3);

  console.log("\nConstraints");
  await expectError("rejects invalid slug", `insert into projects (slug) values ('Bad Slug!')`, /check/i);
  await expectError("rejects invalid status", `insert into projects (slug, status) values ('x-status', 'live')`, /check/i);
  await expectError("rejects image without a source", `insert into project_images (project_id) values ('d0000000-0000-4000-8000-000000000001')`, /project_images_source/);
  await expectError("rejects unknown 3D format", `insert into project_models (project_id, original_path, original_name, original_format) values ('d0000000-0000-4000-8000-000000000001','a','a.max','max')`, /check/i);
  await expectError("ready model needs a display file", `insert into project_models (project_id, original_path, original_name, original_format, display_status) values ('d0000000-0000-4000-8000-000000000001','a','a.obj','obj','ready')`, /ready_has_display/);
  await expectError("singleton tables accept only id=1", `insert into homepage_content (id) values (2)`, /check/i);

  // A draft project for visibility tests.
  await db.exec(`
    insert into projects (id, slug, status) values ('aaaaaaaa-0000-4000-8000-000000000001', 'secret-draft', 'draft');
    insert into project_translations (project_id, locale, title) values ('aaaaaaaa-0000-4000-8000-000000000001', 'en', 'Secret');
    insert into project_images (project_id, external_url) values ('aaaaaaaa-0000-4000-8000-000000000001', 'https://example.com/x.jpg');
    insert into inquiries (full_name, email, message) values ('Test Person', 't@example.com', 'Hello, I need a model.');
    update contact_settings set notify_email = 'owner@example.com', email = 'studio@example.com' where id = 1;
  `);

  console.log("\nAnonymous visitor (anon)");
  await as("anon", null, async () => {
    ok("sees only published projects", (await count("select count(*) n from projects")) === 9);
    ok("cannot see the draft", (await count("select count(*) n from projects where slug = 'secret-draft'")) === 0);
    ok("cannot see draft translations", (await count("select count(*) n from project_translations where project_id = 'aaaaaaaa-0000-4000-8000-000000000001'")) === 0);
    ok("cannot see draft images", (await count("select count(*) n from project_images where project_id = 'aaaaaaaa-0000-4000-8000-000000000001'")) === 0);
    ok("cannot read inquiries", (await count("select count(*) n from inquiries")) === 0);
    ok("cannot read raw contact settings", (await count("select count(*) n from contact_settings")) === 0);
    const view = await db.query<{ email: string }>("select * from public_contact_settings");
    ok("public contact view works", view.rows[0]?.email === "studio@example.com");
    ok("public contact view hides notify_email", !("notify_email" in (view.rows[0] ?? {})));
    ok("cannot read activity log", (await count("select count(*) n from activity_logs")) === 0);
    await expectError("cannot insert projects", `insert into projects (slug) values ('hack')`, /row-level security/i);
    const upd = await db.query("update projects set status = 'draft' returning id");
    ok("cannot unpublish projects", upd.rows.length === 0);
    await expectError("cannot reorder", `select reorder_rows('projects', array['d0000000-0000-4000-8000-000000000001']::uuid[])`, /not authorized/);
    await expectError("cannot upload to storage", `insert into storage.objects (bucket_id, name) values ('media', 'x.jpg')`, /row-level security/i);
  });

  const userId = "bbbbbbbb-0000-4000-8000-000000000001";
  const adminId = "cccccccc-0000-4000-8000-000000000001";
  await db.exec(`
    insert into auth.users (id, email) values ('${userId}', 'random@example.com');
    insert into auth.users (id, email) values ('${adminId}', 'admin@example.com');
  `);
  ok("profiles are created automatically", (await count("select count(*) n from profiles where role is null")) === 2);

  console.log("\nSigned-in user WITHOUT a CMS role");
  await as("authenticated", userId, async () => {
    ok("is_admin() is false", (await db.query<{ a: boolean }>("select is_admin() a")).rows[0].a === false);
    ok("still cannot see drafts", (await count("select count(*) n from projects where slug = 'secret-draft'")) === 0);
    await expectError("cannot insert projects", `insert into projects (slug) values ('hack2')`, /row-level security/i);
    await expectError("cannot grant themselves admin", `update profiles set role = 'admin' where id = '${userId}'`, /not allowed/i);
    ok("cannot read other profiles", (await count("select count(*) n from profiles")) === 1);
    await expectError("cannot upload to storage", `insert into storage.objects (bucket_id, name) values ('media', 'x.jpg')`, /row-level security/i);
  });

  // Promote via privileged role (what the setup script does with the service role).
  await db.exec(`update profiles set role = 'admin' where id = '${adminId}'`);
  ok("privileged role can grant admin", (await count(`select count(*) n from profiles where role = 'admin'`)) === 1);

  console.log("\nAdministrator");
  await as("authenticated", adminId, async () => {
    ok("is_admin() is true", (await db.query<{ a: boolean }>("select is_admin() a")).rows[0].a === true);
    ok("sees drafts", (await count("select count(*) n from projects")) === 10);
    ok("reads inquiries", (await count("select count(*) n from inquiries")) === 1);
    ok("reads private contact settings", (await count("select count(*) n from contact_settings where notify_email is not null")) === 1);
    await db.exec(`insert into projects (id, slug) values ('dddddddd-0000-4000-8000-000000000001', 'admin-made')`);
    ok("creates projects", (await count("select count(*) n from projects where slug = 'admin-made'")) === 1);
    await db.exec(`update projects set status = 'published' where slug = 'admin-made'`);
    ok("publishing sets published_at", (await count("select count(*) n from projects where slug='admin-made' and published_at is not null")) === 1);
    await db.exec(`select reorder_rows('projects', array['dddddddd-0000-4000-8000-000000000001','d0000000-0000-4000-8000-000000000001']::uuid[])`);
    ok("reorders projects", (await count("select sort_order n from projects where slug='admin-made'")) === 1);
    await db.exec(`insert into storage.objects (bucket_id, name) values ('media', 'projects/x/images/y.webp')`);
    ok("uploads to media bucket", (await count("select count(*) n from storage.objects")) === 1);
    await expectError("cannot write to the inquiries bucket directly", `insert into storage.objects (bucket_id, name) values ('inquiries', 'x.pdf')`, /row-level security/i);
    await db.exec(`insert into activity_logs (actor_id, action, entity_type, summary) values ('${adminId}', 'test', 'project', 'ok')`);
    ok("writes activity log", (await count("select count(*) n from activity_logs")) === 1);
    await expectError("cannot change own role via API", `update profiles set role = 'editor' where id = '${adminId}'`, /not allowed/i);
    await db.exec(`delete from projects where slug = 'admin-made'`);
    ok("deletes projects", (await count("select count(*) n from projects where slug = 'admin-made'")) === 0);
  });

  console.log("\nCascade & cover handling");
  await db.exec(`delete from project_images where id = (select cover_image_id from projects where slug = 'terrace-villa')`);
  ok("deleting the cover image nulls cover_image_id", (await count("select count(*) n from projects where slug='terrace-villa' and cover_image_id is null")) === 1);
  await db.exec(`delete from projects where slug = 'terrace-villa'`);
  ok("deleting a project cascades to images & translations", (await count("select count(*) n from project_translations t left join projects p on p.id = t.project_id where p.id is null")) === 0);

  console.log(`\n${passes} passed, ${failures} failed`);
  process.exit(failures ? 1 : 0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
