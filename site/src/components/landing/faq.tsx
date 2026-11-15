import { Fragment, type ReactNode } from "react";
import { getTranslations } from "next-intl/server";
import messages from "../../../messages/en/landing-b.json";
import { SectionHeader } from "@/components/ui/section-header";
import { site } from "@/lib/site";
import { FaqItem } from "./faq.client";

type QA = { question: string; answer: string };

/** Strip the inline markup (`code`, [text](href)) so the answer reads as plain text. */
function plain(s: string) {
  return s.replace(/\[([^\]]+)\]\([^)]+\)/g, "$1").replace(/`([^`]+)`/g, "$1");
}

/** Plain strings for FAQPage JSON-LD. Wording is the README FAQ (README.md:159-193). */
export const faqItems: { question: string; answer: string }[] = (messages.faq.items as QA[]).map((i) => ({
  question: i.question,
  answer: plain(i.answer),
}));

const INLINE = /(`[^`]+`|\[[^\]]+\]\([^)]+\))/g;

function Inline({ text }: { text: string }) {
  return (
    <>
      {text.split(INLINE).map((part, i): ReactNode => {
        if (part.startsWith("`")) {
          return (
            <code key={i} className="bg-muted px-1.5 py-0.5 text-foreground">
              {part.slice(1, -1)}
            </code>
          );
        }
        const link = /^\[([^\]]+)\]\(([^)]+)\)$/.exec(part);
        if (link) {
          const href = link[2].startsWith("http") ? link[2] : `${site.repo}/blob/main/${link[2]}`;
          return (
            <a key={i} href={href} className="text-link underline underline-offset-4">
              {link[1]}
            </a>
          );
        }
        return <Fragment key={i}>{part}</Fragment>;
      })}
    </>
  );
}

/** Blank-free lines; consecutive "- " or "1. " lines become a list, the rest paragraphs. */
function Answer({ text }: { text: string }) {
  const lines = text.split("\n");
  const out: ReactNode[] = [];
  for (let i = 0; i < lines.length; ) {
    const bullet = lines[i].startsWith("- ");
    const numbered = /^\d+\. /.test(lines[i]);
    if (bullet || numbered) {
      const items: string[] = [];
      while (i < lines.length && (bullet ? lines[i].startsWith("- ") : /^\d+\. /.test(lines[i]))) {
        items.push(lines[i].replace(bullet ? /^- / : /^\d+\. /, ""));
        i++;
      }
      const List = bullet ? "ul" : "ol";
      out.push(
        <List key={i} className={bullet ? "list-disc pl-6" : "list-decimal pl-6"}>
          {items.map((it) => (
            <li key={it}>
              <Inline text={it} />
            </li>
          ))}
        </List>,
      );
    } else {
      out.push(
        <p key={i}>
          <Inline text={lines[i]} />
        </p>,
      );
      i++;
    }
  }
  return <>{out}</>;
}

export async function Faq() {
  const t = await getTranslations("landing-b.faq");
  const items = t.raw("items") as QA[];

  return (
    <section id="faq" aria-label={t("label")} className="section">
      <div className="container-site flex flex-col gap-12">
        <SectionHeader index={t("index")} label={t("label")} title={t("title")} />
        <div className="flex max-w-3xl flex-col gap-3">
          {items.map((qa) => (
            <FaqItem key={qa.question} question={qa.question}>
              <Answer text={qa.answer} />
            </FaqItem>
          ))}
        </div>
      </div>
    </section>
  );
}
