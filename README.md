# MHouse Models — architectural model studio website & CMS

A bilingual (Georgian-first, English) website for an independent architectural
model-making studio, with a full content management system at `/admin`.

- **Public site:** 3D hero (an interactive procedural architectural model), studio, services,
  portfolio with filters, project pages with gallery, production photos, videos and an
  interactive 3D viewer, a "why physical models" section, the work process and a contact form.
- **CMS:** secure login, projects (create / edit / duplicate / delete / publish / feature / reorder),
  photos, videos and 3D models with drag-and-drop uploads, homepage, services, studio, contact,
  SEO, general settings and an inquiries inbox.
- **Backend:** Supabase Postgres (Row Level Security), Supabase Auth, Supabase Storage.

> Studio name: **"MHouse Models"** is an editable placeholder taken from the TikTok handle
> `@mhouse_models`. Change it in **Admin → General Settings**.

---

## Stack

| Layer | Technology |
| --- | --- |
| Framework | Next.js 15 (App Router, Server Actions), React 19, TypeScript |
| Styling / motion | Tailwind CSS 4, Framer Motion |
| 3D | three.js, React Three Fiber, drei |
| Data | Supabase Postgres + RLS, Supabase Auth, Supabase Storage |
| Images | sharp (WebP optimisation, thumbnails, blur placeholders) |
| Validation | zod (server) + the same rules in the browser |
| Email (optional) | Resend REST API |

---

## 1. Installation

Requirements: Node.js 20.9+ (tested with Node 24) and npm.

```bash
npm install
cp .env.example .env.local     # then fill in the values (see below)
npm run dev                    # http://localhost:3000
```

Without Supabase variables the site runs in **preview mode**: the public pages show the
built-in demonstration content, the contact form says it is not connected (it never fakes
success), and `/admin` shows setup instructions.

## 2. Database & storage setup (Supabase)

1. Create a project at <https://supabase.com> (the Free plan works to start).
2. **SQL Editor → New query**, paste and run, in this order:
   1. `supabase/migrations/20261105000001_schema.sql` — tables, constraints, indexes, triggers, RLS
   2. `supabase/migrations/20261105000002_storage.sql` — storage buckets + storage policies
   3. `supabase/seed.sql` — default content, categories, services and **demonstration projects**

   (With the Supabase CLI you can instead run `supabase link` and `supabase db push`, then run the seed.)
3. **Project Settings → API**: copy the Project URL, the `anon` key and the `service_role` key into `.env.local`.
4. **Authentication → Providers → Email**: keep Email enabled. **Turn off "Allow new users to sign up"**
   (Authentication → Sign In / Providers). Admins are created only by the setup script below —
   even if someone signs up, they get no role and cannot access anything (enforced by RLS).
5. **Authentication → URL Configuration**: set *Site URL* to your domain and add
   `https://YOUR-DOMAIN/admin/auth/confirm` (and `http://localhost:3000/admin/auth/confirm`)
   to *Redirect URLs* — needed for password-reset emails.
6. **Storage → Settings**: the global upload limit is 50 MB on the Free plan. The CMS allows
   photos up to 30 MB, 3D files up to 250 MB and videos up to 500 MB; raise the project limit on a
   paid plan if you need large videos/models (limits are defined in `src/lib/media-rules.ts`).

### Buckets

| Bucket | Access | Contents |
| --- | --- | --- |
| `media` | public read (by exact URL), admin write | optimised photos, thumbnails, videos, posters, browser-ready GLB models, site images |
| `originals` | private, admin only | untouched original photos and original 3D files (OBJ/FBX/STL/3MF/glTF) |
| `inquiries` | private, server only | files attached to the contact form |

Object keys contain random UUIDs and anonymous users cannot list buckets, so media of
unpublished drafts is not discoverable. Database rows of drafts are hidden by RLS.

## 3. Create the first administrator

```bash
npm run admin:create -- owner@example.com
# or with your own password:
npm run admin:create -- owner@example.com --password "a long passphrase here"
```

This uses `SUPABASE_SERVICE_ROLE_KEY` locally to create the user (email pre-confirmed) and set
`profiles.role = 'admin'`. If no password is given, a strong temporary password is printed once —
change it in **Admin → General Settings → Your account**. Run it again for additional
administrators (`--role editor` is also available; both roles can manage content).

