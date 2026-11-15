import { setRequestLocale } from "next-intl/server";

export default async function Home({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  return <main id="main" className="container-site section"><h1 className="text-display">agentic-dev-stack.</h1></main>;
}
