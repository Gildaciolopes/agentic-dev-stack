"use client";

import dynamic from "next/dynamic";
import { TokenFunnelPoster } from "./token-funnel-poster";

/** Client-only, code-split wrappers: three.js never lands in the first-load bundle. */
export const LazyTokenFunnel = dynamic(() => import("./token-funnel"), {
  ssr: false,
  loading: () => <TokenFunnelPoster />,
});
