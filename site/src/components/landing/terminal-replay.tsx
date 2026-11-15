import { getTranslations } from "next-intl/server";
import { SectionHeader } from "@/components/ui/section-header";
import { TerminalReplayPlayer } from "./terminal-replay.client";

export async function TerminalReplay() {
  const t = await getTranslations("landing-b.replay");
  return (
    <section id="wizard" aria-label={t("label")} className="section bg-band">
      <div className="container-site flex flex-col gap-12">
        <SectionHeader index={t("index")} label={t("label")} title={t("title")} intro={t("intro")} />
        <TerminalReplayPlayer />
      </div>
    </section>
  );
}
