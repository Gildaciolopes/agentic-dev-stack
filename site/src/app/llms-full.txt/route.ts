import { getDocSlugs, getRawDoc, getReadme } from "@/lib/docs";
import { site } from "@/lib/site";

export const dynamic = "force-static";

export async function GET() {
  const parts = [`# ${site.name}: full documentation\n\nSource: ${site.url}\n`, await getReadme()];
  for (const slug of await getDocSlugs()) parts.push(`<!-- ${site.url}/docs/${slug}.md -->\n\n${await getRawDoc(slug)}`);
  return new Response(parts.join("\n\n---\n\n"), { headers: { "content-type": "text/plain; charset=utf-8" } });
}
