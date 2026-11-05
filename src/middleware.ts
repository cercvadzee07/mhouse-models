import { NextResponse, type NextRequest } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { defaultLocale, locales } from "@/i18n/config";
import { ACCESS_COOKIE, ACCESS_PATH, accessPassword, accessToken, safeEqual } from "@/lib/site-access";

const PUBLIC_ADMIN_PATHS = ["/admin/login", "/admin/forgot-password", "/admin/reset-password", "/admin/auth"];

async function handleAdmin(request: NextRequest) {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  // Not configured yet: the admin layout renders setup instructions.
  if (!url || !key) return NextResponse.next();

  let response = NextResponse.next({ request });
  const supabase = createServerClient(url, key, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet) {
        cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
        response = NextResponse.next({ request });
        cookiesToSet.forEach(({ name, value, options }) => response.cookies.set(name, value, options));
      },
    },
  });

  // Refreshes the session cookie if needed and validates the JWT with Supabase Auth.
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const path = request.nextUrl.pathname;
  const isPublic = PUBLIC_ADMIN_PATHS.some((p) => path === p || path.startsWith(`${p}/`));
  if (!user && !isPublic) {
    const login = request.nextUrl.clone();
    login.pathname = "/admin/login";
    login.search = path !== "/admin" ? `?next=${encodeURIComponent(path)}` : "";
    return NextResponse.redirect(login);
  }
  // Note: role (admin/editor) is enforced server-side in the admin layout,
  // every server action, and by Row Level Security in the database.
  return response;
}

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  if (pathname === "/admin" || pathname.startsWith("/admin/")) {
    return handleAdmin(request);
  }

  // Private preview: require the site password (only when SITE_ACCESS_PASSWORD is set).
  const password = accessPassword();
  if (password) {
    if (pathname === ACCESS_PATH) {
      const res = NextResponse.next();
      res.headers.set("X-Robots-Tag", "noindex, nofollow");
      return res;
    }
    const cookie = request.cookies.get(ACCESS_COOKIE)?.value ?? "";
    if (!safeEqual(cookie, await accessToken(password))) {
      const url = request.nextUrl.clone();
      url.pathname = ACCESS_PATH;
      url.search = pathname !== "/" ? `?next=${encodeURIComponent(pathname + request.nextUrl.search)}` : "";
      const res = NextResponse.redirect(url);
      res.headers.set("X-Robots-Tag", "noindex, nofollow");
      return res;
    }
  } else if (pathname === ACCESS_PATH) {
    return NextResponse.redirect(new URL("/", request.url));
  }

  // /ka/... → canonical unprefixed URL
  if (pathname === `/${defaultLocale}` || pathname.startsWith(`/${defaultLocale}/`)) {
    const url = request.nextUrl.clone();
    url.pathname = pathname.slice(defaultLocale.length + 1) || "/";
    return NextResponse.redirect(url, 308);
  }

  const prefixed = locales.find((l) => pathname === `/${l}` || pathname.startsWith(`/${l}/`));
  const requestHeaders = new Headers(request.headers);
  requestHeaders.set("x-locale", prefixed ?? defaultLocale);
  if (prefixed) return NextResponse.next({ request: { headers: requestHeaders } });

  // Georgian is the default: rewrite internally to /ka/...
  const url = request.nextUrl.clone();
  url.pathname = `/${defaultLocale}${pathname === "/" ? "" : pathname}`;
  return NextResponse.rewrite(url, { request: { headers: requestHeaders } });
}

export const config = {
  // Skip Next internals, API routes, metadata image routes and files with an extension.
  matcher: ["/((?!_next/|api/|opengraph-image|twitter-image|.*\\..*).*)"],
};
