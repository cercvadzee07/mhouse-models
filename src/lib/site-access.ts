/**
 * Optional private-preview gate for the public website.
 *
 * Set SITE_ACCESS_PASSWORD (server-side env var) to require a password before
 * anyone can see the site. Remove it to make the site public. The admin panel
 * (/admin) is unaffected — it always has its own login.
 *
 * Edge-compatible (Web Crypto), so it can run in middleware.
 */
export const ACCESS_COOKIE = "site_access";
export const ACCESS_PATH = "/access";

export function accessPassword(): string | null {
  const p = process.env.SITE_ACCESS_PASSWORD?.trim();
  return p ? p : null;
}

/** Cookie value derived from the password — changing the password signs everyone out. */
export async function accessToken(password: string): Promise<string> {
  const data = new TextEncoder().encode(`mhouse-site-access:v1:${password}`);
  const digest = await crypto.subtle.digest("SHA-256", data);
  return Array.from(new Uint8Array(digest), (b) => b.toString(16).padStart(2, "0")).join("");
}

/** Constant-time string comparison. */
export function safeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}
