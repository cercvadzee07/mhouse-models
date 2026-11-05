import { pick, localePath, type Locale } from "@/i18n/config";
import type { Dictionary } from "@/i18n/get-dictionary";
import type { Service } from "@/lib/types";
import { mediaUrl } from "@/lib/storage";
import { Reveal } from "../Reveal";
import { SectionLabel } from "../SectionLabel";
import { ServiceList } from "./ServiceList";

export function Services({ locale, t, services }: { locale: Locale; t: Dictionary; services: Service[] }) {
  const items = services.map((s) => ({
    id: s.id,
    title: pick(s, "title", locale),
    description: pick(s, "description", locale),
    image: mediaUrl(s.image_path) ?? s.image_external_url,
  }));

  return (
    <section id="services" aria-labelledby="services-title" className="section-y bg-bone/60">
      <div className="container-x">
        <div className="grid-12 gap-y-8">
          <div className="col-span-12 lg:col-span-5">
            <SectionLabel index="02" label={t.services.label} />
          </div>
          <Reveal className="col-span-12 lg:col-span-7">
            <h2 id="services-title" className="display-lg text-balance">
              {t.services.title}
            </h2>
          </Reveal>
        </div>
        <ServiceList items={items} discussLabel={t.services.discuss} contactHref={localePath(locale, "/#contact")} />
      </div>
    </section>
  );
}
