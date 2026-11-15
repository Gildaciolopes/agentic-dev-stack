import { getTranslations } from "next-intl/server";
import { architecture, assemblySteps, workflow, type Graph } from "@/content/architecture";
import { ArchitectureExplorer } from "./ArchitectureExplorer";
import { ReadAsText } from "./read-as-text";
import styles from "./architecture.module.css";

const IMG = "https://raw.githubusercontent.com/Gildaciolopes/agentic-dev-stack/main/docs/assets/architecture.svg";

function GraphText({ g, layersLabel, flowsLabel, optional }: { g: Graph; layersLabel: string; flowsLabel: string; optional: string }) {
  const label = (id: string) => g.nodes.find((n) => n.id === id)?.label ?? id;
  const rootNodes = g.nodes.filter((n) => n.group === "root");
  return (
    <section>
      <h4 className="text-h3">{g.title}</h4>
      <p>{g.subtitle}</p>
      <h5 className="section-label mt-4">{layersLabel}</h5>
      <ol className="mt-2 list-decimal space-y-3 pl-6">
        {rootNodes.length ? (
          <li>
            <ul className="list-disc space-y-1 pl-5">
              {rootNodes.map((n) => (
                <li key={n.id}>
                  <strong>{n.label}</strong>: {n.does}
                </li>
              ))}
            </ul>
          </li>
        ) : null}
        {g.groups.map((gr) => (
          <li key={gr.id}>
            <strong>{gr.label}</strong>
            <ul className="mt-1 list-disc space-y-1 pl-5">
              {g.nodes
                .filter((n) => n.group === gr.id)
                .map((n) => (
                  <li key={n.id}>
                    <strong>{n.label}</strong>
                    {n.optional ? ` (${optional})` : ""}: {n.does}
                  </li>
                ))}
            </ul>
          </li>
        ))}
      </ol>
      <h5 className="section-label mt-4">{flowsLabel}</h5>
      <ol className="mt-2 list-decimal space-y-1 pl-6">
        {g.edges.map((e) => (
          <li key={e.id}>
            {label(e.from)} → {label(e.to)}
            {e.label ? ` (${e.label.replace(/\n/g, " ")})` : ""}
            {e.dashed ? ` (${optional})` : ""}
          </li>
        ))}
      </ol>
    </section>
  );
}

/**
 * Server component. The description (layers and flows) is generated from the same graph the
 * explorer draws and is always in the HTML; the island adds interaction on top.
 */
export async function ArchitectureFigure() {
  const t = await getTranslations("architecture.figure");
  return (
    <figure className={styles.figure} aria-labelledby="arch-figcaption">
      <ArchitectureExplorer />
      <noscript>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={IMG} alt={t("alt")} width={1500} height={1160} className={styles.noscriptImg} />
      </noscript>
      <figcaption id="arch-figcaption" className={styles.figcaption}>
        {t("caption")}
      </figcaption>
      <ReadAsText showLabel={t("readAsText")} hideLabel={t("hideText")}>
        <div className="space-y-8 text-[length:var(--text-small)] text-muted-foreground">
          <section>
            <h4 className="text-h3">{t("stepsTitle")}</h4>
            <ol className="mt-2 list-decimal space-y-1 pl-6">
              {assemblySteps.map((s) => (
                <li key={s.id}>{s.caption}</li>
              ))}
            </ol>
          </section>
          <GraphText g={architecture} layersLabel={t("layers")} flowsLabel={t("flows")} optional={t("optional")} />
          <GraphText g={workflow} layersLabel={t("layers")} flowsLabel={t("flows")} optional={t("optional")} />
        </div>
      </ReadAsText>
    </figure>
  );
}
