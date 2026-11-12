// Zero-dependency interactive prompts (create-next-app style): select, multiselect, confirm, text, password.
// Works on macOS, Linux and Windows terminals (ANSI + raw mode).
// Non-interactive use: answers come from ADS_ANSWERS (path to a JSON file {id: value}) or from each prompt's default.
import fs from "node:fs";
import readline from "node:readline";

const NO_COLOR = !!process.env.NO_COLOR || !process.stdout.isTTY;
const c = (code) => (s) => (NO_COLOR ? String(s) : `\x1b[${code}m${s}\x1b[0m`);
export const color = { bold: c(1), dim: c(2), cyan: c(36), green: c(32), yellow: c(33), red: c(31), magenta: c(35), gray: c(90) };

let preset = null;
function answers() {
  if (preset) return preset;
  preset = {};
  if (process.env.ADS_ANSWERS) preset = JSON.parse(fs.readFileSync(process.env.ADS_ANSWERS, "utf8"));
  return preset;
}
export const interactive = () => !!(process.stdin.isTTY && process.stdout.isTTY) && !process.env.ADS_ANSWERS && !process.env.ADS_YES;
export function setAnswers(obj) { preset = { ...answers(), ...obj }; }

// Returns the preset answer for `id` if there is one, otherwise undefined.
function fromPreset(id) { const a = answers(); return Object.prototype.hasOwnProperty.call(a, id) ? a[id] : undefined; }

function keyloop(render, onKey) {
  return new Promise((resolve, reject) => {
    const { stdin, stdout } = process;
    readline.emitKeypressEvents(stdin);
    stdin.setRawMode(true);
    stdin.resume();
    let lines = 0, closed = false;
    const draw = () => {
      if (closed) return;
      if (lines) stdout.write(`\x1b[${lines}A\r\x1b[J`);
      const out = render();
      stdout.write(out + "\n");
      lines = out.split("\n").length;
    };
    const finish = (value, summary) => {
      closed = true;
      stdin.off("keypress", handler);
      stdin.setRawMode(false);
      stdin.pause();
      if (lines) stdout.write(`\x1b[${lines}A\r\x1b[J`);
      stdout.write(summary + "\n");
      resolve(value);
    };
    const handler = (str, key = {}) => {
      if (key.ctrl && key.name === "c") { stdin.setRawMode(false); stdout.write("\n"); process.exit(130); }
      try { onKey(str, key, finish); } catch (e) { reject(e); }
      draw();
    };
    stdin.on("keypress", handler);
    process.stdout.write("\x1b[?25l");
    process.once("exit", () => process.stdout.write("\x1b[?25h"));
    draw();
  }).finally(() => process.stdout.write("\x1b[?25h"));
}

const q = (message) => `${color.cyan("?")} ${color.bold(message)}`;
const doneLine = (message, shown) => `${color.green("✔")} ${color.bold(message)} ${color.cyan(shown)}`;

/** choices: [{value, label, hint?}] */
export async function select({ id, message, choices, initial = 0, help }) {
  const p = fromPreset(id);
  if (p !== undefined || !interactive()) {
    const v = p !== undefined ? p : choices[initial].value;
    if (!choices.some((ch) => ch.value === v)) throw new Error(`invalid answer for ${id}: ${v}`);
    return v;
  }
  let i = initial;
  return keyloop(
    () => [q(message) + (help ? color.gray(`  ${help}`) : color.gray("  ↑/↓ enter")),
      ...choices.map((ch, k) => `${k === i ? color.cyan("❯ ") : "  "}${k === i ? color.cyan(ch.label) : ch.label}${ch.hint ? color.gray(`  ${ch.hint}`) : ""}`)].join("\n"),
    (_s, key, finish) => {
      if (key.name === "up" || key.name === "k") i = (i - 1 + choices.length) % choices.length;
      else if (key.name === "down" || key.name === "j") i = (i + 1) % choices.length;
      else if (key.name === "return") finish(choices[i].value, doneLine(message, choices[i].label));
    });
}

