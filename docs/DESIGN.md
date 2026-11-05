# Design system & research notes

## Research

**Reference studios reviewed:** vertexmodels.ae, maketland.com, scalesandmodels.com, atrm-design.com.
Common strengths adopted (not copied): numbered editorial sections ("01 / Studio"), short
two-part headlines, image-led project cards with category + scale/year, a clear multi-step
process, a closing "start a project" call to action. Weaknesses avoided: generic service cards,
stat counters with unverifiable numbers, cluttered grids.

**@mhouse_models (TikTok) — limitation, stated honestly:** TikTok blocked all automated access
during development (profile page returned only a loading screen; the embed endpoint returned
HTTP 503; third-party mirrors returned 403). The public oEmbed endpoint confirmed the account exists
and its display name is **„მაკეტების დამზადება შეკვეთით“** ("custom model making"). **No videos
could be watched**, so nothing on the site claims specific techniques, materials, lighting or
clients of the real maker. Copy is deliberately general and fully editable; the demonstration
projects are clearly labelled and use other makers' Unsplash photos. Recommended next step: the
owner replaces demo content with real photos/videos and reviews the service and process texts
(Admin → Services / Studio). The TikTok profile is linked from the contact section.

## Identity

- **Wordmark:** a square-in-square mark (a plan/plinth) + "MHouse" in Instrument Serif +
  "MODELS" in mono caps. Text comes from General Settings, so the name is replaceable.
- **Tone:** calm, precise, first-person singular (an independent maker), commercial value stated plainly.

## Color tokens (`src/app/globals.css`)

| Token | Hex | Use |
| --- | --- | --- |
| paper | `#f4f1eb` | page background (warm white) |
| bone / stone / sand | `#ebe6dd` / `#dcd5c9` / `#c9bfae` | section tints, image placeholders |
| concrete / graphite | `#a7a198` / `#6a665f` | secondary text, labels |
| charcoal / ink | `#2c2b28` / `#161614` | text, dark sections, buttons |
| lamp | `#e9b877` | single warm accent — lit windows, indicators |

## Typography

- **Display:** Instrument Serif (Latin) + Noto Serif Georgian (Georgian, weight 300). The browser
  picks the Georgian font automatically for Georgian glyphs.
- **Text:** Inter + Noto Sans Georgian. **Labels/technical:** IBM Plex Mono (scales, numbers).
- Georgian gets smaller display sizes, relaxed leading, no ch-based measures and no uppercase
  transform (which would switch to Mtavruli).
- Scale: `display-xl` (hero/page titles), `display-lg` (section titles), `display-md`, `lead`, `eyebrow`.

## Layout & spacing

12-column grid (`grid-12`), container max 1680 px, gutter `clamp(1.25rem, 3.6vw, 4rem)`, section
padding `clamp(5rem, 11vw, 10rem)`. Breakpoints: Tailwind defaults (sm 640, md 768, lg 1024, xl 1280).
Asymmetric editorial compositions for featured work; two-column offset masonry for the portfolio.

## Components

Buttons (`btn-solid`, `btn-ghost`, pill shape), underline form fields with accessible errors,
hairline rules, dimension-line ornaments, section labels ("03 —— Selected work"), project cards
with subtle 3D tilt + image zoom, lightbox, video cards with lazy players, 3D viewer with controls.

## Motion principles

One easing curve (`cubic-bezier(0.22, 1, 0.36, 1)`), 0.7–1.4 s durations, reveal on scroll
once, masked headline word reveals, hover depth on cards, spring-following service images, a
construction line that draws through the process steps, soft page transitions. All motion is
disabled or reduced under `prefers-reduced-motion`.

## 3D

- **Hero:** an original procedural scale model — residential towers on a podium, townhouses,
  streets with markings, trees, scale figures and street lamps on a basswood board and charcoal
  exhibition plinth. Instanced geometry (few draw calls), soft shadows, procedural environment
  lighting (no external HDR files), slow turntable sway, pointer parallax, scroll dolly,
  drag-to-rotate with spring snap-back, and a "lights on/off" toggle for the lit windows.
- **Fallbacks:** rendering pauses off-screen; lower DPR/no shadows on low-power devices;
  a still image when WebGL is unavailable; static model under reduced motion.
- **Project viewer:** orbit/zoom/pan, reset, fullscreen, auto-rotate; the admin adds wireframe and stats.

## Admin interface

Related but distinct: same typefaces, neutral light surfaces, dark sidebar, rounded cards,
explicit status badges, toasts, confirmation dialogs, side-by-side GE/EN fields.
