"use client";

import { useLocale, useTranslations } from "next-intl";
import { SegmentedPicker } from "@/components/fluid/segmented-picker/SegmentedPicker";
import { usePathname, useRouter } from "@/i18n/navigation";
import { type Locale, localeNames, localeShort, locales } from "@/i18n/routing";

/** EN/PT-style switch. Renders nothing while only one locale exists. */
export function LocaleSwitcher() {
  const t = useTranslations("shell.locale");
  const current = useLocale() as Locale;
  const router = useRouter();
  const pathname = usePathname();
  const all: readonly Locale[] = locales;

  if (all.length < 2) return null;

  return (
    <SegmentedPicker<Locale>
      label={t("label")}
      value={current}
      onChange={(locale) => router.replace(pathname, { locale })}
      options={all.map((l) => ({ value: l, label: localeShort[l], ariaLabel: localeNames[l] }))}
    />
  );
}
