import { getFormatter, getTranslations } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import { site } from "@/lib/site";
import { GithubIcon, LogoMark } from "./icons";

const link = "inline-flex min-h-8 items-center text-sm text-muted-foreground transition-colors hover:text-foreground";

export async function Footer() {
  const t = await getTranslations("shell.footer");
  const format = await getFormatter();
  const year = format.dateTime(new Date(), { year: "numeric" });
  const blob = (file: string) => `${site.repo}/blob/main/${file}`;

  const columns = [
    {
      title: t("docs"),
      items: [
        { label: t("guide"), href: "/docs/00-smart-vibe-coding" },
        { label: t("architecture"), href: "/docs/01-architecture" },
        { label: t("installation"), href: "/docs/02-installation" },
      ],
    },
    {
      title: t("project"),
      items: [
        { label: t("github"), href: site.repo, external: true },
        { label: t("npm"), href: site.npm, external: true },
        { label: t("changelog"), href: "/changelog" },
        { label: t("license"), href: blob("LICENSE"), external: true },
      ],
    },
    {
      title: t("community"),
      items: [
        { label: t("issues"), href: `${site.repo}/issues`, external: true },
        { label: t("contributing"), href: blob("CONTRIBUTING.md"), external: true },
        { label: t("security"), href: blob("SECURITY.md"), external: true },
      ],
    },
  ];

  return (
    <footer className="border-t border-border bg-band">
      <div className="container-site grid gap-12 py-16 md:grid-cols-[1.4fr_repeat(3,1fr)]">
        <div className="flex flex-col gap-4">
          <div className="flex items-center gap-2.5 font-bold">
            <LogoMark size={28} />
            <span className="text-sm">{site.name}</span>
          </div>
          <p className="max-w-xs text-sm text-muted-foreground">{t("pitch")}</p>
          <a
            href={site.repo}
            target="_blank"
            rel="noopener noreferrer"
            aria-label={t("githubAria")}
            className="inline-flex size-11 items-center justify-center text-muted-foreground transition-colors hover:text-foreground"
          >
            <GithubIcon size={22} />
          </a>
        </div>
        {columns.map((col) => (
          <nav key={col.title} aria-label={col.title}>
            <h2 className="section-label mb-3 text-label font-normal">{col.title}</h2>
            <ul className="flex flex-col">
              {col.items.map((item) => (
                <li key={item.label}>
                  {"external" in item ? (
                    <a href={item.href} target="_blank" rel="noopener noreferrer" className={link}>
                      {item.label}
                    </a>
                  ) : (
                    <Link href={item.href} className={link}>
                      {item.label}
                    </Link>
                  )}
                </li>
              ))}
            </ul>
          </nav>
        ))}
      </div>
      <div className="border-t border-border">
        <p className="container-site py-6 text-label text-muted-foreground">{t("copyright", { year })}</p>
      </div>
    </footer>
  );
}
