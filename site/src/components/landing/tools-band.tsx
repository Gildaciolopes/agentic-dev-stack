import { getTranslations } from "next-intl/server";
import { Marquee } from "@/components/ui/marquee";

/** Two opposite marquee rows of the real tools. Text chips only, no third-party logos. */
export async function ToolsBand() {
  const t = await getTranslations("landing-a.tools");
  const items = t.raw("items") as string[];
  const half = Math.ceil(items.length / 2);
  const rows = [items.slice(0, half), items.slice(half)];
  return (
    <section id="tools" aria-labelledby="tools-title" className="bg-band py-12 md:py-16">
      <div className="container-site mb-8 text-center">
        <p className="section-label">{t("label")}</p>
        <h2 id="tools-title" className="sr-only">
          {t("heading")}
        </h2>
      </div>
      <div className="flex flex-col gap-4">
        {rows.map((row, i) => (
          <Marquee key={i} direction={i === 0 ? "left" : "right"} speed={i === 0 ? 38 : 46}>
            {/* repeated once so a group is wider than the viewport; repeats are hidden from AT and from the static reduced-motion grid */}
            {[...row, ...row].map((name, j) => (
              <span
                key={j}
                aria-hidden={j >= row.length || undefined}
                className={`flex-none whitespace-nowrap border border-border bg-card px-5 py-3 text-small text-card-foreground${j >= row.length ? " motion-reduce:hidden" : ""}`}
              >
                {name}
              </span>
            ))}
          </Marquee>
        ))}
      </div>
    </section>
  );
}
