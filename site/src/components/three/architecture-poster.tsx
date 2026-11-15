import { IsoBlock, IsoDash, IsoGlow, SvgFrame } from "./iso-svg";

/** Static fallback / LCP-safe placeholder for ArchitectureScene. Decorative: the 2D figure holds the content. */
export function ArchitecturePoster() {
  return (
    <SvgFrame viewBox="0 0 640 400">
      <IsoGlow cx={320} cy={330} rx={260} ry={60} />
      <IsoBlock cx={320} cy={300} a={230} d={12} tone="cool" opacity={0.6} />
      <IsoBlock cx={320} cy={250} a={200} d={12} tone="mint" opacity={0.6} />
      <IsoBlock cx={320} cy={200} a={170} d={12} tone="warm" opacity={0.6} />
      <IsoBlock cx={320} cy={150} a={140} d={12} tone="cool" opacity={0.6} />
      <IsoBlock cx={320} cy={112} a={44} d={46} tone="cool" />
      <IsoBlock cx={240} cy={190} a={20} d={22} tone="mint" />
      <IsoBlock cx={400} cy={190} a={20} d={22} tone="warm" />
      <IsoBlock cx={320} cy={236} a={20} d={22} tone="cool" />
      <IsoDash x={90} y={110} />
      <IsoDash x={520} y={140} w={10} o={0.4} />
      <IsoDash x={560} y={260} w={12} o={0.4} />
    </SvgFrame>
  );
}
