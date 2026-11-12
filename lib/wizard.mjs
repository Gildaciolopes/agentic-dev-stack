// Interactive setup (create-next-app style). `npx agentic-dev-stack` with no arguments runs it.
// Every answer is saved to ~/.config/agentic-dev-stack/stack.env, so running it again is pre-filled,
// and "Update / repair" replays the saved answers without asking anything.
// Non-interactive: --yes (recommended defaults) or ADS_ANSWERS=answers.json (see docs/02-installation.md).
import fs from "node:fs";
import path from "node:path";
import { addProject } from "./add-project.mjs";
import { phaseCore } from "./core.mjs";
import { t, setLang, guessLang, getLang } from "./i18n.mjs";
import { configure9Router, status9Router } from "./ninerouter.mjs";
import { DIGEST_SECTIONS, phaseExtras, phaseFreeModels, phaseHermes, phaseWorkers } from "./phases.mjs";
import { banner, color, confirm, interactive, multiselect, note, password, select, text } from "./prompt.mjs";
import { uninstall } from "./uninstall.mjs";
import { IS_WIN, REPO, TODOS, skipInstalls, backupLocation, has, home, loadConfig, log, p, python, run } from "./util.mjs";

const CFG_DIR = () => p(home(), ".config", "agentic-dev-stack");
const CFG_FILE = () => p(CFG_DIR(), "stack.env");
const PROJECTS_FILE = () => p(CFG_DIR(), "projects.list");
const HHMM = /^([01]\d|2[0-3]):[0-5]\d$/;
const tilde = (s) => String(s).replace(home(), "~");

// ------------------------------------------------------------------ config file
export function writeConfig(values) {
  fs.mkdirSync(CFG_DIR(), { recursive: true });
  const base = fs.existsSync(CFG_FILE()) ? CFG_FILE() : p(REPO, "config", "stack.env.example");
  let s = fs.readFileSync(base, "utf8").replace(/\r\n/g, "\n");
  const added = [];
  for (const [k, raw] of Object.entries(values)) {
    if (raw === undefined) continue;
    const v = /^\d+$/.test(String(raw)) ? String(raw) : `"${String(raw).replace(/"/g, "")}"`;
    const re = new RegExp(`^${k}=.*$`, "m");
    if (re.test(s)) s = s.replace(re, `${k}=${v}`);
    else added.push(`${k}=${v}`);
  }
  if (added.length) s = s.trimEnd() + (s.includes("# --- set by the setup wizard ---") ? "\n" : "\n\n# --- set by the setup wizard ---\n") + added.join("\n") + "\n";
  fs.writeFileSync(CFG_FILE(), s);
  return CFG_FILE();
}

const readProjects = () => (fs.existsSync(PROJECTS_FILE()) ? fs.readFileSync(PROJECTS_FILE(), "utf8").split("\n").map((x) => x.trim()).filter(Boolean) : []);
function saveProjects(list) {
  const all = [...new Set([...readProjects(), ...list])];
  fs.mkdirSync(CFG_DIR(), { recursive: true });
  fs.writeFileSync(PROJECTS_FILE(), all.join("\n") + "\n");
}

// ------------------------------------------------------------------ discovery
function detect() {
  const tools = ["node", "git", "claude", "python3", "brew", "uv", "rtk", "agy", "opencode", "codex", "9router", "hermes", "specify", "graphify"];
  const found = Object.fromEntries(tools.map((x) => [x, x === "python3" ? !!python() : x === "node" ? true : has(x)]));
  found.hermes = found.hermes || fs.existsSync(p(home(), ".local", "bin", "hermes"));
  return found;
}

export function findRepos(dir, depth = 2) {
  const out = [];
  const walk = (d, lvl) => {
    let ents = [];
    try { ents = fs.readdirSync(d, { withFileTypes: true }); } catch { return; }
    if (ents.some((e) => e.name === ".git")) return out.push(d);
    if (lvl >= depth) return;
    for (const e of ents) if (e.isDirectory() && !e.name.startsWith(".") && !["node_modules", "vendor", "dist", "build"].includes(e.name)) walk(p(d, e.name), lvl + 1);
  };
  walk(dir, 0);
  const mtime = (d) => { try { return fs.statSync(p(d, ".git")).mtimeMs; } catch { return 0; } };
  return out.sort((a, b) => mtime(b) - mtime(a));
}

