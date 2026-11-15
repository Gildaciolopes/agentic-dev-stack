import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { Link, getPathname } from "@/i18n/navigation";
import { routing, type Locale } from "@/i18n/routing";
import { docsBreadcrumbs, editUrl, getAdjacentDocs, getDoc, getDocSlugs, listDocs } from "@/lib/docs";
import { site } from "@/lib/site";
import { Breadcrumb } from "@/components/docs/Breadcrumb";
import { DocsSidebar } from "@/components/docs/DocsSidebar";

type Props = { params: Promise<{ locale: string; slug: string }> };

export const dynamicParams = false;

export async function generateStaticParams() {
  const slugs = await getDocSlugs();
  return routing.locales.flatMap((locale) => slugs.map((slug) => ({ locale, slug })));
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale, slug } = await params;
  const doc = await getDoc(slug, locale as Locale);
  if (!doc) return {};
  return {
    title: `${doc.title} | ${site.name}`,
    description: doc.description,
    alternates: { canonical: getPathname({ locale: locale as Locale, href: `/docs/${slug}` }) },
  };
}

export default async function DocPage({ params }: Props) {
  const { locale, slug } = await params;
  setRequestLocale(locale);
  const doc = await getDoc(slug, locale as Locale);
  if (!doc) notFound();
  const t = await getTranslations("docs");
  const [docs, { prev, next }] = await Promise.all([listDocs(), getAdjacentDocs(slug)]);
  return (
    <>
      <Breadcrumb items={docsBreadcrumbs({ home: t("home"), docs: t("docs") }, doc)} label={t("breadcrumbLabel")} />
      <div className="grid gap-8 lg:grid-cols-[15rem_minmax(0,1fr)] lg:gap-12 xl:grid-cols-[15rem_minmax(0,1fr)_13rem]">
        <DocsSidebar docs={docs} current={slug} label={t("sidebar.label")} menuLabel={t("sidebar.menu")} />
        <article className="min-w-0">
          <div className="prose" dangerouslySetInnerHTML={{ __html: doc.html }} />
          <div className="mt-10 flex flex-wrap gap-x-6 gap-y-2 border-t border-border pt-6 text-small">
            <a href={editUrl(slug)} rel="noopener" className="text-link underline underline-offset-4">
              {t("editOnGithub")}
            </a>
            <a href={`/docs/${slug}.md`} className="text-link underline underline-offset-4">
              {t("viewMarkdown")}
            </a>
          </div>
          <nav aria-label={t("docs")} className="mt-8 grid gap-px border border-border bg-border sm:grid-cols-2">
            {prev ? (
              <Link href={`/docs/${prev.slug}`} rel="prev" className="bg-card p-5 hover:bg-band">
                <span className="section-label block">{t("previous")}</span>
                <span className="mt-1 block font-bold">{prev.title}</span>
              </Link>
            ) : (
              <span className="hidden bg-card sm:block" />
            )}
            {next && (
              <Link href={`/docs/${next.slug}`} rel="next" className="bg-card p-5 hover:bg-band sm:text-right">
                <span className="section-label block">{t("next")}</span>
                <span className="mt-1 block font-bold">{next.title}</span>
              </Link>
            )}
          </nav>
        </article>
        {doc.toc.length > 0 && (
          <aside className="hidden xl:block">
            <nav aria-label={t("toc")} className="sticky top-[calc(var(--nav-h)+24px)] max-h-[calc(100dvh-var(--nav-h)-48px)] overflow-y-auto text-label">
              <p className="section-label mb-3">{t("toc")}</p>
              <ul className="flex flex-col gap-2 border-l border-border">
                {doc.toc.map((item) => (
                  <li key={item.id} className={item.depth === 3 ? "pl-6" : "pl-3"}>
                    <a href={`#${item.id}`} className="block leading-snug text-muted-foreground hover:text-foreground">
                      {item.text}
                    </a>
                  </li>
                ))}
              </ul>
            </nav>
          </aside>
        )}
      </div>
    </>
  );
}
