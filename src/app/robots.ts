import type { MetadataRoute } from "next";
import { env } from "@/lib/env";
import { accessPassword } from "@/lib/site-access";

export const dynamic = "force-dynamic";

export default function robots(): MetadataRoute.Robots {
  // While the site is in private preview, ask search engines to stay away entirely.
  if (accessPassword()) return { rules: [{ userAgent: "*", disallow: "/" }] };
  return {
    rules: [{ userAgent: "*", allow: "/", disallow: ["/admin", "/api", "/access"] }],
    sitemap: `${env.siteUrl}/sitemap.xml`,
    host: env.siteUrl,
  };
}
