import { Link } from "@/i18n/navigation";
import type { DocMeta } from "@/lib/docs";

function NavList({ docs, current, label }: { docs: DocMeta[]; current?: string; label: string }) {
  return (
    <nav aria-label={label}>
      <ul className="flex flex-col">
        {docs.map((d) => {
          const active = d.slug === current;
          return (
            <li key={d.slug}>
              <Link
                href={`/docs/${d.slug}`}
                aria-current={active ? "page" : undefined}
                className={`flex gap-3 border-l-2 px-3 py-1.5 text-small leading-snug hover:text-foreground ${
                  active ? "border-link bg-band font-bold text-foreground" : "border-border text-muted-foreground"
                }`}
              >
                <span aria-hidden="true" className="text-subtle-foreground">
                  {d.number}
                </span>
                <span>{d.title.replace(/:.*$/, "")}</span>
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}

/** Desktop: sticky list. Mobile: collapsed <details> disclosure. */
export function DocsSidebar({ docs, current, label, menuLabel }: { docs: DocMeta[]; current?: string; label: string; menuLabel: string }) {
  return (
    <>
      <details className="border border-border bg-card lg:hidden">
        <summary className="cursor-pointer px-4 py-3 font-bold">{menuLabel}</summary>
        <div className="border-t border-border py-2">
          <NavList docs={docs} current={current} label={label} />
        </div>
      </details>
      <aside className="hidden lg:block">
        <div className="sticky top-[calc(var(--nav-h)+24px)] max-h-[calc(100dvh-var(--nav-h)-48px)] overflow-y-auto">
          <NavList docs={docs} current={current} label={label} />
        </div>
      </aside>
    </>
  );
}
