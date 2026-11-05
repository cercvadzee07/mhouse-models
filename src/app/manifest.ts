import type { MetadataRoute } from "next";

/** Lets visitors "Add to Home Screen" on phones (opens full-screen, like an app). */
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "MHouse Models — არქიტექტურული მაკეტები",
    short_name: "MHouse",
    description: "Architectural scale models, made to order · Georgia",
    start_url: "/",
    scope: "/",
    display: "standalone",
    orientation: "portrait",
    background_color: "#f4f1eb",
    theme_color: "#f4f1eb",
    lang: "ka",
    icons: [
      { src: "/icons/icon-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
      { src: "/icons/maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
  };
}
