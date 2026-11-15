import type { Metadata } from "next";
import { hasLocale } from "next-intl";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { notFound } from "next/navigation";
import { routing } from "@/i18n/routing";
import { buildMetadata } from "@/lib/seo";

type Props = { params: Promise<{ locale: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale } = await params;
  if (!hasLocale(routing.locales, locale)) return {};
  const t = await getTranslations({ locale, namespace: "seo" });
  return buildMetadata({ locale, path: "/architecture", title: t("architecture.title"), description: t("architecture.description") });
}

/** Placeholder so the route exists; the architecture section replaces this. */
export default async function ArchitecturePage({ params }: Props) {
  const { locale } = await params;
  if (!hasLocale(routing.locales, locale)) notFound();
  setRequestLocale(locale);
  const t = await getTranslations("seo");
  return (
    <main id="main" className="container-site section">
      <h1 className="text-display">{t("architecture.heading")}</h1>
    </main>
  );
}
