import { getTranslations } from "next-intl/server";
import { GradFrameCard } from "@/components/ui/grad-frame-card";
import { SectionHeader } from "@/components/ui/section-header";
import { SecretTerminal } from "./secret-terminal.client";

const CARDS = [
  { key: "kernel", tone: "warm" },
  { key: "hermes", tone: "cool" },
  { key: "pinned", tone: "mint" },
] as const;

export async function PillarSecurity() {
  const t = await getTranslations("landing-b.security");

  return (
    <section id="security" aria-label={t("label")} className="section">
      <div className="container-site flex flex-col gap-16">
        <SectionHeader index={t("index")} label={t("label")} title={t("title")} intro={t("intro")} />

        <div className="grid gap-6 lg:grid-cols-3">
          {CARDS.map(({ key, tone }) => {
            const points = t.raw(`cards.${key}.points`) as string[];
            return (
              <GradFrameCard key={key} tone={tone}>
                <p className="text-[length:var(--text-label)] uppercase tracking-widest text-black/70">{t(`cards.${key}.tag`)}</p>
                <h3 className="mt-3 text-h3 font-bold">{t(`cards.${key}.title`)}</h3>
                <p className="mt-3 text-small text-black/80">{t(`cards.${key}.body`)}</p>
                <ul className="mt-5 flex flex-col gap-1 border-t border-black/20 pt-4 text-small font-bold">
                  {points.map((p) => (
                    <li key={p}>{p}</li>
                  ))}
                </ul>
              </GradFrameCard>
            );
          })}
        </div>

        <aside className="border border-border bg-card p-6">
          <h3 className="text-h3 font-bold">{t("guard.title")}</h3>
          <p className="mt-2 text-muted-foreground">{t("guard.body")}</p>
        </aside>

        <div className="grid gap-8 lg:grid-cols-[minmax(0,2fr)_minmax(0,3fr)] lg:gap-16">
          <div className="flex flex-col gap-4">
            <h3 className="text-h3 font-bold">{t("terminal.title")}</h3>
            <p className="text-muted-foreground">{t("terminal.intro")}</p>
            <p className="text-small text-muted-foreground">{t("terminal.illustration")}</p>
            <p className="text-small text-muted-foreground">{t("terminal.linuxNote")}</p>
          </div>
          <SecretTerminal />
        </div>
      </div>
    </section>
  );
}
