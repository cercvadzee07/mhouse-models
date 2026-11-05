import type { Locale } from "./config";
import ka from "./dictionaries/ka";
import en from "./dictionaries/en";
import type { Dictionary } from "./dictionaries/ka";

const dictionaries: Record<Locale, Dictionary> = { ka, en };

export function getDictionary(locale: Locale): Dictionary {
  return dictionaries[locale] ?? ka;
}

export type { Dictionary };
