import type { Metadata } from "next";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { hasLocale } from "next-intl";
import { Link } from "@/i18n/navigation";
import { routing, type Locale } from "@/i18n/routing";
import { JsonLd, breadcrumbList } from "@/lib/jsonld";
import { absoluteUrl, buildMetadata } from "@/lib/seo";
import { docsBreadcrumbs, listDocs } from "@/lib/docs";
import { Breadcrumb } from "@/components/docs/Breadcrumb";

type Props = { params: Promise<{ locale: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale } = await params;
  if (!hasLocale(routing.locales, locale)) return {};
  const t = await getTranslations({ locale, namespace: "docs" });
  return buildMetadata({ locale, path: "/docs", title: t("index.title"), description: t("index.description"), og: "docs" });
}

export default async function DocsIndex({ params }: Props) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations("docs");
  const docs = await listDocs();
  const crumbs = docsBreadcrumbs({ home: t("home"), docs: t("docs") });
  return (
    <>
      <JsonLd data={breadcrumbList(crumbs.map((c) => ({ name: c.name, url: absoluteUrl(locale as Locale, c.href) })))} />
      <Breadcrumb items={crumbs} label={t("breadcrumbLabel")} />
      <p className="section-label">{t("index.eyebrow")}</p>
      <h1 className="mt-3 text-display">{t("index.title")}</h1>
      <p className="mt-4 max-w-[60ch] text-muted-foreground">{t("index.description")}</p>
      <ul className="mt-12 grid gap-px border border-border bg-border sm:grid-cols-2 lg:grid-cols-3">
        {docs.map((d) => (
          <li key={d.slug} className="bg-background">
            <Link href={`/docs/${d.slug}`} className="group flex h-full flex-col gap-3 bg-card p-6 hover:bg-band">
              <span className="text-label uppercase tracking-widest text-subtle-foreground">{d.number}</span>
              <h2 className="text-h3 group-hover:underline group-hover:underline-offset-4">{d.title}</h2>
              <p className="text-small text-muted-foreground">{d.description}</p>
            </Link>
          </li>
        ))}
      </ul>
    </>
  );
}
