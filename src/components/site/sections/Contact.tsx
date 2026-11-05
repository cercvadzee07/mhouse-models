import { pick, type Locale } from "@/i18n/config";
import type { Dictionary } from "@/i18n/get-dictionary";
import type { ContactSettings } from "@/lib/types";
import { socialLinks, telHref, whatsappHref } from "@/lib/contact-links";
import { Reveal } from "../Reveal";
import { SectionLabel } from "../SectionLabel";
import { SocialIcon } from "../SocialIcon";
import { ContactForm } from "./ContactForm";

export function Contact({
  locale,
  t,
  contact,
  configured,
}: {
  locale: Locale;
  t: Dictionary;
  contact: ContactSettings;
  configured: boolean;
}) {
  const tel = telHref(contact.phone);
  const wa = whatsappHref(contact.whatsapp);
  const socials = socialLinks(contact);
  const address = contact.show_address ? pick(contact, "address", locale) : "";

  const rows = [
    contact.email && { label: t.contact.email, value: contact.email, href: `mailto:${contact.email}` },
    tel && contact.phone && { label: t.contact.phone, value: contact.phone, href: tel },
    wa && { label: t.contact.whatsapp, value: contact.whatsapp!, href: wa, external: true, icon: "whatsapp" as const },
    address && { label: t.contact.address, value: address },
  ].filter(Boolean) as { label: string; value: string; href?: string; external?: boolean; icon?: "whatsapp" }[];

  return (
    <section id="contact" aria-labelledby="contact-title" className="section-y relative bg-bone/70">
      <div className="container-x grid-12 gap-y-16">
        <div className="col-span-12 lg:col-span-5">
          <SectionLabel index="06" label={t.contact.label} />
          <Reveal>
            <h2 id="contact-title" className="display-lg mt-8 md:max-w-[14ch] text-balance">
              {t.contact.title}
            </h2>
          </Reveal>
          <Reveal delay={0.1}>
            <p className="lead mt-8 max-w-md text-graphite">{t.contact.intro}</p>
          </Reveal>

          {(rows.length > 0 || socials.length > 0) && (
            <div className="mt-14">
              <p className="eyebrow text-graphite">{t.contact.direct}</p>
              <dl className="mt-5 divide-y divide-ink/10 border-y hairline">
                {rows.map((r) => (
                  <div key={r.label} className="flex items-center justify-between gap-6 py-4">
                    <dt className="text-sm text-graphite">{r.label}</dt>
                    <dd className="text-right">
                      {r.href ? (
                        <a
                          href={r.href}
                          className="link-underline inline-flex items-center gap-2"
                          {...(r.external ? { target: "_blank", rel: "noopener noreferrer" } : {})}
                        >
                          {r.icon && <SocialIcon name={r.icon} />}
                          {r.value}
                        </a>
                      ) : (
                        r.value
                      )}
                    </dd>
                  </div>
                ))}
                {socials.length > 0 && (
                  <div className="flex items-center justify-between gap-6 py-4">
                    <dt className="text-sm text-graphite">{t.contact.social}</dt>
                    <dd className="flex gap-2">
                      {socials.map((s) => (
                        <a
                          key={s.name}
                          href={s.href}
                          target="_blank"
                          rel="noopener noreferrer"
                          aria-label={s.label}
                          className="flex h-10 w-10 items-center justify-center rounded-full border hairline transition-colors hover:border-ink hover:bg-ink hover:text-paper"
                        >
                          <SocialIcon name={s.name} />
                        </a>
                      ))}
                    </dd>
                  </div>
                )}
              </dl>
            </div>
          )}
        </div>

        <Reveal className="relative col-span-12 lg:col-span-6 lg:col-start-7" delay={0.1}>
          <div className="bg-paper p-6 shadow-[0_50px_100px_-60px_rgba(22,22,20,0.35)] sm:p-10 lg:p-12">
            <ContactForm locale={locale} t={t.contact} configured={configured} />
          </div>
        </Reveal>
      </div>
    </section>
  );
}
