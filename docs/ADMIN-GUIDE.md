# Admin guide — managing the website

Open **`/admin`** on your website and sign in with your administrator email and password.

> **მოკლედ ქართულად:** შედით `/admin`-ზე → „Add New Project“ → ჩაწერეთ სახელი ქართულად და
> ინგლისურად → შემდეგ ეკრანზე დაამატეთ აღწერა, ფოტოები, ვიდეოები და 3D მოდელი → „Preview“ →
> „Publish“. გამოქვეყნებული პროექტი მაშინვე ჩნდება საიტზე. ნებისმიერი ცვლილება საიტზე
> ავტომატურად აისახება — კოდის შეცვლა არასდროს დაგჭირდებათ.

---

## Add a new project (step by step)

1. Click **Add New Project** in the sidebar.
2. Enter the project name in **Georgian (GE)** and **English (EN)**, optionally choose a category,
   and press **Create draft & continue**. The project is private until you publish it.
3. **1 · Name & description** — short description (used on portfolio cards) and the full
   description in both languages. Separate paragraphs with an empty line. The URL slug is filled
   automatically from the English title; you can edit it.
4. **2 · Photographs** — drag photos onto the drop zone (JPG, PNG or WebP). They are uploaded with
   a progress bar, optimised to WebP, and thumbnails are generated. The first photo becomes the
   **cover**; use **Set cover** to choose another. Drag the handle (⋮⋮) to reorder.
   **Alt text** describes each photo for accessibility and search engines (GE + EN).
   *Production photographs* (fabrication, assembly, painting…) go in the second box and appear in
   a "Making of" section.
5. **3 · 3D models** — drop a model file. It is read in your browser and you see an **interactive
   preview** (rotate, zoom, pan, reset, wireframe, triangle count) **before** uploading. Press
   **Upload model** to store it.
   - **GLB** (recommended) is used directly.
   - **OBJ, FBX, STL, 3MF and embedded glTF** are converted to GLB in your browser; the original
     file is kept and can be downloaded (**Original**).
   - A glTF that references external `.bin`/texture files must be exported as a single `.glb`.
   - If a file cannot be converted, you are told why; the original can still be stored, but it is
     marked **Not displayable** and is not shown on the website. Export a GLB and use **Replace**.
   - With several models, **Make primary** chooses which one is shown first.
6. **4 · Videos** — choose the video type (finished model, production process, behind the scenes,
   walkthrough, close-up details) and drop MP4/WebM files. A poster frame is captured automatically.
   You can also paste a YouTube, Vimeo or TikTok link. Add captions in both languages.
7. **5 · Details** — scale (e.g. 1:200), dimensions, date, location and materials. All optional:
   empty fields are hidden on the website. Turn on **Featured project** to show it on the homepage.
8. **6 · SEO** — optional custom title/description for Google and social sharing.
9. Press **Preview ↗** to see the complete page exactly as visitors will (GE/EN switch at the top).
10. Press **Save draft** to keep working later, or **Publish** to put it online immediately.

Photos, videos and 3D models are saved as soon as each upload finishes. Text is saved with the
buttons in the bar at the bottom (you are warned if you try to leave with unsaved changes).

## Edit, unpublish, duplicate, delete, reorder

**Projects** lists everything with search and filters (status, category).
- **Edit** opens the editor. For a published project, **Save & update live page** updates the
  website immediately.
- **Unpublish** hides a project from the website without deleting it.
- **☆ Feature** toggles whether it appears in "Selected work" on the homepage.
- **Duplicate** creates a draft copy (useful for similar models).
- **Delete** permanently removes the project and its files.
- **Drag the handle** to set the order of the public portfolio (clear search/filters first).

## Website content

| Section | What you can change |
| --- | --- |
| **Services** | add, edit, hide, delete and reorder services; GE/EN texts; image |
| **Homepage Content** | headline, description, button labels; hero visual (built-in 3D model, one of your uploaded 3D models, or a photo); automatic movement; window lights; featured projects; "why physical models" headline |
| **Studio Information** | about text, short description, principles, studio photo |
| **Contact Information** | email, phone, WhatsApp, social links, location, where inquiry emails are sent |
| **SEO Settings** | page titles, meta descriptions and social-sharing images for the site, homepage and portfolio |
| **General Settings** | studio name / logo text, categories, demo-content removal, your password |
| **Inquiries** | messages from the contact form, with attachments; reply, archive or delete |

## Demonstration content

The site was installed with **9 clearly labelled demonstration projects** (photos of other makers'
models from Unsplash) so it looks complete before your work is uploaded. They carry a
"Demonstration" badge on the website. When your own projects are online, go to
**General Settings → Demonstration content → Remove all demo content**. Default service images
are demo photos too — upload your own in **Services**.

## Passwords & access

- Forgot your password: **/admin/forgot-password** sends a reset link (open it in the same browser).
- Change your password: **General Settings → Your account**.
- New administrators are added by the developer/owner with `npm run admin:create -- email`
  (public registration is not possible).

## Tips for the best results

- Photos: at least 2400 px on the long side; soft, even light; neutral background.
- 3D models: export GLB with applied transforms; keep it under ~50 MB / ~1 million triangles for
  smooth viewing on phones. Use Draco compression if your software supports it.
- Videos: MP4 (H.264) 1080p, 10–60 seconds, under 50 MB on the Supabase Free plan.
