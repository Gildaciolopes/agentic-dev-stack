import { notFound } from "next/navigation";
import { setRequestLocale } from "next-intl/server";

/** Unknown localized paths land here and render the localized 404. */
export default async function CatchAll({ params }: { params: Promise<{ locale: string; rest: string[] }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  notFound();
}