Then open <http://localhost:3000/admin>.

## 4. Environment variables

| Variable | Required | Where it is used |
| --- | --- | --- |
| `NEXT_PUBLIC_SITE_URL` | yes (production) | canonical URLs, sitemap, Open Graph |
| `NEXT_PUBLIC_SUPABASE_URL` | yes | browser + server |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | yes | browser + server (safe: protected by RLS) |
| `SUPABASE_SERVICE_ROLE_KEY` | yes | **server only** — contact-form inquiries, admin setup script |
| `RESEND_API_KEY`, `CONTACT_FROM_EMAIL` | optional | email notification for new inquiries |

The service-role key is read only in `src/lib/supabase/service.ts` (guarded by `server-only`)
and in the CLI script. It is never sent to the browser.

## 5. Deployment (Vercel recommended)

1. Push the repository to GitHub and import it in Vercel (framework preset: Next.js).
2. Add the environment variables above (Production + Preview). Set `NEXT_PUBLIC_SITE_URL`
   to the final domain, e.g. `https://mhouse.ge`.
3. Deploy, then add the domain in Vercel and update Supabase *Site URL* / *Redirect URLs*.

**Private preview (before launch):** set `SITE_ACCESS_PASSWORD` in Vercel. Every public page then
asks for that password (remembered for 30 days in that browser), `robots.txt` blocks all crawlers and
the sitemap is empty. `/admin` keeps its own login. To launch publicly, delete the variable and redeploy.

**Phones:** the site is responsive (checked at 360, 390 and 768 px) and installable via
"Add to Home Screen" (web app manifest + icons).

Any Node host works: `npm run build && npm start` (port 3000). Image optimisation uses `sharp`
(installed automatically). Public pages are statically cached and **purged automatically**
whenever content is saved in the CMS; they also refresh every 5 minutes as a safety net.

## 6. Scripts

| Command | Purpose |
| --- | --- |
| `npm run dev` / `build` / `start` | develop / build / serve |
| `npm run typecheck`, `npm run lint` | static checks |
| `npm run test:db` | applies migrations + seed to an in-process Postgres (PGlite) and verifies constraints and RLS for anonymous, unprivileged and admin users |
| `npm run test:3d` | verifies the 3D conversion pipeline (STL, OBJ, FBX, glTF, GLB, 3MF) in headless Edge/Chrome and server-side file sniffing |
| `npm test` | all of the above |
| `npm run admin:create -- email` | create / promote an administrator |
| `npm run db:seed:generate` | regenerate `supabase/seed.sql` from `src/content/defaults.ts` |
| `npm run qa:screens -- <dir> 1440x900 <url…>` | screenshot pages for visual QA |

`test:3d` and `qa:screens` use the locally installed Microsoft Edge by default; set
`BROWSER_PATH` to use another Chromium-based browser.

## 7. Project structure

```
src/
  app/[locale]/…            public site (ka = "/", en = "/en")
  app/admin/…               CMS (login, password reset, panel pages, preview)
  app/admin/actions/…       server actions (all authorised server-side)
  app/actions/inquiry.ts    public contact form (validated, rate-limited)
  components/site/…         public UI   components/admin/…  CMS UI   components/three/… 3D
  content/defaults.ts       default copy + demonstration content (source of the seed)
  i18n/                     dictionaries (ka, en) and locale helpers
  lib/                      data access, auth, storage, validation, image processing
supabase/migrations/        schema, RLS, storage policies       supabase/seed.sql
scripts/                    admin setup, seed generator, tests, QA helpers
docs/                       ADMIN-GUIDE.md (how to manage content), DESIGN.md (design system & research)
```

## 8. What you need to provide

- A **Supabase project** (URL, anon key, service-role key) — required for the CMS, uploads and the contact form.
- The **real studio name, contact details and social links** (Admin → General Settings / Contact Information).
- **Real project photographs, videos and 3D models** — then remove the demo content (Admin → General Settings).
- Optional: a **Resend** account with a verified sender domain for inquiry emails.
- A **domain** and hosting account (e.g. Vercel).

See **[docs/ADMIN-GUIDE.md](docs/ADMIN-GUIDE.md)** for day-to-day content management.
