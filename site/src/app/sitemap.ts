import fs from "node:fs";
import path from "node:path";
import type { MetadataRoute } from "next";
import { localeTags, locales } from "@/i18n/routing";
import { absoluteUrl } from "@/lib/seo";

/** English doc slugs (00 to 09) come from the repo's docs folder. */
function docSlugs(): string[] {
  const dir = path.join(process.cwd(), "..", "docs");
  return fs
    .readdirSync(dir)
    .filter((f) => /^\d{2}-.+\.md$/.test(f))
    .map((f) => f.replace(/\.md$/, ""))
    .sort();
}

export default function sitemap(): MetadataRoute.Sitemap {
  const paths = ["/", "/architecture", "/changelog", "/docs", ...docSlugs().map((s) => `/docs/${s}`)];
  return paths.flatMap((p) =>
    locales.map((locale) => ({
      url: absoluteUrl(locale, p),
      changeFrequency: "weekly" as const,
      priority: p === "/" ? 1 : p.startsWith("/docs/") ? 0.6 : 0.8,
      alternates: {
        languages: Object.fromEntries(locales.map((l) => [localeTags[l], absoluteUrl(l, p)])),
      },
    })),
  );
}
