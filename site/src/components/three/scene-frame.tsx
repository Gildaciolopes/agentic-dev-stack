"use client";

import { Canvas } from "@react-three/fiber";
import { useEffect, useRef, useState, type ReactNode } from "react";
import { deviceCapable } from "./capability";

type Props = {
  /** width / height of the fixed box (zero CLS) */
  aspect: number;
  /** optional static fallback shown under the canvas until it fades in */
  poster?: ReactNode;
  /** DOM drawn above the canvas (labels) */
  overlay?: ReactNode;
  /** R3F content */
  children: ReactNode;
  /** orthographic camera position (true isometric default) */
  cameraPosition?: [number, number, number];
  className?: string;
};

/** Poster first; the Canvas mounts only when visible and the device is capable, then fades in. */
export function SceneFrame({ aspect, poster, overlay, children, cameraPosition = [14, 14, 14], className }: Props) {
  const box = useRef<HTMLDivElement>(null);
  const [mount, setMount] = useState(false);
  const [inView, setInView] = useState(false);
  const [tabVisible, setTabVisible] = useState(true);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    const el = box.current;
    if (!el || typeof IntersectionObserver === "undefined") return;
    const io = new IntersectionObserver(
      ([entry]) => {
        const vis = entry.isIntersecting;
        setInView(vis);
        if (vis) setMount((m) => m || deviceCapable());
      },
      { rootMargin: "200px" },
    );
    io.observe(el);
    return () => io.disconnect();
  }, []);

  useEffect(() => {
    const on = () => setTabVisible(document.visibilityState === "visible");
    document.addEventListener("visibilitychange", on);
    return () => document.removeEventListener("visibilitychange", on);
  }, []);

  const active = inView && tabVisible;

  return (
    <div ref={box} className={`relative w-full overflow-hidden ${className ?? ""}`} style={{ aspectRatio: String(aspect) }}>
      {poster ? (
        <div className="absolute inset-0" aria-hidden style={{ opacity: ready ? 0 : 1, transition: "opacity 400ms ease-out" }}>
          {poster}
        </div>
      ) : null}
      {mount && (
        <div className="absolute inset-0" aria-hidden style={{ opacity: ready ? 1 : 0, transition: "opacity 400ms ease-out" }}>
          <Canvas
            orthographic
            frameloop={active ? "always" : "never"}
            dpr={[1, 1.75]}
            gl={{ antialias: true, powerPreference: "low-power", alpha: true }}
            camera={{ position: cameraPosition, zoom: 40, near: -100, far: 200 }}
            onCreated={() => requestAnimationFrame(() => requestAnimationFrame(() => setReady(true)))}
            style={{ background: "transparent" }}
          >
            {children}
          </Canvas>
        </div>
      )}
      {overlay}
    </div>
  );
}
