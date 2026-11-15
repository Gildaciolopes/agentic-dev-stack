import { ImageResponse } from "next/og";
import { hasLocale } from "next-intl";
import { getTranslations } from "next-intl/server";
import { routing } from "@/i18n/routing";
import { OgCard, ogContentType, ogFonts, ogSize } from "./og";

export type OgParams = { params: Promise<{ locale: string }> };
type Kind = "home" | "architecture" | "docs";

async function localeOf(params: OgParams["params"]) {
  const { locale } = await params;
  return hasLocale(routing.locales, locale) ? locale : routing.defaultLocale;
}

/** Body of `generateImageMetadata` for the per-route opengraph-image files. */
export async function ogMetadata(kind: Kind, { params }: OgParams) {
  const t = await getTranslations({ locale: await localeOf(params), namespace: "seo" });
  return [{ id: "default", size: ogSize, contentType: ogContentType, alt: t(`og.${kind}.alt`) }];
}

/** Body of the default export for the per-route opengraph-image files. */
export async function ogRender(kind: Kind, { params }: OgParams) {
  const locale = await localeOf(params);
  const t = await getTranslations({ locale, namespace: "seo" });
  const chips = kind === "architecture" ? (t.raw("og.architecture.chips") as string[]) : undefined;
  const sub = kind === "docs" ? t("og.docs.sub") : undefined;
  return new ImageResponse(
    <OgCard eyebrow={t("og.eyebrow")} headline={t(`og.${kind}.headline`)} sub={sub} chips={chips} />,
    { ...ogSize, fonts: await ogFonts() },
  );
}
