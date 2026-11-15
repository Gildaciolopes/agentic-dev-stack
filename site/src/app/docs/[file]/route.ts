import { getDocSlugs, getRawDoc } from "@/lib/docs";

export const dynamic = "force-static";
export const dynamicParams = false;

export async function generateStaticParams() {
  return (await getDocSlugs()).map((slug) => ({ file: `${slug}.md` }));
}

export async function GET(_req: Request, { params }: { params: Promise<{ file: string }> }) {
  const { file } = await params;
  const markdown = file.endsWith(".md") ? await getRawDoc(file.slice(0, -3)) : null;
  if (markdown === null) return new Response("Not found", { status: 404 });
  return new Response(markdown, { headers: { "content-type": "text/markdown; charset=utf-8" } });
}
