import type { Metadata } from "next";
import { setRequestLocale } from "next-intl/server";
import { Button } from "@/components/ui/button";
import { Card, CardBody, CardHeader, CardTitle } from "@/components/ui/card";
import { CodeWindow } from "@/components/ui/code-window";
import { GradFrameCard } from "@/components/ui/grad-frame-card";
import { InstallCommand } from "@/components/ui/install-command";
import { IsoIcon, type IsoVariant } from "@/components/ui/iso-icon";
import { Marquee } from "@/components/ui/marquee";
import { SectionHeader } from "@/components/ui/section-header";
import { LegendDemo } from "./legend-demo";

export const metadata: Metadata = { title: "UI kit", robots: { index: false, follow: false } };

const ICONS: IsoVariant[] = ["cube", "slabs", "toggle", "striped", "arch"];
const CODE = `{
  "mcpServers": {
    "9router": { "url": "http://localhost:20128" }
  }
}`;

function Showcase({ dark }: { dark: boolean }) {
  return (
    <div className={`${dark ? "dark " : ""}bg-background text-foreground`}>
      <div className="flex flex-col gap-12 p-6 md:p-10">
        <p className="section-label">{dark ? "dark" : "light"}</p>

        <SectionHeader index="01" label="Architecture" title={"Seven agents.\nOne stack."} intro="Short paragraph under the headline, muted and roomy." />

        <div className="flex flex-wrap gap-3">
          <Button>Primary</Button>
          <Button variant="secondary">Secondary</Button>
          <Button variant="ghost">Ghost</Button>
          <Button size="sm">Small</Button>
          <Button size="lg" href="/">Large link</Button>
        </div>

        <div className="grid gap-4 md:grid-cols-2">
          <Card>
            <CardHeader>
              <CardTitle>Card title</CardTitle>
            </CardHeader>
            <CardBody>Square corners, 1px border, card surface.</CardBody>
          </Card>
          <div className="grid grid-cols-3 gap-3">
            <GradFrameCard tone="warm">warm</GradFrameCard>
            <GradFrameCard tone="cool">cool</GradFrameCard>
            <GradFrameCard tone="mint">mint</GradFrameCard>
          </div>
        </div>

        <div className="flex flex-wrap gap-6">
          {ICONS.map((v) => (
            <IsoIcon key={v} variant={v} size={72} />
          ))}
        </div>

        <InstallCommand command="npx agentic-dev-stack" copyLabel="Copy" copiedLabel="Copied" />
        <CodeWindow filename="mcp.json" code={CODE} copyLabel="Copy" copiedLabel="Copied" />

        <LegendDemo />

        <div className="flex flex-col gap-4">
          {(["left", "right"] as const).map((d) => (
            <Marquee key={d} direction={d} speed={30}>
              {Array.from({ length: 6 }, (_, i) => (
                <Card key={i} className="w-64 flex-none">
                  <CardBody>marquee {d} {i + 1}</CardBody>
                </Card>
              ))}
            </Marquee>
          ))}
        </div>
      </div>
    </div>
  );
}

export default async function KitPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  return (
    <main id="main" className="grid lg:grid-cols-2">
      <Showcase dark />
      <Showcase dark={false} />
    </main>
  );
}
