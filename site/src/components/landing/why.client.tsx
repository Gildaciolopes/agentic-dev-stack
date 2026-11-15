"use client";

import { useRef } from "react";
import { useInView, useSequence } from "@usefluid/motion/react";
import { cn } from "@/lib/utils";
import styles from "./landing.module.css";

type Props = {
  caption: string;
  without: string;
  with: string;
  rows: [string, string][];
};

/**
 * A real table: caption, column headers, row headers. Rows light up in
 * sequence once in view (without side struck and greyed, with side lit).
 * Before it plays, and with reduced motion, everything is plain readable text.
 */
export function WhyTable({ caption, without, with: withLabel, rows }: Props) {
  const ref = useRef<HTMLTableElement>(null);
  const inView = useInView(ref, 0.25);
  const times = rows.map((_, i) => i * 0.45);
  const step = useSequence(times, inView);
  const lit = (i: number) => inView && i <= step;

  return (
    <table ref={ref} className="w-full border-collapse text-left max-md:block">
      <caption className="sr-only">{caption}</caption>
      <thead className="max-md:sr-only">
        <tr className="max-md:block">
          <th scope="col" className="w-12 border-b border-border p-3 text-label uppercase text-subtle-foreground">
            <span className="sr-only">#</span>
          </th>
          <th scope="col" className="border-b border-border p-3 text-label uppercase font-normal text-muted-foreground">
            {without}
          </th>
          <th scope="col" className="border-b border-border p-3 text-label uppercase font-normal text-foreground">
            {withLabel}
          </th>
        </tr>
      </thead>
      <tbody className="max-md:block">
        {rows.map(([a, b], i) => (
          <tr key={i} className="border-b border-border max-md:mb-4 max-md:block max-md:border">
            <th scope="row" className="w-12 p-3 align-top text-label font-normal text-subtle-foreground max-md:block max-md:pb-0">
              {String(i + 1).padStart(2, "0")}
            </th>
            <td data-lit={lit(i)} className={cn(styles.cell, styles.without, "p-3 align-top text-muted-foreground max-md:block")}>
              <span aria-hidden className="mb-1 block text-label uppercase text-subtle-foreground md:hidden">
                {without}
              </span>
              {a}
            </td>
            <td data-lit={lit(i)} className={cn(styles.cell, styles.with, "p-3 align-top text-foreground max-md:block")}>
              <span aria-hidden className="mb-1 block text-label uppercase text-subtle-foreground md:hidden">
                {withLabel}
              </span>
              {b}
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}
