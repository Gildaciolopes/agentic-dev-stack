import { getFormatter, getTranslations } from "next-intl/server";

const GITHUB = "https://api.github.com/repos/Gildaciolopes/agentic-dev-stack";
const NPM = "https://api.npmjs.org/downloads/point/last-month/agentic-dev-stack";

async function load(url: string): Promise<unknown> {
  try {
    const res = await fetch(url, { next: { revalidate: 86400 }, signal: AbortSignal.timeout(5000) });
    return res.ok ? await res.json() : null;
  } catch {
    return null;
  }
}

function count(value: unknown): number | null {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

/** Live numbers fetched at build time. A stat that fails to load is simply not rendered. */
export async function Stats() {
  const [repo, downloads] = await Promise.all([load(GITHUB), load(NPM)]);
  const stars = count((repo as { stargazers_count?: unknown } | null)?.stargazers_count);
  const npm = count((downloads as { downloads?: unknown } | null)?.downloads);
  if (stars === null && npm === null) return null;

  const [t, format] = await Promise.all([getTranslations("landing-a.stats"), getFormatter()]);
  const now = new Date();
  const items = [
    stars !== null ? { value: stars, label: t("stars") } : null,
    npm !== null ? { value: npm, label: t("downloads") } : null,
  ].filter((i): i is { value: number; label: string } => i !== null);

  return (
    <section aria-label={t("label")} className="container-site py-10">
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
