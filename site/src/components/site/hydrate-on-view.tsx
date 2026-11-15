"use client";

import { type ReactNode, Suspense, use, useEffect, useRef, useState, useSyncExternalStore } from "react";

/*
 * Defers hydration of below-the-fold islands. The server HTML is rendered as usual
 * (so text, SEO and no-JS stay intact); on the client the boundary suspends while
 * hydrating, which makes React keep the server markup as-is ("dehydrated") and skip
 * its JS cost. When the wrapper nears the viewport the gate opens and React hydrates
 * that subtree. This keeps first-load main-thread work proportional to the fold.
 */

type Gate = { promise: Promise<void>; open: () => void; done: boolean };

function makeGate(): Gate {
  let resolve = () => {};
  const promise = new Promise<void>((r) => {
    resolve = r;
  });
  const gate: Gate = {
    promise,
    done: false,
    open: () => {
      gate.done = true;
      resolve();
    },
  };
  return gate;
}

const noop = () => () => {};

function Hold({ gate, children }: { gate: Gate; children: ReactNode }) {
  /* true only while React is hydrating this boundary from server HTML (server snapshot);
     if React client-renders it instead (forced update, recovery), render the content: suspending
     there would drop the server markup and leave the section empty. */
  const hydrating = useSyncExternalStore(noop, () => false, () => true);
  if (hydrating && typeof window !== "undefined" && !gate.done) use(gate.promise);
  return children;
}

export function HydrateOnView({ children, margin = "700px 0px" }: { children: ReactNode; margin?: string }) {
  const [gate] = useState(makeGate);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el || gate.done) return;
    if (typeof IntersectionObserver === "undefined") {
      gate.open();
      return;
    }
    const io = new IntersectionObserver(
      (entries) => {
        if (entries.some((e) => e.isIntersecting)) {
          gate.open();
          io.disconnect();
        }
      },
      { rootMargin: margin },
    );
    io.observe(el);
    return () => io.disconnect();
  }, [gate, margin]);

  return (
    <div ref={ref}>
      <Suspense fallback={null}>
        <Hold gate={gate}>{children}</Hold>
      </Suspense>
    </div>
  );
}
