"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { ACCESS_COOKIE, accessPassword, accessToken, safeEqual } from "@/lib/site-access";

export async function unlockSite(_prev: { error: boolean }, formData: FormData): Promise<{ error: boolean }> {
  const password = accessPassword();
  const rawNext = String(formData.get("next") ?? "/");
  const next = rawNext.startsWith("/") && !rawNext.startsWith("//") && !rawNext.startsWith("/access") ? rawNext : "/";
  if (!password) redirect(next);

  const given = String(formData.get("password") ?? "");
  // Small fixed delay slows down guessing.
  await new Promise((r) => setTimeout(r, 600));
  if (!safeEqual(await accessToken(given), await accessToken(password))) return { error: true };

  (await cookies()).set(ACCESS_COOKIE, await accessToken(password), {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60 * 24 * 30,
  });
  redirect(next);
}
