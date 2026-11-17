import type { Metadata } from "next";
import { getFormatter, getTranslations, setRequestLocale } from "next-intl/server";
import { hasLocale } from "next-intl";
import { routing, type Locale } from "@/i18n/routing";
import { JsonLd, breadcrumbList } from "@/lib/jsonld";
import { absoluteUrl, buildMetadata } from "@/lib/seo";
import { getChangelog } from "@/lib/docs";
import { Breadcrumb } from "@/components/docs/Breadcrumb";
import "@/styles/prose.css";

type Props = { params: Promise<{ locale: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale } = await params;
  if (!hasLocale(routing.locales, locale)) return {};
  const t = await getTranslations({ locale, namespace: "docs" });
  return buildMetadata({ locale, path: "/changelog", title: t("changelogPage.title"), description: t("changelogPage.description"), og: "docs" });
}

export default async function ChangelogPage({ params }: Props) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations("docs");
  const format = await getFormatter();
  const crumbs = [
    { name: t("home"), href: "/" },
    { name: t("changelog"), href: "/changelog" },
  ];
  const { intro, entries } = await getChangelog(locale as Locale);
  return (
    <main id="main" className="container-site pb-24 pt-[calc(var(--nav-h)+52px)]">
      <JsonLd data={breadcrumbList(crumbs.map((c) => ({ name: c.name, url: absoluteUrl(locale as Locale, c.href) })))} />
      <Breadcrumb items={crumbs} label={t("breadcrumbLabel")} />
      <h1 className="text-display">{t("changelogPage.title")}</h1>
      <div className="prose mt-6" dangerouslySetInnerHTML={{ __html: intro }} />
      <p className="mt-4 text-small">
        <a href="/changelog.md" className="text-link underline underline-offset-4">
          {t("changelogPage.viewMarkdown")}
        </a>
      </p>
      <div className="mt-12 max-w-[78ch]">
        {entries.map((e) => (
          <section key={e.id} id={e.id} aria-labelledby={`${e.id}-h`} className="border-t border-border py-10">
            <h2 id={`${e.id}-h`} className="flex flex-wrap items-baseline gap-x-4 text-h3">
              <a href={`#${e.id}`} className="hover:underline">
                {e.version === "Unreleased" ? t("changelogPage.unreleased") : `v${e.version}`}
              </a>
              {e.date && (
                <time dateTime={e.date} className="text-small font-normal text-muted-foreground">
                  {format.dateTime(new Date(`${e.date}T00:00:00Z`), { dateStyle: "long", timeZone: "UTC" })}
                </time>
              )}
            </h2>
            <div className="prose mt-4" dangerouslySetInnerHTML={{ __html: e.html }} />
          </section>
        ))}
      </div>
    </main>
  );
}
