import type { Metadata } from "next";
import { setRequestLocale } from "next-intl/server";
import { Hero, PillarOrchestration, PillarSdd, PillarTokens, Stats, ToolsBand, Why } from "@/components/landing";

export const metadata: Metadata = { title: "Landing A preview", robots: { index: false, follow: false } };

export default async function LandingAPreview({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  return (
    <main id="main">
      <Hero />
      <Stats />
      <ToolsBand />
      <Why />
      <PillarOrchestration />
      <PillarSdd />
      <PillarTokens />
    </main>
  );
}
