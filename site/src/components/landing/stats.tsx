import { getFormatter, getTranslations } from "next-intl/server";

import { loadStats } from "@/lib/stats";

/** Live numbers fetched at render and revalidated daily (ISR). A stat that fails to load is simply not rendered. */
export async function Stats() {
  const { stars, downloads: npm } = await loadStats();
  if (stars === null && npm === null) return null;

  const [t, format] = await Promise.all([getTranslations("landing-a.stats"), getFormatter()]);
  const now = new Date();
  const items = [
    stars !== null ? { value: stars, label: t("stars") } : null,
    npm !== null ? { value: npm, label: t("downloads") } : null,
  ].filter((i): i is { value: number; label: string } => i !== null);

  return (
    <section id="stats" aria-label={t("label")} className="container-site py-10">
      <dl className="flex flex-wrap items-end justify-center gap-x-16 gap-y-6 text-center">
        {items.map((item) => (
          <div key={item.label} className="flex flex-col-reverse gap-1">
            <dt className="text-small text-muted-foreground">{item.label}</dt>
            <dd className="text-h2 font-bold">{format.number(item.value)}</dd>
          </div>
        ))}
      </dl>
      <p className="mt-4 text-center text-label uppercase tracking-wider text-subtle-foreground">
        {t("asOf")} <time dateTime={now.toISOString().slice(0, 10)}>{format.dateTime(now, { dateStyle: "medium" })}</time>
      </p>
    </section>
  );
}
