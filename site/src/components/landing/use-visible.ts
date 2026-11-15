"use client";

import { useEffect, useState, type RefObject } from "react";

/**
 * True while the element is on screen AND the tab is visible. Unlike Fluid's
 * useInView (which latches once seen), this flips back so loops can pause.
 */
export function useVisible(ref: RefObject<Element | null>, threshold = 0.2): boolean {
  const [onScreen, setOnScreen] = useState(false);
  const [tabVisible, setTabVisible] = useState(true);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const io = new IntersectionObserver(([entry]) => setOnScreen(entry.isIntersecting), { threshold });
    io.observe(el);
    return () => io.disconnect();
  }, [ref, threshold]);

  useEffect(() => {
    const update = () => setTabVisible(!document.hidden);
    update();
    document.addEventListener("visibilitychange", update);
    return () => document.removeEventListener("visibilitychange", update);
  }, []);

  return onScreen && tabVisible;
}
