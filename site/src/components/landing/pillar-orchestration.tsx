import { readFile } from "node:fs/promises";
import path from "node:path";
import { getTranslations } from "next-intl/server";
import { CodeWindow } from "@/components/ui/code-window";
import { SectionHeader } from "@/components/ui/section-header";
import { Lanes } from "./lanes.client";
import { AgentTabs } from "./orchestration.client";

const IDS = ["scout", "builder", "reviewer", "agy", "opencode-safe", "codex"] as const;

/** The real decision logic of the hook (10 lines), read from the repo at build time so it never drifts. */
async function hookExcerpt(): Promise<string> {
  try {
    const src = await readFile(path.join(process.cwd(), "..", "hooks", "agent-model-guard.mjs"), "utf8");
    const lines = src.split("\n");
    const start = lines.findIndex((l) => l.startsWith("export function decide"));
    return start < 0 ? "" : lines.slice(start, start + 10).join("\n");
  } catch {
    return "";
  }
}

export async function PillarOrchestration() {
  const t = await getTranslations("landing-a.orchestration");
  const excerpt = await hookExcerpt();
  const agents = IDS.map((id) => ({
    id,
    role: t(`agents.${id}.role`),
    model: t(`agents.${id}.model`),
    quota: t(`agents.${id}.quota`),
    guard: t(`agents.${id}.guard`),
  }));
  const code = excerpt ? (
    <CodeWindow filename={t("codeFile")} code={excerpt} copyLabel={t("copy")} copiedLabel={t("copied")} />
  ) : null;
  return (
    <section id="orchestration" className="section container-site flex flex-col gap-12">
      <SectionHeader index={t("index")} label={t("label")} title={t("title")} intro={t("intro")} />
      <div className="grid grid-cols-1 items-start gap-10 lg:grid-cols-[1.2fr_1fr]">
        <AgentTabs
          agents={agents}
          labels={{ tabs: t("tabsLabel"), role: t("role"), model: t("model"), quota: t("quota"), guard: t("guard") }}
          code={code}
        />
        <div className="border border-border bg-card p-4">
          <Lanes
            labels={{
              label: t("lanes.label"),
              lead: t("lanes.lead"),
              worktree: t("lanes.worktree"),
              blocked: t("lanes.blocked"),
              opus: t("lanes.opus"),
              gate: t("lanes.gate"),
            }}
          />
        </div>
      </div>
    </section>
  );
}
