import type { SVGProps } from "react";

export type IsoVariant = "cube" | "slabs" | "toggle" | "striped" | "arch";

type Props = Omit<SVGProps<SVGSVGElement>, "viewBox"> & {
  variant: IsoVariant;
  size?: number;
};

/** Static isometric glyphs in the illustration language: gradient sides, white top. */
export function IsoIcon({ variant, size = 64, ...props }: Props) {
  return (
    <svg width={size} height={size} viewBox="0 0 100 100" fill="none" aria-hidden role="presentation" {...props}>
      <defs>
        <linearGradient id="iso-left" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#3d74ef" />
          <stop offset="1" stopColor="#065bbc" />
        </linearGradient>
        <linearGradient id="iso-right" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#065bbc" />
          <stop offset="1" stopColor="#3a2a8f" />
        </linearGradient>
        <linearGradient id="iso-warm" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#f64a35" />
          <stop offset="1" stopColor="#ec3079" />
        </linearGradient>
        <linearGradient id="iso-mint" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#2ad8c4" />
          <stop offset="1" stopColor="#257772" />
        </linearGradient>
      </defs>
      {variant === "cube" && (
        <>
          <path d="M24 35 50 50V80L24 65Z" fill="url(#iso-left)" />
          <path d="M50 50 76 35V65L50 80Z" fill="url(#iso-right)" />
          <path d="M50 20 76 35 50 50 24 35Z" fill="#fff" stroke="var(--iso-edge)" strokeWidth="1" strokeLinejoin="round" />
        </>
      )}
      {variant === "slabs" && (
        <>
          {[0, 1, 2].map((i) => {
            const y = 56 - i * 16;
            const fill = i === 1 ? "url(#iso-warm)" : "url(#iso-left)";
            return (
              <g key={i}>
                <path d={`M16 ${y} 50 ${y + 17}V${y + 27}L16 ${y + 10}Z`} fill={fill} />
                <path d={`M50 ${y + 17} 84 ${y}V${y + 10}L50 ${y + 27}Z`} fill="url(#iso-right)" />
                <path d={`M50 ${y - 17} 84 ${y} 50 ${y + 17} 16 ${y}Z`} fill="#fff" stroke="var(--iso-edge)" strokeWidth="1" strokeLinejoin="round" />
              </g>
            );
          })}
        </>
      )}
      {variant === "toggle" && (
        <>
          <path d="M14 46 50 64V74L14 56Z" fill="url(#iso-left)" />
          <path d="M50 64 86 46V56L50 74Z" fill="url(#iso-right)" />
          <path d="M50 28 86 46 50 64 14 46Z" fill="#fff" stroke="var(--iso-edge)" strokeWidth="1" strokeLinejoin="round" />
          <ellipse cx="64" cy="46" rx="13" ry="7" fill="url(#iso-mint)" />
        </>
      )}
      {variant === "striped" && (
        <>
          <path d="M20 40 50 56V82L20 66Z" fill="url(#iso-warm)" />
          <path d="M50 56 80 40V66L50 82Z" fill="url(#iso-right)" />
          <path d="M50 24 80 40 50 56 20 40Z" fill="#fff" stroke="var(--iso-edge)" strokeWidth="1" strokeLinejoin="round" />
          {[0, 1, 2].map((i) => (
            <path key={i} d={`M${27 + i * 8} ${46 + i * 4}V${58 + i * 4}`} stroke="#fff" strokeWidth="3" opacity="0.7" />
          ))}
        </>
      )}
      {variant === "arch" && (
        <>
          <path d="M22 80V46a28 14 0 0 1 56 0V80H60V52a10 5 0 0 0-20 0V80Z" fill="url(#iso-left)" />
          <path d="M22 46a28 14 0 0 1 56 0 28 14 0 0 0-56 0Z" fill="#fff" stroke="var(--iso-edge)" strokeWidth="1" strokeLinejoin="round" />
          <ellipse cx="50" cy="82" rx="30" ry="8" fill="#2ad8c4" opacity="0.25" />
        </>
      )}
    </svg>
  );
}
