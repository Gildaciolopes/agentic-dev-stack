"use client";

import { useState, type ReactNode } from "react";
import { PillTabs } from "@/components/fluid/pill-tabs/PillTabs";

type Agent = { id: string; role: string; model: string; quota: string; guard: string };
type Labels = { tabs: string; role: string; model: string; quota: string; guard: string };

/** Pill Tabs over the roles; the hook excerpt (server-rendered) sits under the active panel. */
export function AgentTabs({ agents, labels, code }: { agents: Agent[]; labels: Labels; code: ReactNode }) {
  const [value, setValue] = useState(agents[0].id);
  const agent = agents.find((a) => a.id === value) ?? agents[0];
  return (
    <div className="flex flex-col gap-6">
      <div className="overflow-x-auto pb-1">
        <PillTabs label={labels.tabs} value={value} onChange={setValue} tabs={agents.map((a) => ({ value: a.id, label: a.id }))} />
      </div>
      <div role="tabpanel" aria-label={agent.id} className="grid gap-6 border border-border bg-card p-6 md:grid-cols-[1.4fr_1fr]">
        <p className="text-card-foreground">{agent.role}</p>
        <dl className="grid gap-3 text-small">
          <div>
            <dt className="text-label uppercase text-subtle-foreground">{labels.model}</dt>
            <dd>{agent.model}</dd>
          </div>
          <div>
            <dt className="text-label uppercase text-subtle-foreground">{labels.quota}</dt>
            <dd>{agent.quota}</dd>
          </div>
          <div>
            <dt className="text-label uppercase text-subtle-foreground">{labels.guard}</dt>
            <dd>{agent.guard}</dd>
          </div>
        </dl>
      </div>
      {code}
    </div>
  );
}
