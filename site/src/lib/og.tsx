import type { ReactNode } from "react";
import { logo } from "./logo";

export const ogSize = { width: 1200, height: 630 } as const;
export const ogContentType = "image/png";

/**
 * JetBrains Mono for OG cards. Fetched from Google Fonts at build time;
 * resolves to undefined offline so the build falls back to the default font.
 */
export async function loadMono(weight: 400 | 700): Promise<ArrayBuffer | undefined> {
  try {
    const css = await (
      await fetch(`https://fonts.googleapis.com/css2?family=JetBrains+Mono:wght@${weight}`, {
        signal: AbortSignal.timeout(5000),
      })
    ).text();
    const url = css.match(/src: url\((.+?)\) format\('(?:opentype|truetype)'\)/)?.[1];
    if (!url) return undefined;
    const res = await fetch(url, { signal: AbortSignal.timeout(8000) });
    return res.ok ? await res.arrayBuffer() : undefined;
  } catch {
    return undefined;
  }
}

export async function ogFonts() {
  const [regular, bold] = await Promise.all([loadMono(400), loadMono(700)]);
  const fonts = [];
  if (regular) fonts.push({ name: "JetBrains Mono", data: regular, weight: 400 as const, style: "normal" as const });
  if (bold) fonts.push({ name: "JetBrains Mono", data: bold, weight: 700 as const, style: "normal" as const });
  return fonts;
}

export function GradientLogo({ size }: { size: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 120 120">
      <defs>
        <linearGradient id="g" x1="0.3" y1="0" x2="0.7" y2="1">
          <stop offset="0" stopColor="#6ee6ff" />
          <stop offset="0.55" stopColor="#3d74ef" />
          <stop offset="1" stopColor="#3a2a8f" />
        </linearGradient>
      </defs>
      <path d={logo} fill="url(#g)" />
    </svg>
  );
}

/** Black stage, gradient frame bars left/right, gradient logo, mono headline. */
export function OgCard({
  eyebrow,
  headline,
  sub,
  chips,
}: {
  eyebrow: string;
  headline: string;
  sub?: string;
  chips?: string[];
}): ReactNode {
  return (
    <div
      style={{
        width: "100%",
        height: "100%",
        display: "flex",
        background: "#000000",
        color: "#ffffff",
        fontFamily: "JetBrains Mono, monospace",
      }}
    >
      <div style={{ width: 14, height: "100%", background: "linear-gradient(180deg, #309fe5, #3d74ef)" }} />
      <div style={{ flex: 1, display: "flex", flexDirection: "column", justifyContent: "space-between", padding: "64px 72px" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 20 }}>
          <GradientLogo size={64} />
          <div style={{ fontSize: 30, fontWeight: 700 }}>{eyebrow}</div>
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 28 }}>
          <div style={{ fontSize: 76, fontWeight: 700, lineHeight: 1.1, letterSpacing: -2 }}>{headline}</div>
          {sub ? <div style={{ fontSize: 30, color: "#8a8a8a" }}>{sub}</div> : null}
          {chips ? (
            <div style={{ display: "flex", flexWrap: "wrap", gap: 14 }}>
              {chips.map((c) => (
                <div key={c} style={{ display: "flex", padding: "10px 18px", border: "2px solid #6ee6ff", color: "#6ee6ff", fontSize: 26 }}>
                  {c}
                </div>
              ))}
            </div>
          ) : null}
        </div>
      </div>
      <div style={{ width: 14, height: "100%", background: "linear-gradient(180deg, #02bdff, #01e2ff)" }} />
    </div>
  );
}
