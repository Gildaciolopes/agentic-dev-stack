import type { ReactNode } from "react";
import { getTranslations } from "next-intl/server";
import { Card, CardBody, CardHeader, CardTitle } from "@/components/ui/card";
import { CodeWindow } from "@/components/ui/code-window";
import { SectionHeader } from "@/components/ui/section-header";
import { TokenBars } from "./tokens.client";

type Row = { month: string; commands: string; tokens: string; saved: string; pct: number; short: string };
type Tool = { name: string; what: string; body: string };

/** README.md:55-58 */
const CODE = `rtk gain --monthly                                                  # shell output savings
python3 -I ~/.agents/skills/alethe/scripts/orchestrate.py report    # per-run cost, models and providers`;

export async function PillarTokens({ visual }: { visual?: ReactNode }) {
  const t = await getTranslations("landing-a.tokens");
  const rows = t.raw("rows") as Row[];
  const cols = t.raw("cols") as string[];
  const cards = t.raw("cards") as Tool[];
  return (
    <section id="tokens" className="section container-site flex flex-col gap-12">
      <SectionHeader index={t("index")} label={t("label")} title={t("title")} intro={t("intro")} />
      {visual ? <div>{visual}</div> : null}
      <div className="grid grid-cols-1 items-start gap-10 lg:grid-cols-2">
        <div className="flex flex-col gap-8">
          <div className="overflow-x-auto">
            <table className="w-full border-collapse text-left text-small">
              <caption className="sr-only">{t("tableCaption")}</caption>
              <thead>
                <tr>
                  {cols.map((c, i) => (
                    <th key={c} scope="col" className={`border-b border-foreground p-3 text-label font-normal uppercase text-muted-foreground${i > 0 ? " text-right" : ""}`}>
                      {c}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {rows.map((r, i) => {
                  const total = i === rows.length - 1;
                  return (
                    <tr key={r.month} className={`border-b border-border${total ? " font-bold" : ""}`}>
                      <th scope="row" className="p-3 font-[inherit] font-normal">
                        {total ? <strong>{r.month}</strong> : r.month}
                      </th>
                      <td className="p-3 text-right">{r.commands}</td>
                      <td className="p-3 text-right">{r.tokens}</td>
                      <td className="p-3 text-right font-bold">{r.saved}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          <p className="text-small text-muted-foreground">{t("footnote")}</p>
        </div>
        <div className="flex flex-col gap-8">
          <TokenBars rows={rows} label={t("barsLabel")} />
          <CodeWindow filename={t("codeFile")} code={CODE} copyLabel={t("copy")} copiedLabel={t("copied")} />
        </div>
      </div>
      <ul aria-label={t("cardsLabel")} className="grid grid-cols-1 gap-4 md:grid-cols-3">
        {cards.map((c) => (
          <li key={c.name}>
            <Card className="h-full">
              <CardHeader>
                <p className="section-label">{c.what}</p>
                <CardTitle>{c.name}</CardTitle>
              </CardHeader>
              <CardBody>{c.body}</CardBody>
            </Card>
          </li>
        ))}
      </ul>
    </section>
  );
}
