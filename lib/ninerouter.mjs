// Configure a local 9Router through its HTTP API, so nobody has to click through the dashboard:
// NVIDIA NIM provider -> combo "free" -> API key -> OpenCode wired to 9router/free -> (optional) new dashboard password.
// Auth: the same local CLI token 9Router's own CLI uses (sha256(machineId + "9r-cli-auth" + cliSecret)[:16]),
// read from files only the current user can read. Nothing here leaves the machine except the NVIDIA model listing.
import crypto from "node:crypto";
import fs from "node:fs";
import { home, log, p } from "./util.mjs";

export const NR_URL = "http://127.0.0.1:20128";
const dataDir = () => process.env.NINEROUTER_DATA_DIR || p(home(), ".9router");

export function cliToken() {
  const mid = p(dataDir(), "machine-id"), sec = p(dataDir(), "auth", "cli-secret");
  if (!fs.existsSync(mid) || !fs.existsSync(sec)) return null;
  const machineId = fs.readFileSync(mid, "utf8").trim(), secret = fs.readFileSync(sec, "utf8").trim();
  return crypto.createHash("sha256").update(machineId + "9r-cli-auth" + secret).digest("hex").substring(0, 16);
}

async function api(method, path, body) {
  const token = cliToken();
  if (!token) throw new Error("9Router CLI token not found (start 9router once so it creates ~/.9router)");
  const r = await fetch(NR_URL + path, {
    method, headers: { "content-type": "application/json", "x-9r-cli-token": token },
    body: body ? JSON.stringify(body) : undefined, signal: AbortSignal.timeout(30_000),
  });
  const text = await r.text();
  let data; try { data = text ? JSON.parse(text) : {}; } catch { data = { raw: text }; }
  return { status: r.status, ok: r.ok, data };
}

export async function waitUp(seconds = 40) {
  for (let i = 0; i < seconds; i++) {
    try { if ((await fetch(NR_URL + "/api/health", { signal: AbortSignal.timeout(2000) })).ok) return true; } catch { /* not yet */ }
    await new Promise((r) => setTimeout(r, 1000));
  }
  return false;
}

// Same ranking as scripts/model-curator/curate.py: best coding families first, small/specialized models out.
const FAMILIES = [
  [/nemotron-3-ultra/i, 1], [/kimi-k2/i, 2], [/glm-5(?!.*flash)/i, 3], [/deepseek-v4(?!.*flash)/i, 3],
  [/qwen3\.[5-9].*(max|plus|coder|235b|480b)/i, 4], [/glm-5.*flash/i, 5], [/deepseek-v4.*flash/i, 5],
  [/minimax-m3/i, 6], [/nemotron-3(\.5)?-super/i, 7], [/gpt-oss-120b/i, 8], [/llama-4/i, 9],
  [/mistral-(large|medium)/i, 9], [/qwen3/i, 10],
];
const EXCLUDE = /embed|rerank|safety|guard|reward|parse|vl-|-vl\b|vision|bolt|nano|tts|asr|whisper|coder-6\.7b|8b|7b|3b|1b|instruct-51b|nemotron-4|retriever|clip/i;

export function rankModels(ids, keep = 4) {
  return ids.filter((id) => !EXCLUDE.test(id))
    .map((id) => [FAMILIES.find(([re]) => re.test(id))?.[1], id]).filter(([r]) => r)
    .sort((a, b) => a[0] - b[0]).slice(0, keep).map(([, id]) => `nvidia/${id}`);
}

export async function seedModels() {
  try {
    const r = await fetch("https://integrate.api.nvidia.com/v1/models", { signal: AbortSignal.timeout(30_000) });
    return rankModels((await r.json()).data.map((m) => m.id));
  } catch { return ["nvidia/meta/llama-3.3-70b-instruct"]; }
}

const list = (d, k) => (Array.isArray(d) ? d : d?.[k] || d?.data || []);

/** Returns a list of human-readable results; throws only on unrecoverable errors. */
export async function configure9Router({ nvidiaKey, newPassword, combo = "free" }) {
  const done = [];
  if (!(await waitUp())) throw new Error(`9Router is not answering on ${NR_URL} (start it with: 9router)`);

  if (nvidiaKey) {
    const v = await api("POST", "/api/providers/validate", { provider: "nvidia", apiKey: nvidiaKey });
    if (v.ok && v.data.valid === false) throw new Error(`NVIDIA key rejected: ${v.data.error || "invalid"}`);
    const existing = list((await api("GET", "/api/providers")).data, "connections").filter((c) => c.provider === "nvidia");
    if (existing.length) done.push(`NVIDIA NIM provider already connected (${existing.length})`);
    else {
      const r = await api("POST", "/api/providers", { provider: "nvidia", apiKey: nvidiaKey, name: "NVIDIA NIM (agentic-dev-stack)", priority: 1, defaultModel: null, testStatus: "unknown" });
      if (!r.ok && r.status !== 409) throw new Error(`could not add NVIDIA provider (${r.status}): ${JSON.stringify(r.data).slice(0, 160)}`);
      done.push("NVIDIA NIM provider connected");
    }
  }

  const models = await seedModels();
  const combos = list((await api("GET", "/api/combos")).data, "combos");
  const cur = combos.find((c) => c.name === combo);
  if (cur) done.push(`combo '${combo}' already exists (the curator keeps it healthy)`);
  else {
    const r = await api("POST", "/api/combos", { name: combo, models, kind: null });
    if (!r.ok) throw new Error(`could not create combo '${combo}' (${r.status})`);
    done.push(`combo '${combo}' created: ${models.map((m) => m.replace(/^nvidia\//, "")).join(", ")}`);
  }

  let keys = list((await api("GET", "/api/keys")).data, "keys");
  if (!keys.length) {
    const r = await api("POST", "/api/keys", { name: "agentic-dev-stack" });
    if (!r.ok) throw new Error(`could not create a 9Router API key (${r.status})`);
    keys = [r.data];
    done.push("9Router API key created");
  }

  const oc = await api("POST", "/api/cli-tools/opencode-settings", { baseUrl: NR_URL, apiKey: "", models: [combo], activeModel: combo, subagentModel: combo });
  done.push(oc.ok ? `OpenCode -> 9router/${combo}` : `OpenCode not wired automatically (${oc.status}); dashboard: CLI Tools -> OpenCode -> Apply`);

  if (newPassword) {
    const s = await api("GET", "/api/settings");
    if (s.data?.hasPassword) done.push("dashboard password already set (left unchanged)");
    else {
      const r = await api("PATCH", "/api/settings", { currentPassword: "123456", newPassword });
      done.push(r.ok ? "dashboard password changed (default 123456 no longer works)" : `password not changed (${r.status}); change it in the dashboard`);
    }
  }
  return done;
}

export async function status9Router() {
  if (!(await waitUp(2))) return { up: false };
  try {
    const providers = list((await api("GET", "/api/providers")).data, "connections");
    const combos = list((await api("GET", "/api/combos")).data, "combos");
    const s = await api("GET", "/api/settings");
    return { up: true, nvidia: providers.some((c) => c.provider === "nvidia"), free: combos.find((c) => c.name === "free"), hasPassword: !!s.data?.hasPassword };
  } catch (e) { log.warn(`9Router status: ${e.message}`); return { up: true }; }
}
