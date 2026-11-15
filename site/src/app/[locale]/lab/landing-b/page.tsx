import type { Metadata } from "next";
import { setRequestLocale } from "next-intl/server";
import { Cta } from "@/components/landing/cta";
import { Faq } from "@/components/landing/faq";
import { PillarFreeModels } from "@/components/landing/pillar-free-models";
import { PillarHermes } from "@/components/landing/pillar-hermes";
import { PillarOneCommand } from "@/components/landing/pillar-one-command";
import { PillarSecurity } from "@/components/landing/pillar-security";
import { TerminalReplay } from "@/components/landing/terminal-replay";

export const metadata: Metadata = { title: "Landing B (preview)", robots: { index: false, follow: false } };

export default async function LandingBLab({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  return (
    <main id="main">
      <PillarFreeModels />
      <PillarSecurity />
      <PillarHermes />
      <PillarOneCommand />
      <TerminalReplay />
      <Faq />
      <Cta />
    </main>
  );
}
