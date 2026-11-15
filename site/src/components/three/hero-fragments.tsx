import { IsoBlock, IsoDash, SvgFrame } from "./iso-svg";

/** Floating isometric fragments (cube, crescent, arch, toggle, dashes). Pure SVG, CSS-only float. */
const SKEW_L = "matrix(0.866 0.5 0 1 0 0)";

function Float({ delay, children }: { delay: number; children: React.ReactNode }) {
  return (
    <g className="hf-float" style={{ animationDelay: `${delay}s` }}>
      {children}
    </g>
  );
}

export function HeroFragments({ className }: { className?: string }) {
  return (
    <SvgFrame viewBox="0 0 600 400" className={className}>
      <Float delay={0}>
        <IsoBlock cx={120} cy={90} a={46} d={46} tone="cool" />
      </Float>
      <Float delay={-2}>
        <g transform="translate(470 80)">
          <g transform={SKEW_L}>
            <path d="M0 -34A34 34 0 1 0 0 34A25 25 0 1 1 0 -34Z" fill="url(#iso3-warm)" />
          </g>
        </g>
      </Float>
      <Float delay={-4}>
        <g transform="translate(300 300)">
          <g transform={SKEW_L}>
            <path d="M-36 24V-6A36 36 0 0 1 36 -6V24H16V-6A16 16 0 0 0 -16 -6V24Z" fill="url(#iso3-cool)" />
          </g>
        </g>
      </Float>
      <Float delay={-1}>
        <g transform="translate(500 280)">
          <IsoBlock cx={0} cy={0} a={40} d={12} tone="cool" />
          <ellipse cx={14} cy={0} rx={13} ry={7.5} fill="url(#iso3-mint)" />
        </g>
      </Float>
      <Float delay={-3}>
        <IsoBlock cx={90} cy={290} a={34} d={9} tone="mint" opacity={0.9} />
      </Float>
      <IsoDash x={230} y={60} />
      <IsoDash x={390} y={170} w={10} o={0.4} />
      <IsoDash x={60} y={190} w={8} o={0.35} />
      <IsoDash x={420} y={350} w={16} o={0.45} />
      <IsoDash x={210} y={200} w={9} o={0.3} />
    </SvgFrame>
  );
}

export default HeroFragments;