function projectDirs() {
  return ["projects", "code", "dev", "src", "Developer", "repos", "workspace", "Documents/GitHub"].map((d) => p(home(), d)).filter((d) => fs.existsSync(d));
}

// ------------------------------------------------------------------ bot helpers (Discord/Telegram)
const DISCORD_PERMS = "277025508352"; // view channels, send messages (+threads), embed, attach, read history, slash commands
async function discordBot(token) {
  try {
    const r = await fetch("https://discord.com/api/v10/users/@me", { headers: { Authorization: `Bot ${token}` }, signal: AbortSignal.timeout(15000) });
    if (!r.ok) return null;
    const u = await r.json();
    return { name: u.username, invite: `https://discord.com/oauth2/authorize?client_id=${u.id}&scope=bot%20applications.commands&permissions=${DISCORD_PERMS}` };
  } catch { return null; }
}
async function telegramBot(token) {
  try {
    const r = await fetch(`https://api.telegram.org/bot${token}/getMe`, { signal: AbortSignal.timeout(15000) });
    const d = await r.json();
    return d.ok ? { name: d.result.username } : null;
  } catch { return null; }
}
async function telegramUserId(token, seconds = 90) {
  const end = Date.now() + seconds * 1000;
  let offset = 0;
  while (Date.now() < end) {
    try {
      const r = await fetch(`https://api.telegram.org/bot${token}/getUpdates?timeout=20&offset=${offset}`, { signal: AbortSignal.timeout(25000) });
      const d = await r.json();
      for (const u of d.result || []) { offset = u.update_id + 1; const id = u.message?.from?.id; if (id) return String(id); }
    } catch { /* retry */ }
  }
  return null;
}

async function askToken(id, label, check) {
  for (let i = 0; i < 3; i++) {
    const tok = await password({ id: i ? `${id}_retry${i}` : id, message: label });
    if (!tok) return { token: "" };
    const bot = await check(tok);
    if (bot) { console.log(color.green(`  ✓ ${t("token_ok", { name: bot.name })}`)); return { token: tok, bot }; }
    console.log(color.red(`  ✖ ${t("token_bad")}`));
    if (!interactive()) break;
  }
  return { token: "" };
}

// ------------------------------------------------------------------ the questions
const COMPONENTS = ["caveman", "speckit", "graphify", "agy", "opencode", "codex", "squad", "free", "hermes", "headroom"];
const PRESETS = {
  rec: ["caveman", "speckit", "graphify", "agy", "opencode", "squad", "free", "hermes"],
  savers: ["caveman", "speckit", "graphify"],
};

function fromConfig(cfg) {
  const on = (k, d) => String(cfg[k] ?? d) === "1";
  return COMPONENTS.filter((c) => ({
    caveman: on("WITH_CAVEMAN", 1), speckit: on("WITH_SPECKIT", 1), graphify: on("WITH_GRAPHIFY", 1), agy: on("WITH_AGY", 1),
    opencode: on("WITH_OPENCODE", 1), codex: on("WITH_CODEX", 0), squad: on("WITH_SQUAD", 1), free: on("WITH_FREE_MODELS", 1),
    hermes: on("WITH_HERMES", 1), headroom: on("WITH_HEADROOM", 0),
  })[c]);
}

