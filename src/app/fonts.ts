import localFont from "next/font/local";

/**
 * Self-hosted fonts (from the open-source Fontsource packages in node_modules).
 * Nothing is downloaded from Google at build or dev time, so builds work
 * offline and behind firewalls, and visitors' browsers never contact Google.
 */

export const instrument = localFont({
  src: [
    { path: "../../node_modules/@fontsource/instrument-serif/files/instrument-serif-latin-400-normal.woff2", weight: "400", style: "normal" },
    { path: "../../node_modules/@fontsource/instrument-serif/files/instrument-serif-latin-400-italic.woff2", weight: "400", style: "italic" },
  ],
  variable: "--font-instrument",
  display: "swap",
  fallback: ["Times New Roman", "serif"],
});

export const notoSerifKa = localFont({
  src: [{ path: "../../node_modules/@fontsource-variable/noto-serif-georgian/files/noto-serif-georgian-georgian-wght-normal.woff2", weight: "100 900", style: "normal" }],
  variable: "--font-noto-serif-ka",
  display: "swap",
  fallback: ["serif"],
});

export const inter = localFont({
  src: [
    { path: "../../node_modules/@fontsource-variable/inter/files/inter-latin-wght-normal.woff2", weight: "100 900", style: "normal" },
  ],
  variable: "--font-inter",
  display: "swap",
  fallback: ["system-ui", "sans-serif"],
});

export const notoSansKa = localFont({
  src: [{ path: "../../node_modules/@fontsource-variable/noto-sans-georgian/files/noto-sans-georgian-georgian-wght-normal.woff2", weight: "100 900", style: "normal" }],
  variable: "--font-noto-sans-ka",
  display: "swap",
  fallback: ["sans-serif"],
});

export const plexMono = localFont({
  src: [
    { path: "../../node_modules/@fontsource/ibm-plex-mono/files/ibm-plex-mono-latin-400-normal.woff2", weight: "400", style: "normal" },
    { path: "../../node_modules/@fontsource/ibm-plex-mono/files/ibm-plex-mono-latin-500-normal.woff2", weight: "500", style: "normal" },
  ],
  variable: "--font-plex-mono",
  display: "swap",
  fallback: ["ui-monospace", "monospace"],
});

export const fontVariables = [instrument, notoSerifKa, inter, notoSansKa, plexMono].map((f) => f.variable).join(" ");
