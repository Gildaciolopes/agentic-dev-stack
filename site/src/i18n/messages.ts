import type { Locale } from "./routing";

/**
 * Messages live in messages/<locale>/<namespace>.json, one file per area,
 * so parallel work never collides. Register each namespace here.
 */
export const namespaces = ["meta"] as const;

export async function loadMessages(locale: Locale) {
  const entries = await Promise.all(
    namespaces.map(async (ns) => [ns, (await import(`../../messages/${locale}/${ns}.json`)).default] as const),
  );
  return Object.fromEntries(entries);
}
