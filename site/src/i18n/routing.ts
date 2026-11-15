import { defineRouting } from "next-intl/routing";

/**
 * Add a language: drop `messages/<locale>.json` next to `en.json`
 * and add the locale here. Nothing else changes.
 */
export const locales = ["en"] as const;
export type Locale = (typeof locales)[number];

export const localeNames: Record<Locale, string> = { en: "English" };
/** Short label used by the locale switcher (EN/PT style). */
export const localeShort: Record<Locale, string> = { en: "EN" };
/** BCP-47 tag for hreflang and Intl formatting. */
export const localeTags: Record<Locale, string> = { en: "en-US" };

export const routing = defineRouting({
  locales,
  defaultLocale: "en",
  localePrefix: "as-needed",
});