async function ask(cfg, firstRun, found) {
  const v = {}, secrets = {};
  const preset = await select({ id: "preset", message: t("preset"), initial: firstRun ? 0 : 2, choices: [
    { value: "rec", label: t("p_rec"), hint: t("p_rec_h") },
    { value: "savers", label: t("p_savers"), hint: t("p_savers_h") },
    { value: "custom", label: t("p_custom"), hint: t("p_custom_h") }] });
  let comps = preset === "custom" ? null : [...PRESETS[preset]];
  if (IS_WIN && comps) comps = comps.filter((c) => c !== "opencode" && c !== "hermes" && c !== "squad");
  if (!comps) {
    const cur = firstRun ? PRESETS.rec : fromConfig(cfg);
    const wsl = IS_WIN ? ` · ${t("win_wsl")}` : "";
    comps = await multiselect({ id: "components", message: t("components"), choices: [
      { value: "core", label: t("c_core"), locked: true },
      ...COMPONENTS.map((c) => ({ value: c, label: t(`c_${c}`), hint: t(`c_${c}_h`) + (["opencode", "hermes"].includes(c) ? wsl : "") + (found[c === "free" ? "9router" : c] ? " ✓" : ""),
        checked: cur.includes(c) && !(IS_WIN && ["opencode", "hermes", "squad"].includes(c)) })),
    ] });
  }
  const has_ = (c) => comps.includes(c);
  Object.assign(v, { WITH_CAVEMAN: +has_("caveman"), WITH_SPECKIT: +has_("speckit"), WITH_GRAPHIFY: +has_("graphify"), WITH_AGY: +has_("agy"), WITH_OPENCODE: +has_("opencode"),
    WITH_CODEX: +has_("codex"), WITH_SQUAD: +has_("squad"), WITH_FREE_MODELS: +has_("free"), WITH_HERMES: +has_("hermes"), WITH_HEADROOM: +has_("headroom") });
  if (IS_WIN && has_("opencode")) v.ALLOW_UNSANDBOXED_FREE_WORKER = 1;

  if (has_("caveman")) {
    const modes = ["caveman", "megacave", "ultracave", "off"];
    v.CAVEMAN_MODE = await select({ id: "caveman_mode", message: t("caveman_mode"), initial: Math.max(0, modes.indexOf(cfg.CAVEMAN_MODE || "caveman")),
      choices: [{ value: "caveman", label: t("cm_caveman") }, { value: "megacave", label: t("cm_mega") }, { value: "ultracave", label: t("cm_ultra") }, { value: "off", label: t("cm_off") }] });
  }

  if (has_("free")) {
    const st = found["9router"] && !skipInstalls() ? await status9Router() : { up: false };
    if (st.nvidia && st.free) note(t("nr_ok"));
    else {
      note("NVIDIA NIM", t("nr_guide"));
      secrets.nvidiaKey = await password({ id: "nvidia_key", message: t("nvidia_key"), validate: (s) => !s || s.startsWith("nvapi-") || t("nvidia_bad") });
    }
    if (!st.hasPassword) secrets.nrPassword = await password({ id: "ninerouter_password", message: t("nr_pass"), help: t("nr_pass_h"), validate: (s) => !s || s.length >= 8 || t("pass_short") });
    const cur = cfg.CURATOR_TIMES || "07:30 13:30 19:30";
    const presets = { "07:30 13:30 19:30": "3", "08:00 18:00": "2", "08:00 11:00 14:00 17:00 20:00 23:00": "6" };
    const choice = await select({ id: "curator", message: t("curator"), initial: ["3", "2", "6"].indexOf(presets[cur] || "x") >= 0 ? ["3", "2", "6"].indexOf(presets[cur]) : (firstRun ? 0 : 3),
      choices: [{ value: "07:30 13:30 19:30", label: t("cur_3") }, { value: "08:00 18:00", label: t("cur_2") }, { value: "08:00 11:00 14:00 17:00 20:00 23:00", label: t("cur_6") }, { value: "custom", label: t("cur_custom") }] });
    v.CURATOR_TIMES = choice !== "custom" ? choice : await text({ id: "curator_times", message: t("cur_times"), initial: cur, validate: (s) => s.split(/\s+/).every((x) => HHMM.test(x)) || t("bad_times") });
  }

  if (has_("hermes")) {
    v.HERMES_PLATFORM = await select({ id: "platform", message: t("platform"), initial: Math.max(0, ["discord", "telegram", "none"].indexOf(cfg.HERMES_PLATFORM || "discord")),
      choices: [{ value: "discord", label: t("pl_discord") }, { value: "telegram", label: t("pl_telegram") }, { value: "none", label: t("pl_none") }] });
    const envf = p(home(), ".hermes", ".env");
    const envs = fs.existsSync(envf) ? fs.readFileSync(envf, "utf8") : "";
    if (v.HERMES_PLATFORM === "discord" && !/^DISCORD_BOT_TOKEN=./m.test(envs)) {
      note("Discord", t("dc_guide"));
      const { token, bot } = await askToken("discord_token", t("dc_token"), discordBot);
      secrets.token = token;
      if (bot) note(t("invite"), [color.cyan(bot.invite)]);
    }
    if (v.HERMES_PLATFORM === "discord" && !/^DISCORD_ALLOWED_USERS=./m.test(envs))
      secrets.uid = await text({ id: "discord_user_id", message: t("dc_uid"), help: t("dc_uid_h"), validate: (s) => !s || /^\d{5,}$/.test(s) || t("uid_bad") });
    if (v.HERMES_PLATFORM === "telegram" && !/^TELEGRAM_BOT_TOKEN=./m.test(envs)) {
      note("Telegram", t("tg_guide"));
      const { token, bot } = await askToken("telegram_token", t("tg_token"), telegramBot);
      secrets.token = token;
      if (bot && interactive() && !/^TELEGRAM_ALLOWED_USERS=./m.test(envs)) {
        console.log(color.gray(`  ${t("tg_detect", { name: bot.name })}`));
        const id = await telegramUserId(token);
        if (id) { console.log(color.green(`  ✓ ${t("tg_found", { id })}`)); secrets.uid = id; }
      }
    }
    if (v.HERMES_PLATFORM === "telegram" && !secrets.uid && !/^TELEGRAM_ALLOWED_USERS=./m.test(envs))
      secrets.uid = await text({ id: "telegram_user_id", message: t("tg_uid"), help: t("tg_uid_h"), validate: (s) => !s || /^\d{4,}$/.test(s) || t("uid_bad") });

    v.DIGEST_SEND_TIME = await text({ id: "digest_time", message: t("digest_time"), initial: cfg.DIGEST_SEND_TIME || "08:00", validate: (s) => HHMM.test(s) || t("bad_time") });
    const [hh, mm] = v.DIGEST_SEND_TIME.split(":").map(Number);
    const collect = (hh * 60 + mm - 10 + 1440) % 1440;
    v.DIGEST_COLLECT_TIME = `${String(Math.floor(collect / 60)).padStart(2, "0")}:${String(collect % 60).padStart(2, "0")}`;
    const curS = String(cfg.DIGEST_SECTIONS || Object.keys(DIGEST_SECTIONS).join(",")).split(",");
    v.DIGEST_SECTIONS = (await multiselect({ id: "digest_sections", message: t("sections"),
      choices: Object.keys(DIGEST_SECTIONS).map((k) => ({ value: k, label: t(`s_${k}`), checked: curS.includes(k) })) })).join(",");
    if (has_("free")) v.COMBO_ALERT = +(await confirm({ id: "combo_alert", message: t("combo_alert"), initial: String(cfg.COMBO_ALERT ?? 1) === "1" }));
    const langs = ["English", "Português do Brasil", "Español"];
    const defL = cfg.SUMMARY_LANGUAGE && cfg.SUMMARY_LANGUAGE !== "English" ? cfg.SUMMARY_LANGUAGE : getLang() === "pt-BR" ? "Português do Brasil" : "English";
    const pick = await select({ id: "summary_language", message: t("sum_lang"), initial: langs.includes(defL) ? langs.indexOf(defL) : 3,
      choices: [...langs.map((l) => ({ value: l, label: l })), { value: "other", label: t("other") }] });
    v.SUMMARY_LANGUAGE = pick !== "other" ? pick : await text({ id: "summary_language_text", message: t("sum_lang_text"), initial: defL });
  }

  v.TIMEZONE = await text({ id: "timezone", message: t("tz"), initial: cfg.TIMEZONE && fs.existsSync(CFG_FILE()) ? cfg.TIMEZONE : Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC" });

  // projects
  const dirs = projectDirs();
  const curDir = cfg.PROJECTS_DIR && fs.existsSync(cfg.PROJECTS_DIR) ? cfg.PROJECTS_DIR : dirs[0];
  const dirChoices = [...new Set([curDir, ...dirs].filter(Boolean))].map((d) => ({ value: d, label: tilde(d), hint: `${findRepos(d).length} repos` }));
  let pdir = dirChoices.length ? await select({ id: "projects_dir", message: t("proj_dir"), choices: [...dirChoices, { value: "custom", label: t("proj_custom") }] }) : "custom";
  if (pdir === "custom") pdir = path.resolve((await text({ id: "projects_dir_text", message: t("proj_path"), initial: tilde(curDir || p(home(), "projects")), validate: (s) => fs.existsSync(s.replace(/^~/, home())) || t("no_dir") })).replace(/^~/, home()));
  v.PROJECTS_DIR = pdir;
  v.PROJECT_DOCS_LANG = await select({ id: "docs_lang", message: t("docs_lang"), initial: ((!firstRun && cfg.PROJECT_DOCS_LANG) || (getLang() === "pt-BR" ? "pt-BR" : "en")) === "pt-BR" ? 1 : 0,
    choices: [{ value: "en", label: "English" }, { value: "pt-BR", label: "Português (Brasil)" }] });
  const repos = findRepos(pdir);
  const wired = new Set(readProjects());
  let projects = [];
  if (repos.length) projects = await multiselect({ id: "projects", message: t("proj_pick"),
    choices: repos.map((r) => ({ value: r, label: path.relative(pdir, r) || path.basename(r), hint: wired.has(r) ? "✓" : "", checked: wired.has(r) || firstRun })) });
  else note(t("proj_none"));

  const gitEmail = run("git", ["config", "--global", "user.email"]).out;
  v.GIT_AUTHOR_EMAIL = await text({ id: "git_email", message: t("git_email"), initial: cfg.GIT_AUTHOR_EMAIL || gitEmail });
  v.WIZARD_LANG = getLang();
  return { v, secrets, comps, projects };
}

// ------------------------------------------------------------------ apply
const phasesFor = (cfg) => {
  const on = (k, d) => String(cfg[k] ?? d) === "1";
  return ["core",
    ...(on("WITH_AGY", 1) || on("WITH_OPENCODE", 1) || on("WITH_CODEX", 0) || on("WITH_SQUAD", 1) ? ["workers"] : []),
    ...(on("WITH_FREE_MODELS", 1) ? ["free-models"] : []),
    ...(on("WITH_HEADROOM", 0) || on("WITH_HERMES", 1) ? ["extras"] : []),
    ...(on("WITH_HERMES", 1) && !IS_WIN ? ["hermes"] : [])];
};

export async function apply(cfg, { secrets = {}, projects = [], refreshAll = false } = {}) {
  secrets = { uid: "", token: "", ...secrets }; // never fall back to the old line-by-line prompts
  const phases = phasesFor(cfg);
  note(t("installing"), [phases.join(" → ")]);
  phaseCore({ dryRun: false, cfg });
  if (phases.includes("workers")) phaseWorkers(cfg, { dryRun: false });
  if (phases.includes("free-models")) {
    phaseFreeModels(cfg, { dryRun: false });
    if (!skipInstalls() && has("9router")) {
      log.step(t("nr_conf"));
      try {
        for (const line of await configure9Router({ nvidiaKey: secrets.nvidiaKey, newPassword: secrets.nrPassword })) log.ok(line);
        const py = python(), cur = p(home(), ".local", "share", "agentic-dev-stack", "model-curator", "curate.py");
        if (py && fs.existsSync(cur) && secrets.nvidiaKey) { log.info(t("curator_run")); run(py, ["-I", cur], { timeout: 300_000 }); }
        if ((await status9Router()).nvidia) for (let i = TODOS.length - 1; i >= 0; i--) if (/^9Router: open|^After creating the 'free' combo/.test(TODOS[i])) TODOS.splice(i, 1);
      } catch (e) { log.warn(t("nr_fail", { err: e.message })); }
    }
  }
  if (phases.includes("extras")) phaseExtras(cfg, { dryRun: false });
  if (phases.includes("hermes")) await phaseHermes(cfg, { dryRun: false, secrets });

  const list = refreshAll ? readProjects() : projects;
  if (list.length) {
    log.step(t("wiring"));
    for (const d of list) {
      if (!fs.existsSync(d)) { log.warn(`${tilde(d)}: not found`); continue; }
      try { console.log(color.bold(`  ${tilde(d)}`)); addProject(d, { refresh: true, lang: cfg.PROJECT_DOCS_LANG || "en" }); }
      catch (e) { log.warn(`${tilde(d)}: ${e.message}`); }
    }
    saveProjects(list);
  }
  return phases;
}

function finish(cfg) {
  for (let i = TODOS.length - 1; i >= 0; i--) if (/^In each project: npx agentic-dev-stack add-project/.test(TODOS[i])) TODOS.splice(i, 1);
  note(t("done") + " ✔");
  if (backupLocation()) log.info(`backups: ${tilde(backupLocation())}`);
  const tips = [t("tip_open")];
  if (String(cfg.WITH_GRAPHIFY ?? 1) === "1") tips.push(t("tip_graph"));
  if (String(cfg.WITH_SPECKIT ?? 1) === "1") tips.push(t("tip_sdd"));
  tips.push(t("tip_deleg"));
  if (String(cfg.WITH_HERMES ?? 1) === "1" && !IS_WIN) tips.push(t("tip_digest", { time: cfg.DIGEST_SEND_TIME || "08:00" }));
  tips.push(t("tip_new"), t("tip_again"));
  if (TODOS.length) note(t("next"), TODOS.map((x, i) => `${i + 1}. ${x}`));
  note("💡", tips);
}

// ------------------------------------------------------------------ entry points
export async function wizard({ version, doctor }) {
  banner(version);
  const firstRun = !fs.existsSync(CFG_FILE());
  const cfg0 = loadConfig(undefined, { noCopy: true }); // aborting the wizard must leave no trace
  setLang(cfg0.WIZARD_LANG && !firstRun ? cfg0.WIZARD_LANG : guessLang());
  setLang(await select({ id: "lang", message: t("lang"), initial: getLang() === "pt-BR" ? 1 : 0, choices: [{ value: "en", label: "English" }, { value: "pt-BR", label: "Português (Brasil)" }] }));

  const found = detect();
  note(t("detected"), [Object.entries(found).map(([k, ok]) => (ok ? color.green(`✓ ${k}`) : color.gray(`· ${k}`))).join("  ")]);
  const missing = ["git"].filter((x) => !found[x]);
  if (missing.length) { log.err(`${t("missing_required")}: ${missing.join(", ")}`); process.exitCode = 1; return; }
  if (!found.claude) log.warn(t("claude_missing"));

  if (!firstRun) {
    const act = await select({ id: "action", message: t("existing"), choices: [
      { value: "update", label: t("act_update"), hint: t("act_update_h") }, { value: "change", label: t("act_change"), hint: t("act_change_h") },
      { value: "projects", label: t("act_projects") }, { value: "new", label: t("act_new") }, { value: "doctor", label: t("act_doctor") },
      { value: "uninstall", label: t("act_uninstall") }, { value: "exit", label: t("act_exit") }] });
    if (act === "exit") return;
    if (act === "doctor") return doctor();
    if (act === "uninstall") { if (await confirm({ id: "confirm_uninstall", message: `${t("act_uninstall")}?`, initial: false })) uninstall({}); return; }
    if (act === "new") return newProject({});
    if (act === "update") { const cfg = loadConfig(); await apply(cfg, { refreshAll: true }); doctor(); return finish(cfg); }
    if (act === "projects") {
      const cfg = loadConfig();
      const repos = findRepos(cfg.PROJECTS_DIR || p(home(), "projects"));
      const wired = new Set(readProjects());
      const pick = await multiselect({ id: "projects", message: t("proj_pick"), choices: repos.map((r) => ({ value: r, label: path.relative(cfg.PROJECTS_DIR, r), hint: wired.has(r) ? "✓" : "", checked: wired.has(r) })) });
      for (const d of pick) addProject(d, { refresh: true, lang: cfg.PROJECT_DOCS_LANG || "en" });
      saveProjects(pick);
      return;
    }
  }

  const { v, secrets, comps, projects } = await ask(cfg0, firstRun, found);
  note(t("summary"), [
    `${color.bold("components")}: core, ${comps.filter((c) => c !== "core").join(", ")}`,
    ...(v.CURATOR_TIMES ? [`${color.bold("curator")}: ${v.CURATOR_TIMES}`] : []),
    ...(v.HERMES_PLATFORM ? [`${color.bold("hermes")}: ${v.HERMES_PLATFORM} · ${v.DIGEST_SEND_TIME} · ${v.SUMMARY_LANGUAGE}`] : []),
    `${color.bold("projects")}: ${projects.length} (${tilde(v.PROJECTS_DIR)}) · ${v.PROJECT_DOCS_LANG}`,
    `${color.bold("config")}: ${tilde(CFG_FILE())}`,
  ]);
  if (!(await confirm({ id: "confirm", message: t("confirm") }))) { console.log(color.gray(`  ${t("aborted")}`)); return; }
  writeConfig(v);
  const cfg = loadConfig();
  await apply(cfg, { secrets, projects });
  doctor();
  finish(cfg);
}

// npx agentic-dev-stack new [name]
const SCAFFOLD = {
  next: (name) => ["npx", ["-y", "create-next-app@latest", name]],
  vite: (name) => ["npm", ["create", "vite@latest", name]],
  astro: (name) => ["npm", ["create", "astro@latest", name]],
  python: (name) => ["uv", ["init", name]],
};
export async function newProject({ name: given, lang }) {
  const cfg = loadConfig();
  setLang(lang || cfg.WIZARD_LANG || guessLang());
  const name = given || await text({ id: "new_name", message: t("new_name"), placeholder: "my-app", validate: (s) => /^[a-zA-Z0-9._-]+$/.test(s) || "letters, numbers, . _ -" });
  const parent = path.resolve((await text({ id: "new_parent", message: t("new_parent"), initial: tilde(cfg.PROJECTS_DIR || p(home(), "projects")) })).replace(/^~/, home()));
  const dir = p(parent, name);
  if (fs.existsSync(dir) && fs.readdirSync(dir).length) throw new Error(`${tilde(dir)}: ${t("new_exists")}`);
  fs.mkdirSync(parent, { recursive: true });
  const sc = await select({ id: "new_scaffold", message: t("new_scaffold"), choices: [
    { value: "none", label: t("sc_none") }, { value: "next", label: t("sc_next") }, { value: "vite", label: t("sc_vite") },
    { value: "astro", label: t("sc_astro") }, { value: "python", label: t("sc_py") }] });
  if (sc !== "none") {
    const [cmd, args] = SCAFFOLD[sc](name);
    if (!has(cmd)) throw new Error(`${cmd} not found`);
    // the framework's own questions run here, in your terminal
    const r = run(cmd, args, { cwd: parent, stdio: "inherit", timeout: 1_800_000 });
    if (r.code !== 0 && !fs.existsSync(dir)) throw new Error(`${cmd} ${args.join(" ")} failed`);
  }
  fs.mkdirSync(dir, { recursive: true });
  if (!fs.existsSync(p(dir, ".git"))) run("git", ["init", "-q"], { cwd: dir });
  const sdd = has("specify") && await confirm({ id: "new_speckit", message: t("new_speckit"), initial: String(cfg.WITH_SPECKIT ?? 1) === "1" });
  if (sdd) {
    const r = run("specify", ["init", "--here", "--integration", "claude", "--non-interactive", "--ignore-agent-tools", ...(IS_WIN ? ["--script", "ps"] : [])], { cwd: dir, stdio: "inherit", timeout: 600_000 });
    if (r.code !== 0) log.warn("specify init failed; run it later inside the project: specify init --here --integration claude");
  }
  addProject(dir, { lang: cfg.PROJECT_DOCS_LANG || "en" });
  saveProjects([dir]);
  note(t("new_done", { dir: tilde(dir) }), [`cd ${tilde(dir)} && claude`, ...(String(cfg.WITH_GRAPHIFY ?? 1) === "1" ? ["/graphify"] : []), ...(sdd ? ["/speckit.constitution  →  /speckit.specify <idea>"] : [])]);
}

