import type { Locale } from "./routing";

/**
 * Messages live in messages/<locale>/<namespace>.json, one file per area,
 * so parallel work never collides. Register each namespace here.
 */
export const namespaces = ["meta", "docs", "shell", "seo", "landing-a", "three", "landing-b", "architecture"] as const;

export async function loadMessages(locale: Locale) {
  const entries = await Promise.all(
    namespaces.map(async (ns) => {
      // `_sources` maps are for maintainers (string -> repo file:line); never render or ship them.
      const { _sources, ...rest } = (await import(`../../messages/${locale}/${ns}.json`)).default as Record<string, unknown>;
      void _sources;
      return [ns, rest] as const;
    }),
  );
  return Object.fromEntries(entries);
}
