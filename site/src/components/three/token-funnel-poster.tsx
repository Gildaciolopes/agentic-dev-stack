import { useTranslations } from "next-intl";
import { IsoDash, IsoGlow, IsoRing, SvgFrame } from "./iso-svg";

/** Stage centres as fractions of the box height; the live scene and the DOM labels use the same ones. */
export const FUNNEL_STAGE_Y = [0.336, 0.5, 0.664] as const;

const GREY: [number, number][] = [
  [150, 30], [200, 52], [250, 24], [300, 60], [340, 36], [185, 84], [270, 90], [320, 100], [225, 108], [360, 82], [170, 12], [290, 8],
];
const BRIGHT: [number, number][] = [
  [235, 330], [262, 352], [250, 372], [275, 340],
];

/** Art only: static SVG of the funnel composition. Used as fallback inside SceneFrame. */
export function TokenFunnelArt() {
  return (
    <SvgFrame viewBox="0 0 500 400">
      <IsoGlow cx={250} cy={350} rx={190} ry={44} />
      <IsoRing cx={250} cy={400 * FUNNEL_STAGE_Y[2]} a={70} d={12} tone="mint" />
      <IsoRing cx={250} cy={400 * FUNNEL_STAGE_Y[1]} a={85} d={12} tone="warm" />
      <IsoRing cx={250} cy={400 * FUNNEL_STAGE_Y[0]} a={100} d={12} tone="cool" />
      {GREY.map(([x, y]) => (
        <IsoDash key={`g${x}-${y}`} x={x} y={y} w={9} o={0.7} />
      ))}
      {BRIGHT.map(([x, y]) => (
        <rect key={`b${x}-${y}`} x={x} y={y} width={9} height={4} fill="#6ee6ff" />
      ))}
    </SvgFrame>
  );
}

/** Server-safe poster: the art plus the numbers as real HTML text with their source. */
export function TokenFunnelPoster() {
  const t = useTranslations("three.funnel");
  return (
    <figure className="m-0" aria-label={t("figureLabel")}>
      <div className="relative w-full" style={{ aspectRatio: "5 / 4" }}>
        <TokenFunnelArt />
      </div>
      <figcaption className="mt-4 text-sm text-muted-foreground">
        <p>
          <strong className="text-foreground">{t("stageRtk")}</strong> {t("rtkMeasured")}. <strong className="text-foreground">{t("stageCaveman")}</strong> {t("notMeasured")}.{" "}
          <strong className="text-foreground">{t("stageGraphify")}</strong> {t("notMeasured")}.
        </p>
        <p className="mt-2">{t("sourceMeasured")}</p>
        <p className="mt-2">{t("illustrative")}</p>
      </figcaption>
    </figure>
  );
}

export default TokenFunnelPoster;
