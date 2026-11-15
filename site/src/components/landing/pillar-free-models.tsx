import { getTranslations } from "next-intl/server";
import { CodeWindow } from "@/components/ui/code-window";
import { SectionHeader } from "@/components/ui/section-header";
import { CuratorDial } from "./curator-dial.client";

/** Real content of scripts/model-curator/models.json (without its $comment), the single source of the ranking. */
const MODELS_JSON = `{
  "families": [
    ["nemotron-3-ultra", 1], ["kimi-k2", 2], ["glm-5(?!.*flash)", 3], ["deepseek-v4(?!.*flash)", 3],
    ["qwen3\\\\.[5-9].*(max|plus|coder|235b|480b)", 4], ["glm-5.*flash", 5], ["deepseek-v4.*flash", 5],
    ["minimax-m3", 6], ["nemotron-3(\\\\.5)?-super", 7], ["gpt-oss-120b", 8], ["llama-4", 9],
    ["mistral-(large|medium)", 9], ["qwen3", 10]
  ],
  "exclude": "embed|rerank|safety|guard|reward|parse|vl-|-vl\\\\b|vision|bolt|nano|tts|asr|whisper|coder-6\\\\.7b|8b|7b|3b|1b|instruct-51b|nemotron-4|retriever|clip"
}`;

type Probe = { q: string; d: string };
type Incident = { model: string; what: string };

export async function PillarFreeModels() {
  const t = await getTranslations("landing-b.free");
  const probes = t.raw("probe.items") as Probe[];
  const incidents = t.raw("incidents.items") as Incident[];
  const facts = [
    { label: t("facts.router"), value: t("facts.routerValue") },
    { label: t("facts.nim"), value: t("facts.nimValue") },
    { label: t("facts.curator"), value: t("facts.curatorValue") },
  ];

  return (
    <section id="free-models" aria-label={t("label")} className="section bg-band">
      <div className="container-site flex flex-col gap-16">
        <SectionHeader index={t("index")} label={t("label")} title={t("title")} intro={t("intro")} />

        <dl className="grid gap-4 sm:grid-cols-3">
          {facts.map((f) => (
            <div key={f.label} className="border border-border bg-card p-6">
              <dt className="section-label">{f.label}</dt>
              <dd className="mt-2 text-h3 font-bold break-words">{f.value}</dd>
            </div>
          ))}
        </dl>

        <div className="grid gap-12 lg:grid-cols-2 lg:gap-16">
          <div className="flex flex-col gap-4">
            <h3 className="text-h3 font-bold">{t("dial.title")}</h3>
            <CuratorDial />
          </div>

          <div className="flex flex-col gap-4">
            <h3 className="text-h3 font-bold">{t("probe.title")}</h3>
            <p className="text-muted-foreground">{t("probe.intro")}</p>
            <ol className="flex flex-col gap-2">
              {probes.map((p) => (
                <li key={p.q} className="flex gap-4 border border-border bg-card p-4">
                  <span aria-hidden className="mt-0.5 font-bold text-success">
                    ✓
                  </span>
                  <span>
                    <span className="block font-bold">{p.q}</span>
                    <span className="block text-small text-muted-foreground">{p.d}</span>
                  </span>
                </li>
              ))}
            </ol>
            <p className="text-small text-muted-foreground">{t("probe.outcome")}</p>
          </div>
        </div>

        <div className="grid gap-12 lg:grid-cols-2 lg:gap-16">
          <div className="flex flex-col gap-4">
            <h3 className="text-h3 font-bold">{t("incidents.title")}</h3>
            <ul className="flex flex-col gap-2">
              {incidents.map((i) => (
                <li key={i.model} className="border border-border bg-card p-4">
                  <span className="block font-bold">{i.model}</span>
                  <span className="block text-small text-muted-foreground">{i.what}</span>
                </li>
              ))}
            </ul>
            <p className="text-small text-muted-foreground">{t("incidents.why")}</p>
          </div>

          <div className="flex flex-col gap-4">
            <CodeWindow filename="scripts/model-curator/models.json" code={MODELS_JSON} />
            <p className="text-small text-muted-foreground">{t("code.caption")}</p>
            <a href="#architecture" className="min-h-11 self-start py-2 font-bold text-link underline underline-offset-4">
              {t("arch")} →
            </a>
          </div>
        </div>
      </div>
    </section>
  );
}
