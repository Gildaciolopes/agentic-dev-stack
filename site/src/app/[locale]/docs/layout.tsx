import type { ReactNode } from "react";
import "@/styles/prose.css";

export default function DocsLayout({ children }: { children: ReactNode }) {
  return (
    <main id="main" className="container-site pb-24 pt-10">
      {children}
    </main>
  );
}
