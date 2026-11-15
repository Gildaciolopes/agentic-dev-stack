"use client";

import { useState } from "react";
import { LegendChip, type LegendKind } from "@/components/ui/legend-chip";

const KINDS: LegendKind[] = ["native", "google", "free", "optional", "lead"];

export function LegendDemo() {
  const [on, setOn] = useState<Record<string, boolean>>({ native: true, google: true });
  return (
    <div className="flex flex-wrap gap-2">
      {KINDS.map((k) => (
        <LegendChip key={k} kind={k} label={k} pressed={!!on[k]} onPressedChange={(p) => setOn((s) => ({ ...s, [k]: p }))} />
      ))}
    </div>
  );
}
