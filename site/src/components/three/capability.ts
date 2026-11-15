function hasWebGL() {
  try {
    const c = document.createElement("canvas");
    return !!(c.getContext("webgl2") || c.getContext("webgl"));
  } catch {
    return false;
  }
}

/** Reduced motion, data-saver, low core count or no WebGL: no 3D. Browser only (false on the server). */
export function deviceCapable() {
  if (typeof window === "undefined") return false;
  if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return false;
  const nav = navigator as Navigator & { connection?: { saveData?: boolean }; deviceMemory?: number };
  if (nav.connection?.saveData) return false;
  if (typeof nav.hardwareConcurrency === "number" && nav.hardwareConcurrency < 4) return false;
  return hasWebGL();
}

let cached: boolean | undefined;
/** Memoised per page load (creating a WebGL context is not free); safe as a useSyncExternalStore snapshot. */
export function deviceCapableCached() {
  if (typeof window === "undefined") return false;
  return (cached ??= deviceCapable());
}
