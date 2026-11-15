import type { ReactNode } from "react";
import { getTranslations } from "next-intl/server";
import { Button } from "@/components/ui/button";
import { HeroCycle, HeroInstall, HeroMark } from "./hero.client";
import { IsoScene } from "./iso-scene";

export async function Hero({ teaser }: { teaser?: ReactNode }) {
  const t = await getTranslations("landing-a.hero");
  return (
    <section id="top" aria-labelledby="hero-title" className="relative overflow-hidden pb-16 pt-32 md:pb-24 md:pt-40">
      <IsoScene side="left" className="pointer-events-none absolute left-0 top-12 hidden w-[clamp(180px,22vw,320px)] lg:block" />
      <IsoScene side="right" className="pointer-events-none absolute right-0 top-12 hidden w-[clamp(180px,22vw,320px)] lg:block" />
      <div className="container-site relative flex flex-col items-center gap-8 text-center">
        <HeroMark label={t("logoLabel")} />
        <h1 id="hero-title" className="text-display max-w-4xl font-bold text-balance">
          {t("title")}
        </h1>
        <HeroCycle lead={t("madeFor")} words={t.raw("words") as string[]} />
        <p className="max-w-2xl text-muted-foreground text-pretty">{t("sub")}</p>
        <div className="flex flex-wrap items-center justify-center gap-3">
          <Button size="lg" href="/docs/02-installation">
            {t("ctaPrimary")}
          </Button>
          <Button size="lg" variant="secondary" href="/docs">
            {t("ctaSecondary")}
          </Button>
        </div>
        <HeroInstall command={t("command")} copyLabel={t("copy")} copiedLabel={t("copied")} petLabel={t("petLabel")} />
        <p className="text-small text-subtle-foreground">{t("installNote")}</p>
        {teaser ? <div className="mt-8 w-full">{teaser}</div> : null}
      </div>
    </section>
  );
}
