import { getTranslations } from "next-intl/server";
import { Pet } from "@/components/fluid/pet/Pet";
import { btnPrimary } from "./button-styles";

/** Shared 404 body: surprised Pet, message, link home. Plain anchor, no redirect. */
export async function NotFoundView({ locale, homeHref }: { locale: string; homeHref: string }) {
  const t = await getTranslations({ locale, namespace: "shell" });
  return (
    <main id="main" className="container-site section flex min-h-[70dvh] flex-col items-center justify-center gap-6 text-center">
      <div style={{ width: 140, height: 140 }}>
        <Pet mood="surprised" follow label={t("notFound.pet")} />
      </div>
      <h1 className="text-h2">{t("notFound.title")}</h1>
      <p className="max-w-prose text-muted-foreground">{t("notFound.body")}</p>
      <a href={homeHref} className={btnPrimary}>
        {t("notFound.home")}
      </a>
    </main>
  );
}
