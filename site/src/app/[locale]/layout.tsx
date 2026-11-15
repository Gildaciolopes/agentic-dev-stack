import type { Metadata } from "next";
import type { ReactNode } from "react";
import { notFound } from "next/navigation";
import { hasLocale, NextIntlClientProvider } from "next-intl";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { ThemeProvider } from "next-themes";
import { routing } from "@/i18n/routing";
import { Footer } from "@/components/site/footer";
import { Nav } from "@/components/site/nav";
import { ToastProvider } from "@/components/site/toast";
import { TransitionProvider } from "@/components/site/transition-link";
import { mono } from "@/lib/fonts";
import { JsonLd, softwareApplication, softwareSourceCode, webSite } from "@/lib/jsonld";
import { buildMetadata, viewport as seoViewport } from "@/lib/seo";
import "../globals.css";

export function generateStaticParams() {
  return routing.locales.map((locale) => ({ locale }));
}

export const viewport = seoViewport;

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  const { locale } = await params;
  if (!hasLocale(routing.locales, locale)) return {};
  const t = await getTranslations({ locale, namespace: "seo" });
  // No `path`: pages set their own canonical + hreflang so none is inherited by mistake.
  return buildMetadata({ locale, description: t("description") });
}

export default async function LocaleLayout({ children, params }: { children: ReactNode; params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  if (!hasLocale(routing.locales, locale)) notFound();
  setRequestLocale(locale);
  const t = await getTranslations("shell");
  return (
    <html lang={locale} className={mono.variable} suppressHydrationWarning>
      <head>
        <noscript>
          <style>{"[data-reveal] *{opacity:1!important;filter:none!important;transform:none!important}"}</style>
        </noscript>
      </head>
      <body>
        <ThemeProvider attribute="class" defaultTheme="system" enableSystem disableTransitionOnChange>
          <NextIntlClientProvider>
            <ToastProvider>
              <TransitionProvider>
                <a
                  href="#main"
                  className="sr-only-focusable fixed left-4 top-4 z-[80] bg-background px-4 py-3 text-sm font-bold text-foreground outline-2 outline-offset-2 outline-ring"
                >
                  {t("skip")}
                </a>
                <div className="page-frame max-md:hidden" aria-hidden />
                <div className="page-frame page-frame--right max-md:hidden" aria-hidden />
                <Nav />
                {children}
                <Footer />
              </TransitionProvider>
            </ToastProvider>
          </NextIntlClientProvider>
        </ThemeProvider>
        <JsonLd data={[webSite(), softwareApplication(), softwareSourceCode()]} />
      </body>
    </html>
  );
}
