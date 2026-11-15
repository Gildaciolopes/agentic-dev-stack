import { NotFoundView } from "@/components/site/not-found-view";
import { routing } from "@/i18n/routing";
import { mono } from "@/lib/fonts";
import "./globals.css";

/** Root 404 (no locale layout above it): own <html>, default locale, no redirect. */
export default function RootNotFound() {
  return (
    <html lang={routing.defaultLocale} className={`${mono.variable} dark`}>
      <body>
        <NotFoundView locale={routing.defaultLocale} homeHref="/" />
      </body>
    </html>
  );
}
