import { getTranslations } from "next-intl/server";
import { InstallCommand } from "@/components/ui/install-command";
import { SectionHeader } from "@/components/ui/section-header";
import { site } from "@/lib/site";
import { DoctorDemoWithToast } from "./doctor-demo-with-toast.client";

type Way = { what: string; cmd: string };
type Platform = { os: string; support: string };

export async function PillarOneCommand() {
  const t = await getTranslations("landing-b.one");
  const other = t.raw("other") as Way[];
  const platforms = t.raw("platforms") as Platform[];
  const otherHead = t.raw("otherHead") as string[];
  const platformsHead = t.raw("platformsHead") as string[];

  return (
    <section id="install" aria-label={t("label")} className="section">
      <div className="container-site flex flex-col gap-16">
        <SectionHeader index={t("index")} label={t("label")} title={t("title")} intro={t("intro")} />

        <InstallCommand command={site.install} copyLabel={t("copy")} copiedLabel={t("copied")} />

        <div className="grid gap-12 lg:grid-cols-2 lg:gap-16">
          <div className="flex min-w-0 flex-col gap-4">
            <h3 className="text-h3 font-bold">{t("otherTitle")}</h3>
            <div className="overflow-x-auto" tabIndex={0} role="region" aria-label={t("otherTitle")}>
              <table className="w-full border-collapse text-left text-small">
                <thead>
                  <tr className="border-b border-foreground">
                    {otherHead.map((h) => (
                      <th key={h} scope="col" className="py-2 pr-4 text-[length:var(--text-label)] font-normal uppercase tracking-widest text-muted-foreground">
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {other.map((w) => (
                    <tr key={w.what} className="border-b border-border align-top">
                      <th scope="row" className="py-3 pr-4 font-normal">
                        {w.what}
                      </th>
                      <td className="py-3">
                        <code className="break-words text-link">{w.cmd}</code>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          <div className="flex min-w-0 flex-col gap-4">
            <h3 className="text-h3 font-bold">{t("platformsTitle")}</h3>
            <table className="w-full border-collapse text-left text-small">
              <thead>
                <tr className="border-b border-foreground">
                  {platformsHead.map((h) => (
                    <th key={h} scope="col" className="py-2 pr-4 text-[length:var(--text-label)] font-normal uppercase tracking-widest text-muted-foreground">
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {platforms.map((p) => (
                  <tr key={p.os} className="border-b border-border align-top">
                    <th scope="row" className="py-3 pr-4 font-bold">
                      {p.os}
                    </th>
                    <td className="py-3 text-muted-foreground">{p.support}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            <p className="text-small text-muted-foreground">{t("prereq")}</p>
          </div>
        </div>

        <div className="flex flex-col gap-4">
          <h3 className="text-h3 font-bold">{t("doctor.title")}</h3>
          <p className="max-w-3xl text-muted-foreground">{t("doctor.intro")}</p>
          <DoctorDemoWithToast />
        </div>
      </div>
    </section>
  );
}
