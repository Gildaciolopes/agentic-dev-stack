import { getTranslations } from "next-intl/server";
import { CodeWindow } from "@/components/ui/code-window";
import { SectionHeader } from "@/components/ui/section-header";
import { Fan, SddStepper } from "./sdd.client";

/** Real commands and prompts: docs/00-smart-vibe-coding.md (section 2.1, 3) and templates/project/CLAUDE.md. */
const CODE: Record<string, string> = {
  specify: "/speckit.specify  Users can export invoices as PDF",
  clarify: "/speckit.clarify",
  plan: "/speckit.plan",
  tasks: "/speckit.tasks",
  analyze: "/speckit.analyze",
  implement:
    "Implement tasks T03 and T04 [P] from specs/012-invoice-pdf/tasks.md.\nOne builder each, own worktree. Scout first for the PDF util location.",
  review: "Run review-gate on the diff in /tmp/invoice-pdf.diff against spec.md acceptance criteria.",
  verify: "Show file:line for each claim and the test output.",
};

type Step = { id: string; what: string; why: string };

export async function PillarSdd() {
  const t = await getTranslations("landing-a.sdd");
  const steps = t.raw("steps") as Step[];
  const codes = steps.map((s) => (
    <CodeWindow key={s.id} filename={t("codeFile")} code={CODE[s.id] ?? ""} copyLabel={t("copy")} copiedLabel={t("copied")} />
  ));
  return (
    <section id="sdd" className="section bg-band">
      <div className="container-site flex flex-col gap-12">
        <SectionHeader index={t("index")} label={t("label")} title={t("title")} intro={t("intro")} />
        <SddStepper steps={steps} label={t("stepsLabel")} codes={codes} />
        <div className="flex flex-col gap-4">
          <h3 className="text-h3 font-bold">{t("fanTitle")}</h3>
          <Fan labels={{ label: t("fanLabel"), tasks: t("fanTasks"), builder: t("fanBuilder") }} />
        </div>
      </div>
    </section>
  );
}
