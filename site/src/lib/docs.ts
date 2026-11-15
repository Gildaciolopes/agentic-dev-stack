import fs from "node:fs/promises";
import path from "node:path";
import { unified } from "unified";
import remarkParse from "remark-parse";
import remarkGfm from "remark-gfm";
import remarkRehype from "remark-rehype";
import rehypeSlug from "rehype-slug";
import rehypeStringify from "rehype-stringify";
import { createHighlighter, type Highlighter } from "shiki";
import type { Element, Root as HastRoot, ElementContent, RootContent } from "hast";
import type { Root as MdastRoot, RootContent as MdastNode } from "mdast";
import { getPathname } from "@/i18n/navigation";
import type { Locale } from "@/i18n/routing";
import messages from "../../messages/en/docs.json";
import { site } from "@/lib/site";

/** Hand-written descriptions for docs whose first paragraph is not a usable summary. */
const descriptionOverrides: Record<string, string> = messages.descriptions;

const repoRoot = path.join(process.cwd(), "..");
const docsDir = path.join(repoRoot, "docs");
const repoBlob = `${site.repo}/blob/main`;
const repoRaw = `${site.repo.replace("https://github.com", "https://raw.githubusercontent.com")}/main`;

export type TocItem = { id: string; text: string; depth: 2 | 3 };
export type DocMeta = { slug: string; file: string; number: string; title: string; description: string };
export type Doc = DocMeta & { markdown: string; html: string; toc: TocItem[] };

/* ---------- helpers ---------- */

function nodeText(node: MdastNode | MdastRoot): string {
  if (node.type === "image" || node.type === "html") return "";
  if ("value" in node && typeof node.value === "string") return node.value;
  if ("children" in node) return (node.children as MdastNode[]).map(nodeText).join("");
  return "";
}

function hastText(node: Element | RootContent): string {
  if (node.type === "text") return node.value;
  if (node.type === "element") return node.children.map(hastText).join("");
  return "";
}

function truncate(text: string, max = 160): string {
  const clean = text.replace(/\s+/g, " ").trim();
  if (clean.length <= max) return clean;
  const cut = clean.slice(0, max - 1);
  return `${cut.slice(0, Math.max(cut.lastIndexOf(" "), 40)).replace(/[\s,.;:]+$/, "")}…`;
}

function firstParagraph(tree: MdastRoot): string {
  const find = (nodes: MdastNode[]): string => {
    for (const n of nodes) {
      if (n.type === "paragraph") {
        const t = nodeText(n).replace(/\s+/g, " ").trim();
        if (t) return t;
      } else if (n.type === "blockquote") {
        const t = find(n.children);
        if (t) return t;
      }
    }
    return "";
  };
  return find(tree.children);
}

/* ---------- link / code / table rewriting ---------- */

let highlighterPromise: Promise<Highlighter> | undefined;
const LANGS = ["bash", "json", "powershell", "yaml"];
const LANG_ALIASES = new Set(["sh", "shell", "zsh", "yml", "ps1"]);
function getHighlighter() {
  highlighterPromise ??= createHighlighter({ themes: ["github-light", "github-dark-default"], langs: LANGS });
  return highlighterPromise;
}

