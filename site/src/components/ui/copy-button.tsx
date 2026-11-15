"use client";

import { CopyMorph } from "@/components/fluid/copy-morph/CopyMorph";

type Props = { text: string; label: string; doneLabel: string };

/** Thin client boundary so server components can place a Copy Morph. */
export function CopyButton(props: Props) {
  return <CopyMorph {...props} />;
}
