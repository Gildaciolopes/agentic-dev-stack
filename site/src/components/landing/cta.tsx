import { getTranslations } from "next-intl/server";
import { Button } from "@/components/ui/button";
import { InstallCommand } from "@/components/ui/install-command";
import { RevealHeading } from "@/components/ui/reveal-heading";
import { logo } from "@/lib/logo";
import { site } from "@/lib/site";

export async function Cta() {
  const t = await getTranslations("landing-b.cta");

  return (
    <section id="start" aria-label={t("start")}>
      <div className="section">
        <div className="container-site flex flex-col gap-10">
          <RevealHeading text={t("title")} className="text-display max-w-3xl" />
          <p className="max-w-[60ch] text-muted-foreground">{t("line")}</p>
          <InstallCommand command={site.install} copyLabel={t("copy")} copiedLabel={t("copied")} className="max-w-xl" />
          <div className="flex flex-wrap gap-3">
            <Button size="lg" href="/docs/02-installation">
              {t("start")}
            </Button>
            <Button size="lg" variant="secondary" href={site.repo}>
              {t("github")}
            </Button>
          </div>
        </div>
      </div>

      {/* The page's one light moment: black on cyan is 12.14:1 (DESIGN.md section 3). */}
      <div className="w-full bg-[linear-gradient(135deg,#05d7fd_0%,#03c3fb_100%)] text-black">
        <div className="container-site grid items-center gap-10 py-[clamp(48px,8vw,112px)] md:grid-cols-[auto_1fr] md:gap-16">
          <svg viewBox="0 0 120 120" role="img" aria-label={t("panelLabel")} className="mx-auto w-[clamp(160px,32vw,360px)]">
            <path d={logo} fill="#000" />
          </svg>
          <p className="max-w-[48ch] text-h3 font-bold leading-relaxed">{t("panelText")}</p>
        </div>
      </div>
    </section>
  );
}
