import { getChangelogRaw } from "@/lib/docs";

export const dynamic = "force-static";

export async function GET() {
  return new Response(await getChangelogRaw(), { headers: { "content-type": "text/markdown; charset=utf-8" } });
}
