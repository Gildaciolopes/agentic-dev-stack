"use client";

import { useRef } from "react";
import { useInView } from "@usefluid/motion/react";
import { TextReveal } from "@/components/fluid/text-reveal/TextReveal";
import { cn } from "@/lib/utils";

type Props = {
  as?: "h1" | "h2" | "h3";
  /** Lines separated by \n each get their own block. */
  text: string;
  className?: string;
  id?: string;
};

/**
 * Heading whose letters spring in once it is in view. The full text is in the
 * server HTML (TextReveal keeps it in an sr-only span) and the letter spans
 * keep their layout box while hidden, so there is no layout shift.
 */
export function RevealHeading({ as: Tag = "h2", text, className, id }: Props) {
  const ref = useRef<HTMLHeadingElement>(null);
  const inView = useInView(ref, 0.3);
  const lines = text.split("\n");
  return (
    <Tag ref={ref} id={id} data-reveal className={cn("text-h2 font-bold", className)}>
      {lines.map((line, i) => (
        <span key={i} className="block">
          <TextReveal text={line} play={inView} />
        </span>
      ))}
    </Tag>
  );
}
