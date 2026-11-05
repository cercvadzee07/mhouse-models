"use client";

import { useEffect } from "react";
import { usePathname } from "next/navigation";
import { getDictionary } from "@/i18n/get-dictionary";

export default function Error({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  const pathname = usePathname() ?? "";
  const t = getDictionary(pathname.startsWith("/en") ? "en" : "ka");
  useEffect(() => {
    console.error(error);
  }, [error]);
  return (
    <section className="container-x flex min-h-[70svh] flex-col justify-center pt-[var(--header-h)]">
      <h1 className="display-lg">{t.common.error}</h1>
      <button type="button" onClick={reset} className="btn btn-solid mt-8 self-start">
        {t.common.retry}
      </button>
    </section>
  );
}
