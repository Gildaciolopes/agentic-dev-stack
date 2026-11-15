"use client";

import { type MouseEvent, type ReactNode, useRef, useState } from "react";
import { springs } from "@usefluid/motion";
import { useSpring } from "@usefluid/motion/react";

/**
 * A native <details>: it works without JS. This enhancer only animates the height with a spring.
 * Closing keeps `open` until the spring settles, so the answer does not vanish before it collapses.
 */
export function FaqItem({ question, children }: { question: string; children: ReactNode }) {
  const details = useRef<HTMLDetailsElement>(null);
  const body = useRef<HTMLDivElement>(null);
  const inner = useRef<HTMLDivElement>(null);
  const openRef = useRef(false);
  const [open, setOpen] = useState(false);
  const [target, setTarget] = useState(0);

  useSpring(
    { h: open ? target : 0 },
    ({ h }) => {
      const b = body.current;
      const d = details.current;
      if (!b || !d) return;
      if (openRef.current) {
        b.style.height = Math.abs(h - target) < 0.5 ? "auto" : `${h}px`;
      } else {
        b.style.height = `${Math.max(0, h)}px`;
        if (h < 0.5) d.removeAttribute("open");
      }
    },
    springs.soft,
  );

  const toggle = (e: MouseEvent) => {
    e.preventDefault();
    const d = details.current;
    const content = inner.current;
    if (!d || !content) return;
    if (openRef.current) {
      openRef.current = false;
      setOpen(false);
    } else {
      d.setAttribute("open", "");
      openRef.current = true;
      setTarget(content.offsetHeight);
      setOpen(true);
    }
  };

  return (
    <details ref={details} data-open={open} className="group border border-border bg-card">
      <summary
        onClick={toggle}
        className="flex min-h-14 cursor-pointer list-none items-center justify-between gap-6 px-6 py-4 font-bold marker:content-none [&::-webkit-details-marker]:hidden"
      >
        <span>{question}</span>
        <span aria-hidden className="shrink-0 text-h3 leading-none transition-transform duration-150 ease-out group-data-[open=true]:rotate-45">
          +
        </span>
      </summary>
      <div ref={body} className="overflow-hidden">
        <div ref={inner} className="flex flex-col gap-3 px-6 pb-6 text-muted-foreground">
          {children}
        </div>
      </div>
    </details>
  );
}
