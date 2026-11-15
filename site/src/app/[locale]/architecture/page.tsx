import type { Metadata } from "next";
import { hasLocale } from "next-intl";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { ArchitectureFigure } from "@/components/architecture/ArchitectureFigure";
import { SectionHeader } from "@/components/ui/section-header";
import { routing, type Locale } from "@/i18n/routing";
import { JsonLd, breadcrumbList } from "@/lib/jsonld";
import { absoluteUrl, buildMetadata } from "@/lib/seo";

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  const { locale } = await params;
  if (!hasLocale(routing.locales, locale)) return {};
  const t = await getTranslations({ locale, namespace: "architecture.page" });
  return buildMetadata({ locale, path: "/architecture", title: t("label"), description: t("description"), og: "architecture" });
}

export default async function ArchitecturePage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  const [t, docs] = await Promise.all([getTranslations("architecture.page"), getTranslations("docs")]);
  return (
    <main id="main" className="container-site section flex flex-col gap-12">
      <SectionHeader index={t("index")} label={t("label")} title={t("title")} titleAs="h1" />
      <ArchitectureFigure />
      <JsonLd
        data={breadcrumbList([
          { name: docs("home"), url: absoluteUrl(locale as Locale, "/") },
          { name: t("label"), url: absoluteUrl(locale as Locale, "/architecture") },
        ])}
      />
    </main>
  );
}
