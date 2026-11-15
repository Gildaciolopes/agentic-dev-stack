"use client";

/*
 * Why SegmentedPicker and not SpringSwitch: the theme has THREE states
 * (light, dark, auto). A switch can only say on/off, so Auto would need a
 * second control and the "current" state would be ambiguous. A radiogroup
 * with three icon options shows every state at once, is natively arrow-key
 * navigable, and each option carries an aria-label.
 */

import { springCss, springs } from "@usefluid/motion";
import { useTranslations } from "next-intl";
import { useTheme } from "next-themes";
import { type PointerEvent as ReactPointerEvent, useRef, useSyncExternalStore } from "react";
import { flushSync } from "react-dom";
import { SegmentedPicker } from "@/components/fluid/segmented-picker/SegmentedPicker";

type Mode = "light" | "dark" | "system";

const svg = { width: 18, height: 18, viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: 2, strokeLinecap: "round", strokeLinejoin: "round", "aria-hidden": true, focusable: false } as const;

const Sun = () => (
  <svg {...svg}>
    <circle cx="12" cy="12" r="4" />
    <path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M4.93 19.07l1.41-1.41M17.66 6.34l1.41-1.41" />
  </svg>
);
const Moon = () => (
  <svg {...svg}>
    <path d="M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8z" />
  </svg>
);
const Monitor = () => (
  <svg {...svg}>
    <rect x="2" y="3" width="20" height="14" />
    <path d="M8 21h8M12 17v4" />
  </svg>
);

const noop = () => () => {};
const useMounted = () => useSyncExternalStore(noop, () => true, () => false);

type Origin = { x: number; y: number } | null;

export function ThemeSwitch() {
  const t = useTranslations("shell.theme");
  const { theme, setTheme } = useTheme();
  const mounted = useMounted();
  const origin = useRef<Origin>(null);
  const box = useRef<HTMLDivElement>(null);

  const change = (next: Mode) => {
    const root = document.documentElement;
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (reduced) {
      setTheme(next);
      return;
    }
    if (typeof document.startViewTransition !== "function") {
      // Fallback: swap the class, then ease the page in over 200ms.
      setTheme(next);
      root.animate({ opacity: [0.55, 1] }, { duration: 200, easing: "ease-out" });
      return;
    }
    const rect = box.current?.getBoundingClientRect();
    const x = origin.current?.x ?? (rect ? rect.left + rect.width / 2 : window.innerWidth / 2);
    const y = origin.current?.y ?? (rect ? rect.top + rect.height / 2 : 0);
    const radius = Math.hypot(Math.max(x, window.innerWidth - x), Math.max(y, window.innerHeight - y));
    const transition = document.startViewTransition(() => {
      flushSync(() => setTheme(next));
    });
    transition.ready
      .then(() => {
        root.animate(
          { clipPath: [`circle(0px at ${x}px ${y}px)`, `circle(${radius}px at ${x}px ${y}px)`] },
          { duration: 450, easing: springCss(springs.soft).easing, pseudoElement: "::view-transition-new(root)" },
        );
      })
      .catch(() => {});
  };

  if (!mounted) return <div aria-hidden className="h-[52px] w-[146px]" />;

  return (
    <div
      ref={box}
      onPointerDownCapture={(e: ReactPointerEvent) => {
        origin.current = { x: e.clientX, y: e.clientY };
      }}
      onKeyDownCapture={() => {
        origin.current = null;
      }}
    >
      <SegmentedPicker<Mode>
        label={t("label")}
        value={(theme as Mode | undefined) ?? "system"}
        onChange={change}
        options={[
          { value: "light", label: <Sun />, ariaLabel: t("light") },
          { value: "dark", label: <Moon />, ariaLabel: t("dark") },
          { value: "system", label: <Monitor />, ariaLabel: t("auto") },
        ]}
      />
    </div>
  );
}
