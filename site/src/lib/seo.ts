import type { Metadata, Viewport } from "next";
import { localeTags, locales, routing, type Locale } from "@/i18n/routing";
import { site } from "./site";

export const DEFAULT_TITLE: string = "agentic-dev-stack: smart vibe coding with Claude Code";
export const TITLE_TEMPLATE: string = "%s · agentic-dev-stack";

/** Path for a locale, honouring `localePrefix: "as-needed"` (default locale has no prefix). */
export function localePath(locale: Locale, path: string): string {
  const clean = path === "/" ? "" : path.replace(/\/$/, "");
  if (locale === routing.defaultLocale) return clean || "/";
  return `/${locale}${clean}`;
}

export function absoluteUrl(locale: Locale, path: string): string {
  return new URL(localePath(locale, path), site.url).toString();
}

export type OgKind = "home" | "architecture" | "docs";

/** Route of each generated OG card (the `opengraph-image.tsx` files). `generateImageMetadata` gives them the id "default". */
const OG_PATH: Record<OgKind, string> = {
  home: "/opengraph-image/default",
  architecture: "/architecture/opengraph-image/default",
  docs: "/docs/opengraph-image/default",
};

type Input = {
  locale: Locale;
  /** Unprefixed path of the page, e.g. "/docs". Omit to skip canonical/hreflang. */
  path?: string;
  /** Page title. Omit on the root layout to emit the default title + template. */
  title?: string;
  description: string;
  /** Which generated OG card to use. The URL is prefix-free for the default locale, so it never hops through a redirect. */
  og?: OgKind;
  /** Explicit image URL; wins over `og`. */
  ogImage?: string;
};

export function buildMetadata({ locale, path, title, description, og, ogImage: explicitImage }: Input): Metadata {
  const ogImage = explicitImage ?? (og ? localePath(locale, OG_PATH[og]) : undefined);
  const languages: Record<string, string> | undefined = path
    ? {
        ...Object.fromEntries(locales.map((l) => [localeTags[l], localePath(l, path)])),
        "x-default": localePath(routing.defaultLocale, path),
      }
    : undefined;
  const shownTitle = title ? TITLE_TEMPLATE.replace("%s", title) : DEFAULT_TITLE;
  const images = ogImage ? [{ url: ogImage }] : undefined;

  return {
    metadataBase: new URL(site.url),
    title: title ?? { default: DEFAULT_TITLE, template: TITLE_TEMPLATE },
    description,
    ...(path ? { alternates: { canonical: localePath(locale, path), languages } } : {}),
    openGraph: {
      type: "website",
      siteName: site.name,
      title: shownTitle,
      description,
      locale: localeTags[locale].replace("-", "_"),
      alternateLocale: (locales as readonly Locale[]).filter((l) => String(l) !== String(locale)).map((l) => localeTags[l].replace("-", "_")),
      ...(path ? { url: localePath(locale, path) } : {}),
      ...(images ? { images } : {}),
    },
    twitter: {
      card: "summary_large_image",
      title: shownTitle,
      description,
      ...(images ? { images: [ogImage as string] } : {}),
    },
  };
}

export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#ffffff" },
    { media: "(prefers-color-scheme: dark)", color: "#000000" },
  ],
};
