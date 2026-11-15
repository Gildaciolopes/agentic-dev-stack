import { getTranslations } from "next-intl/server";
import { SectionHeader } from "@/components/ui/section-header";
import { ArchitectureFigure } from "./ArchitectureFigure";

/** Landing page section 01. */
export async function SectionArchitecture() {
  const t = await getTranslations("architecture.section");
  return (
    <section id="architecture" className="section">
      <div className="container-site flex flex-col gap-12">
        <SectionHeader index={t("index")} label={t("label")} title={t("title")} intro={t("intro")} />
        <ArchitectureFigure />
      </div>
    </section>
  );
}
