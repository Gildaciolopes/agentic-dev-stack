import { afterEach, describe, expect, it, vi } from "vitest";
import { loadStats } from "./stats";

const json = (body: unknown, ok = true) => ({ ok, status: ok ? 200 : 503, json: async () => body }) as Response;

function mockFetch(handlers: { github: () => Promise<Response>; npm: () => Promise<Response> }) {
  return vi.fn(async (url: string | URL | Request) => (String(url).includes("github") ? handlers.github() : handlers.npm())) as unknown as typeof fetch;
}

afterEach(() => vi.restoreAllMocks());

describe("loadStats", () => {
  it("returns both numbers and sends a User-Agent to GitHub", async () => {
    const f = mockFetch({
      github: async () => json({ stargazers_count: 6 }),
      npm: async () => json({ downloads: 1034 }),
    });
    expect(await loadStats(f)).toEqual({ stars: 6, downloads: 1034 });
    const calls = (f as unknown as ReturnType<typeof vi.fn>).mock.calls as [string, RequestInit][];
    const gh = calls.find(([u]) => u.includes("github"))!;
    expect((gh[1].headers as Record<string, string>)["User-Agent"]).toBe("agentic-dev-stack-site");
    expect((gh[1].headers as Record<string, string>).Accept).toBe("application/vnd.github+json");
  });

  it("keeps the surviving number when one source fails", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    const f = mockFetch({
      github: async () => {
        throw new Error("boom");
      },
      npm: async () => json({ downloads: 1034 }),
    });
    expect(await loadStats(f)).toEqual({ stars: null, downloads: 1034 });
  });

  it("returns nulls when both fail (HTTP error + bad shape)", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    const f = mockFetch({
      github: async () => json({}, false),
      npm: async () => json({ downloads: "many" }),
    });
    expect(await loadStats(f)).toEqual({ stars: null, downloads: null });
  });
});
