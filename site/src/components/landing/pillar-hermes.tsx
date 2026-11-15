import { getTranslations } from "next-intl/server";
import { SectionHeader } from "@/components/ui/section-header";
import { PhoneChat } from "./phone-chat.client";

export async function PillarHermes() {
  const t = await getTranslations("landing-b.hermes");
  const digest = t.raw("digest") as string[];
  const recipes = t.raw("recipes") as string[];

  return (
    <section id="hermes" aria-label={t("label")} className="section bg-band">
      <div className="container-site flex flex-col gap-16">
        <SectionHeader index={t("index")} label={t("label")} title={t("title")} intro={t("intro")} />

        <div className="grid grid-cols-1 items-start gap-12 lg:grid-cols-2 lg:gap-16">
          <div className="flex flex-col gap-10">
            <div className="flex flex-col gap-4">
              <h3 className="text-h3 font-bold">{t("digestTitle")}</h3>
              <p className="text-muted-foreground">{t("digestIntro")}</p>
              <ol className="flex flex-col gap-2">
                {digest.map((d, i) => (
                  <li key={d} className="flex gap-4 border border-border bg-card p-4">
                    <span aria-hidden className="font-bold text-link">
                      {String(i + 1).padStart(2, "0")}
                    </span>
                    <span>{d}</span>
                  </li>
                ))}
              </ol>
              <p className="text-small text-muted-foreground">{t("safe")}</p>
            </div>

            <div className="flex flex-col gap-4">
              <h3 className="text-h3 font-bold">{t("recipesTitle")}</h3>
              <ul className="flex flex-wrap gap-2">
                {recipes.map((r) => (
                  <li key={r} className="min-h-11 border border-foreground/40 px-4 py-2 text-small">
                    {r}
                  </li>
                ))}
              </ul>
            </div>
          </div>

          <PhoneChat />
        </div>
      </div>
    </section>
  );
}
