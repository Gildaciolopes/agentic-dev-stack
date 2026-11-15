const GITHUB = "https://api.github.com/repos/Gildaciolopes/agentic-dev-stack";
const NPM = "https://api.npmjs.org/downloads/point/last-month/agentic-dev-stack";

/** GitHub rejects requests without a User-Agent; no credentials or email are ever sent. */
const GITHUB_HEADERS = { "User-Agent": "agentic-dev-stack-site", Accept: "application/vnd.github+json" };
const NPM_HEADERS = { "User-Agent": "agentic-dev-stack-site", Accept: "application/json" };

export type SiteStats = { stars: number | null; downloads: number | null };

async function load(fetchImpl: typeof fetch, url: string, headers: Record<string, string>): Promise<unknown> {
  try {
    const res = await fetchImpl(url, { headers, next: { revalidate: 86400 }, signal: AbortSignal.timeout(8000) });
    if (!res.ok) {
      console.error(`[stats] ${url} -> HTTP ${res.status}`);
      return null;
    }
    return await res.json();
  } catch (err) {
    console.error(`[stats] ${url} failed:`, err);
    return null;
  }
}

function count(value: unknown): number | null {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

/** Each number is independent: a failed source yields null and is simply not rendered. */
export async function loadStats(fetchImpl: typeof fetch = fetch): Promise<SiteStats> {
  const [repo, npm] = await Promise.all([load(fetchImpl, GITHUB, GITHUB_HEADERS), load(fetchImpl, NPM, NPM_HEADERS)]);
  return {
    stars: count((repo as { stargazers_count?: unknown } | null)?.stargazers_count),
    downloads: count((npm as { downloads?: unknown } | null)?.downloads),
  };
}
