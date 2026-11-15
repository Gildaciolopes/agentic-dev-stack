"use client";

import dynamic from "next/dynamic";
import { ArchitecturePoster } from "./architecture-poster";
import { TokenFunnelPoster } from "./token-funnel-poster";

/** Client-only, code-split wrappers: three.js never lands in the first-load bundle. */
export const LazyArchitectureScene = dynamic(() => import("./architecture-scene"), {
  ssr: false,
  loading: () => (
    <div className="relative w-full" style={{ aspectRatio: "16 / 10" }} aria-hidden>
      <ArchitecturePoster />
    </div>
  ),
});

export const LazyTokenFunnel = dynamic(() => import("./token-funnel"), {
  ssr: false,
  loading: () => <TokenFunnelPoster />,
});
