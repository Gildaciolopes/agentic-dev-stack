import pkg from "../../../package.json";
import { site } from "./site";

type Json = Record<string, unknown>;

/** Serialises JSON-LD with `<` escaped so the payload can never close the script tag. */
export function JsonLd({ data }: { data: Json | Json[] }) {
  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: JSON.stringify(data).replace(/</g, "\\u003c") }}
    />
  );
}

const ctx = "https://schema.org";

export function webSite(): Json {
  return { "@context": ctx, "@type": "WebSite", name: site.name, url: site.url, description: pkg.description };
}

export function softwareApplication(): Json {
  return {
    "@context": ctx,
    "@type": "SoftwareApplication",
    name: site.name,
    description: pkg.description,
    url: site.url,
    applicationCategory: "DeveloperApplication",
    operatingSystem: "macOS, Linux, Windows",
    offers: { "@type": "Offer", price: "0", priceCurrency: "USD" },
    softwareVersion: pkg.version,
    downloadUrl: site.npm,
    license: `${site.repo}/blob/main/LICENSE`,
    author: { "@type": "Person", name: site.author.name, url: site.author.url },
  };
}

export function softwareSourceCode(): Json {
  return {
    "@context": ctx,
    "@type": "SoftwareSourceCode",
    name: site.name,
    description: pkg.description,
    codeRepository: site.repo,
    // Verified against the repo: bin/lib/*.mjs, hooks/*.py, install.sh (plus install.ps1).
    programmingLanguage: ["JavaScript", "Python", "Shell", "PowerShell"],
    license: `${site.repo}/blob/main/LICENSE`,
    author: { "@type": "Person", name: site.author.name, url: site.author.url },
  };
}

export function breadcrumbList(items: { name: string; url: string }[]): Json {
  return {
    "@context": ctx,
    "@type": "BreadcrumbList",
    itemListElement: items.map((item, i) => ({ "@type": "ListItem", position: i + 1, name: item.name, item: item.url })),
  };
}

export function faqPage(items: { question: string; answer: string }[]): Json {
  return {
    "@context": ctx,
    "@type": "FAQPage",
    mainEntity: items.map((q) => ({
      "@type": "Question",
      name: q.question,
      acceptedAnswer: { "@type": "Answer", text: q.answer },
    })),
  };
}
