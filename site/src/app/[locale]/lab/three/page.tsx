import type { Metadata } from "next";
import { setRequestLocale } from "next-intl/server";
import { HeroFragments } from "@/components/three/hero-fragments";
import { Demo } from "./demo";

export const metadata: Metadata = { title: "3D lab", robots: { index: false, follow: false } };

export default async function Page({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  return (
    <main id="main" className="container-site section flex flex-col gap-16">
      <h1 className="text-display">3D lab.</h1>
      <div className="mx-auto w-full max-w-xl">
        <HeroFragments />
      </div>
      <Demo />
    </main>
  );
}
