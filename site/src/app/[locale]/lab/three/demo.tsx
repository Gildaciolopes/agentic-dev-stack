"use client";

import { useState } from "react";
import { architecture } from "@/content/architecture";
import { LazyArchitectureScene, LazyTokenFunnel } from "@/components/three/lazy";

export function Demo() {
  const [explode, setExplode] = useState(0);
  const [hi, setHi] = useState<string | null>(null);
  return (
    <div className="flex flex-col gap-16">
      <section className="flex flex-col gap-4">
        <label className="flex items-center gap-4 text-sm">
          explode
          <input type="range" min={0} max={1} step={0.01} value={explode} onChange={(e) => setExplode(Number(e.target.value))} className="min-h-11 w-64" />
          <span>{explode.toFixed(2)}</span>
        </label>
        <p className="text-sm text-muted-foreground">selected: {hi ?? "none"} (click a block)</p>
        <LazyArchitectureScene graph={architecture} explode={explode} highlightId={hi} onSelect={(id) => setHi((p) => (p === id ? null : id))} />
      </section>
      <section>
        <LazyTokenFunnel />
      </section>
    </div>
  );
}
