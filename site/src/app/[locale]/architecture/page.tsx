import type { Metadata } from "next";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { ArchitectureFigure } from "@/components/architecture/ArchitectureFigure";
import { SectionHeader } from "@/components/ui/section-header";

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "architecture.page" });
  return { title: t("label"), description: t("description") };
}

export default async function ArchitecturePage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations("architecture.page");
  return (
    <main id="main" className="container-site section flex flex-col gap-12">
      <SectionHeader index={t("index")} label={t("label")} title={t("title")} titleAs="h1" />
      <ArchitectureFigure />
    </main>
  );
}