/** choices: [{value, label, hint?, checked?, locked?}] -> array of values */
export async function multiselect({ id, message, choices, help }) {
  const p = fromPreset(id);
  if (p !== undefined || !interactive()) {
    const v = p !== undefined ? p : choices.filter((ch) => ch.checked || ch.locked).map((ch) => ch.value);
    return [...new Set([...v, ...choices.filter((ch) => ch.locked).map((ch) => ch.value)])];
  }
  let i = 0;
  const on = new Set(choices.filter((ch) => ch.checked || ch.locked).map((ch) => ch.value));
  return keyloop(
    () => [q(message) + color.gray(help ? `  ${help}` : "  ↑/↓ move · space toggle · a all · enter confirm"),
      ...choices.map((ch, k) => {
        const box = ch.locked ? color.gray("◉") : on.has(ch.value) ? color.green("◉") : "◯";
        const label = k === i ? color.cyan(ch.label) : ch.label;
        return `${k === i ? color.cyan("❯") : " "} ${box} ${label}${ch.locked ? color.gray("  (always)") : ""}${ch.hint ? color.gray(`  ${ch.hint}`) : ""}`;
      })].join("\n"),
    (s, key, finish) => {
      const ch = choices[i];
      if (key.name === "up" || key.name === "k") i = (i - 1 + choices.length) % choices.length;
      else if (key.name === "down" || key.name === "j") i = (i + 1) % choices.length;
      else if (key.name === "space" && !ch.locked) on.has(ch.value) ? on.delete(ch.value) : on.add(ch.value);
      else if (s === "a") { const all = choices.every((x) => on.has(x.value)); choices.forEach((x) => (all && !x.locked ? on.delete(x.value) : on.add(x.value))); }
      else if (key.name === "return") {
        const v = choices.filter((x) => on.has(x.value)).map((x) => x.value);
        finish(v, doneLine(message, choices.filter((x) => on.has(x.value)).map((x) => x.label.split("  ")[0]).join(", ") || "none"));
      }
    });
}

export async function confirm({ id, message, initial = true }) {
  const p = fromPreset(id);
  if (p !== undefined || !interactive()) return p !== undefined ? !!p : initial;
  let v = initial;
  return keyloop(
    () => `${q(message)} ${v ? color.cyan(color.bold("Yes")) + " / no" : "yes / " + color.cyan(color.bold("No"))}${color.gray("  ←/→ y/n enter")}`,
    (s, key, finish) => {
      if (["left", "right", "tab"].includes(key.name)) v = !v;
      else if (s === "y" || s === "s") v = true;
      else if (s === "n") v = false;
      else if (key.name === "return") finish(v, doneLine(message, v ? "Yes" : "No"));
    });
}

/** validate(value) -> true | "error message" */
export async function text({ id, message, initial = "", placeholder = "", validate, secret = false, help }) {
  const p = fromPreset(id);
  if (p !== undefined || !interactive()) {
    const v = String(p !== undefined ? p : initial);
    const ok = validate ? validate(v) : true;
    if (ok !== true) throw new Error(`invalid answer for ${id}: ${ok}`);
    return v;
  }
  let v = String(initial), err = "";
  return keyloop(
    () => {
      const shown = secret ? "•".repeat(v.length) : v;
      const ph = !v && placeholder ? color.gray(placeholder) : "";
      return `${q(message)}${help ? color.gray(`  ${help}`) : ""}\n${color.cyan("›")} ${shown}${ph}${color.cyan("▏")}${err ? `\n${color.red("✖ " + err)}` : ""}`;
    },
    (s, key, finish) => {
      if (key.name === "return") {
        const ok = validate ? validate(v.trim()) : true;
        if (ok === true) finish(v.trim(), doneLine(message, secret ? (v ? "•••• (saved)" : "skipped") : v.trim() || "(empty)"));
        else err = ok;
      } else if (key.name === "backspace") { v = v.slice(0, -1); err = ""; }
      else if (key.ctrl && key.name === "u") v = "";
      else if (s && !key.ctrl && !key.meta && s >= " ") { v += s; err = ""; }
    });
}

export const password = (opts) => text({ ...opts, secret: true });

export function note(title, lines = []) {
  const body = Array.isArray(lines) ? lines : [lines];
  console.log(`\n${color.magenta("◆")} ${color.bold(title)}`);
  for (const l of body) console.log(`  ${color.gray("│")} ${l}`);
}

export function banner(version) {
  const y = (s) => (NO_COLOR ? s : `\x1b[33m${s}\x1b[0m`);
  console.log(`\n  ${color.bold("agentic-dev-")}${y(color.bold("stack"))} ${color.gray("v" + version)}`);
  console.log(`  ${color.gray("smart vibe coding: Opus plans, cheap & free models execute, another provider reviews")}\n`);
}
