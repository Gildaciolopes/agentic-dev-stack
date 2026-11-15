import { getLocale } from "next-intl/server";
import type { Locale } from "@/i18n/routing";
import { NotFoundView } from "@/components/site/not-found-view";
import { localePath } from "@/lib/seo";

export default async function LocaleNotFound() {
  const locale = await getLocale();
  return <NotFoundView locale={locale} homeHref={localePath(locale as Locale, "/")} />;
}
