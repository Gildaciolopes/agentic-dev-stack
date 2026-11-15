import { getTranslations } from "next-intl/server";
import { SectionHeader } from "@/components/ui/section-header";
import { WhyTable } from "./why.client";

export async function Why() {
  const t = await getTranslations("landing-a.why");
  return (
    <section id="why" className="section container-site flex flex-col gap-12">
      <SectionHeader index={t("index")} label={t("label")} title={t("title")} />
      <WhyTable caption={t("caption")} without={t("without")} with={t("with")} rows={t.raw("rows") as [string, string][]} />
    </section>
  );
}
