import { ogMetadata, ogRender, type OgParams } from "@/lib/og-route";

export function generateImageMetadata(props: OgParams) {
  return ogMetadata("docs", props);
}

export default function Image(props: OgParams) {
  return ogRender("docs", props);
}
