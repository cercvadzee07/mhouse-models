import Link from "next/link";
import { headers } from "next/headers";
import { getDictionary } from "@/i18n/get-dictionary";

export default async function NotFound() {
  // not-found.tsx does not receive params; infer the language from the URL.
  const h = await headers();
  const locale = h.get("x-locale") === "en" ? "en" : "ka";
  const t = getDictionary(locale);
  return (
    <section className="container-x flex min-h-[80svh] flex-col justify-center pt-[var(--header-h)]">
      <p className="eyebrow text-concrete">404</p>
      <h1 className="display-xl mt-6">{t.common.notFoundTitle}</h1>
      <p className="lead mt-6 max-w-lg text-graphite">{t.common.notFoundBody}</p>
      <Link href={locale === "en" ? "/en" : "/"} className="btn btn-solid mt-10 self-start">
        {t.common.home}
      </Link>
    </section>
  );
}
