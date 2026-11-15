import { getReadmeSummary, listDocs } from "@/lib/docs";
import { site } from "@/lib/site";

export const dynamic = "force-static";

export async function GET() {
  const docs = await listDocs();
  const lines = [
    `# ${site.name}`,
    "",
    `> ${await getReadmeSummary()}`,
    "",
    "## Docs",
    "",
    ...docs.map((d) => `- [${d.title}](${site.url}/docs/${d.slug}.md): ${d.description}`),
    "",
    "## Optional",
    "",
    `- [Changelog](${site.url}/changelog.md): every release`,
    `- [Full documentation](${site.url}/llms-full.txt): README and all docs in one file`,
    `- [Source](${site.repo}): repository`,
    "",
  ];
  return new Response(lines.join("\n"), { headers: { "content-type": "text/plain; charset=utf-8" } });
}
