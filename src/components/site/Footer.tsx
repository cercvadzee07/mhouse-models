import Link from "next/link";
import { localePath, pick, type Locale } from "@/i18n/config";
import type { Dictionary } from "@/i18n/get-dictionary";
import type { SiteContent } from "@/lib/types";
import { socialLinks, telHref, whatsappHref } from "@/lib/contact-links";
import { Wordmark } from "./Wordmark";
import { SocialIcon } from "./SocialIcon";

export function Footer({
  locale,
  t,
  content,
  hasDemo,
}: {
  locale: Locale;
  t: Dictionary;
  content: SiteContent;
  hasDemo: boolean;
}) {
  const { contact, general, studio } = content;
  const year = new Date().getFullYear();
  const tel = telHref(contact.phone);
  const wa = whatsappHref(contact.whatsapp);
  const socials = socialLinks(contact);

  return (
    <footer className="bg-ink text-paper">
      <div className="container-x grid-12 gap-y-14 pb-10 pt-20 md:pt-28">
        <div className="col-span-12 md:col-span-5">
          <Wordmark general={general} href={localePath(locale, "/")} inverted />
          <p className="mt-6 max-w-sm text-sm leading-relaxed text-paper/60">{pick(studio, "description", locale)}</p>
        </div>

        <nav aria-label="Footer" className="col-span-6 md:col-span-3">
          <p className="eyebrow mb-5 text-paper/40">{t.nav.menu}</p>
          <ul className="space-y-3 text-sm">
            <li><Link className="link-underline" href={localePath(locale, "/#studio")}>{t.nav.studio}</Link></li>
            <li><Link className="link-underline" href={localePath(locale, "/#services")}>{t.nav.services}</Link></li>
            <li><Link className="link-underline" href={localePath(locale, "/projects")}>{t.nav.work}</Link></li>
            <li><Link className="link-underline" href={localePath(locale, "/#contact")}>{t.nav.contact}</Link></li>
          </ul>
        </nav>

        <div className="col-span-6 md:col-span-4">
          <p className="eyebrow mb-5 text-paper/40">{t.contact.direct}</p>
          <ul className="space-y-3 text-sm">
            {contact.email && (
              <li><a className="link-underline" href={`mailto:${contact.email}`}>{contact.email}</a></li>
            )}
            {tel && contact.phone && (
              <li><a className="link-underline" href={tel}>{contact.phone}</a></li>
            )}
            {wa && (
              <li><a className="link-underline" href={wa} target="_blank" rel="noopener noreferrer">WhatsApp</a></li>
            )}
            {contact.show_address && pick(contact, "address", locale) && (
              <li className="text-paper/60">{pick(contact, "address", locale)}</li>
            )}
          </ul>
          {socials.length > 0 && (
            <ul className="mt-6 flex gap-3">
              {socials.map((s) => (
                <li key={s.name}>
                  <a
                    href={s.href}
                    target="_blank"
                    rel="noopener noreferrer"
                    aria-label={s.label}
                    className="flex h-10 w-10 items-center justify-center rounded-full border border-paper/20 transition-colors hover:border-paper hover:bg-paper hover:text-ink"
                  >
                    <SocialIcon name={s.name} />
                  </a>
                </li>
              ))}
            </ul>
          )}
        </div>

        <div className="col-span-12 flex flex-col gap-3 border-t border-paper/10 pt-8 text-xs text-paper/45 md:flex-row md:items-center md:justify-between">
          <p>
            © {year} {general.studio_name}. {t.footer.rights}
          </p>
          <p>{t.footer.tagline}</p>
          {hasDemo && <p>{t.footer.demoCredit}</p>}
        </div>
      </div>
    </footer>
  );
}
