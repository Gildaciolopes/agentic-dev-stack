import type { Metadata } from "next";
import { hasLocale } from "next-intl";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { ArchitectureTeaser, SectionArchitecture } from "@/components/architecture";
import {
  Cta,
  Faq,
  faqItems,
  Hero,
  PillarFreeModels,
  PillarHermes,
  PillarOneCommand,
  PillarOrchestration,
  PillarSdd,
  PillarSecurity,
  PillarTokens,
  Stats,
  TerminalReplay,
  ToolsBand,
  Why,
} from "@/components/landing";
import { LazyTokenFunnel } from "@/components/three/lazy";
import { routing } from "@/i18n/routing";
import { JsonLd, faqPage } from "@/lib/jsonld";
import { buildMetadata } from "@/lib/seo";

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  const { locale } = await params;
  if (!hasLocale(routing.locales, locale)) return {};
  const t = await getTranslations({ locale, namespace: "seo" });
  return buildMetadata({ locale, path: "/", description: t("description"), og: "home" });
}

export default async function Home({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  return (
    <main id="main">
      <Hero teaser={<ArchitectureTeaser />} />
      <ToolsBand />
      <Stats />
      <Why />
      <SectionArchitecture />
      <PillarOrchestration />
      <PillarSdd />
      <PillarTokens visual={<LazyTokenFunnel />} />
      <PillarFreeModels />
      <PillarSecurity />
      <PillarHermes />
      <PillarOneCommand />
      <TerminalReplay />
      <Faq />
      <Cta />
      <JsonLd data={faqPage(faqItems)} />
    </main>
  );
}