/** Map a repo-relative href (relative to `baseDir`, itself relative to the repo root) to a site or repo URL. */
export function rewriteHref(href: string, baseDir: string, locale: Locale): string {
  if (!href || href.startsWith("#") || /^[a-z][a-z0-9+.-]*:/i.test(href) || href.startsWith("//")) return href;
  const hashAt = href.search(/[?#]/);
  const rawPath = hashAt === -1 ? href : href.slice(0, hashAt);
  const tail = hashAt === -1 ? "" : href.slice(hashAt);
  const repoPath = path.posix.normalize(path.posix.join(baseDir, rawPath));
  if (repoPath.startsWith("..")) return href;
  const doc = /^docs\/(\d\d-[^/]+)\.md$/.exec(repoPath);
  if (doc) return getPathname({ locale, href: `/docs/${doc[1]}` }) + tail;
  if (repoPath === "README.md") return getPathname({ locale, href: "/" }) + tail;
  if (repoPath === "CHANGELOG.md") return getPathname({ locale, href: "/changelog" }) + tail;
  return `${repoBlob}/${repoPath}${tail}`;
}

function rewriteImage(src: string, baseDir: string): string {
  if (/^([a-z][a-z0-9+.-]*:|\/\/)/i.test(src)) return src;
  return `${repoRaw}/${path.posix.normalize(path.posix.join(baseDir, src))}`;
}

function rehypeRepo(opts: { baseDir: string; locale: Locale; toc: TocItem[] }) {
  return async (tree: HastRoot) => {
    const hl = await getHighlighter();
    const loaded = new Set(hl.getLoadedLanguages());
    const walk = (parent: HastRoot | Element) => {
      for (let i = 0; i < parent.children.length; i++) {
        const node = parent.children[i] as ElementContent;
        if (node.type !== "element") continue;
        if ((node.tagName === "h2" || node.tagName === "h3") && typeof node.properties.id === "string") {
          opts.toc.push({ id: node.properties.id, text: hastText(node), depth: node.tagName === "h2" ? 2 : 3 });
        }
        if (node.tagName === "a" && typeof node.properties.href === "string") {
          const href = rewriteHref(node.properties.href, opts.baseDir, opts.locale);
          node.properties.href = href;
          if (/^https?:\/\//.test(href)) node.properties.rel = ["noopener"];
        } else if (node.tagName === "img" && typeof node.properties.src === "string") {
          node.properties.src = rewriteImage(node.properties.src, opts.baseDir);
          node.properties.loading = "lazy";
        } else if (node.tagName === "table") {
          parent.children[i] = {
            type: "element",
            tagName: "div",
            properties: { className: ["table-wrap"], tabIndex: 0 },
            children: [node],
          };
        } else if (node.tagName === "pre") {
          const code = node.children.find((c): c is Element => c.type === "element" && c.tagName === "code");
          if (code) {
            const cls = (code.properties.className as string[] | undefined) ?? [];
            const raw = cls.find((c) => c.startsWith("language-"))?.slice(9) ?? "text";
            const lang = loaded.has(raw) || LANG_ALIASES.has(raw) ? raw : "text";
            const hast = hl.codeToHast(hastText(code).replace(/\n$/, ""), {
              lang,
              themes: { light: "github-light", dark: "github-dark-default" },
              defaultColor: false,
            });
            const pre = hast.children[0];
            if (pre?.type === "element") {
              pre.properties.tabIndex = 0;
              parent.children[i] = pre;
            }
          }
          continue;
        }
        walk(node);
      }
    };
    walk(tree);
  };
}

async function renderMarkdown(markdown: string, opts: { baseDir: string; locale: Locale; slugs?: boolean }) {
  const toc: TocItem[] = [];
  const processor = unified().use(remarkParse).use(remarkGfm).use(remarkRehype, { allowDangerousHtml: true });
  if (opts.slugs !== false) processor.use(rehypeSlug);
  // Repo markdown is trusted; raw HTML (<details>) passes through untouched.
  processor.use(rehypeRepo, { baseDir: opts.baseDir, locale: opts.locale, toc }).use(rehypeStringify, { allowDangerousHtml: true });
  const html = String(await processor.process(markdown));
  return { html, toc };
}

/* ---------- docs ---------- */

function parseMeta(file: string, markdown: string): DocMeta {
  const tree = unified().use(remarkParse).use(remarkGfm).parse(markdown) as MdastRoot;
  const h1 = tree.children.find((n) => n.type === "heading" && n.depth === 1);
  const slug = file.replace(/\.md$/, "");
  return {
    slug,
    file,
    number: slug.slice(0, 2),
    title: h1 ? nodeText(h1).trim() : slug,
    description: descriptionOverrides[slug] ?? truncate(firstParagraph(tree).replace(/:$/, ".")),
  };
}

let metaCache: Promise<DocMeta[]> | undefined;
/** Docs 00-09, sorted by numeric prefix. */
export function listDocs(): Promise<DocMeta[]> {
  metaCache ??= (async () => {
    const files = (await fs.readdir(docsDir)).filter((f) => /^\d\d-.+\.md$/.test(f)).sort();
    return Promise.all(files.map(async (f) => parseMeta(f, await fs.readFile(path.join(docsDir, f), "utf8"))));
  })();
  return metaCache;
}

export async function getDocSlugs(): Promise<string[]> {
  return (await listDocs()).map((d) => d.slug);
}

export async function getRawDoc(slug: string): Promise<string | null> {
  if (!(await getDocSlugs()).includes(slug)) return null;
  return fs.readFile(path.join(docsDir, `${slug}.md`), "utf8");
}

const docCache = new Map<string, Promise<Doc>>();
export async function getDoc(slug: string, locale: Locale): Promise<Doc | null> {
  const markdown = await getRawDoc(slug);
  if (markdown === null) return null;
  const key = `${locale}:${slug}`;
  let p = docCache.get(key);
  if (!p) {
    p = (async () => {
      const { html, toc } = await renderMarkdown(markdown, { baseDir: "docs", locale });
      return { ...parseMeta(`${slug}.md`, markdown), markdown, html, toc };
    })();
    docCache.set(key, p);
  }
  return p;
}

export async function getAdjacentDocs(slug: string): Promise<{ prev: DocMeta | null; next: DocMeta | null }> {
  const all = await listDocs();
  const i = all.findIndex((d) => d.slug === slug);
  return { prev: all[i - 1] ?? null, next: all[i + 1] ?? null };
}

export const editUrl = (slug: string) => `${site.repo}/edit/main/docs/${slug}.md`;

/* ---------- breadcrumbs (reusable for BreadcrumbList JSON-LD) ---------- */

export type BreadcrumbItem = { name: string; href: string };

/** `href` is a locale-less path; localize it with getPathname. */
export function docsBreadcrumbs(labels: { home: string; docs: string }, doc?: { slug: string; title: string }): BreadcrumbItem[] {
  const items: BreadcrumbItem[] = [
    { name: labels.home, href: "/" },
    { name: labels.docs, href: "/docs" },
  ];
  if (doc) items.push({ name: doc.title, href: `/docs/${doc.slug}` });
  return items;
}

/* ---------- README / changelog ---------- */

export function getReadme(): Promise<string> {
  return fs.readFile(path.join(repoRoot, "README.md"), "utf8");
}

/** One-line summary: README line 9 (blockquote lead), markdown stripped. */
export async function getReadmeSummary(): Promise<string> {
  const line = (await getReadme()).split("\n")[8] ?? "";
  return line.replace(/^>\s*/, "").replace(/\*\*|__|`/g, "").replace(/:\s*$/, ".").trim();
}

export function getChangelogRaw(): Promise<string> {
  return fs.readFile(path.join(repoRoot, "CHANGELOG.md"), "utf8");
}

export type ChangelogEntry = { id: string; version: string; date: string | null; html: string };

export async function getChangelog(locale: Locale): Promise<{ intro: string; entries: ChangelogEntry[] }> {
  const parts = (await getChangelogRaw()).split(/^## /m);
  const head = parts.shift() ?? "";
  const intro = (await renderMarkdown(head.replace(/^# .*\n/, ""), { baseDir: "", locale, slugs: false })).html;
  const entries = await Promise.all(
    parts.map(async (part) => {
      const nl = part.indexOf("\n");
      const title = part.slice(0, nl).trim();
      const m = /^\[?([^\]\s]+)\]?(?:\s*-\s*(\d{4}-\d{2}-\d{2}))?/.exec(title);
      const version = m?.[1] ?? title;
      const { html } = await renderMarkdown(part.slice(nl + 1), { baseDir: "", locale, slugs: false });
      return { id: `v${version.toLowerCase()}`, version, date: m?.[2] ?? null, html };
    }),
  );
  return { intro, entries };
}
