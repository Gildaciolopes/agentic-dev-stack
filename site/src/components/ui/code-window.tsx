import { CopyButton } from "@/components/ui/copy-button";
import { cn } from "@/lib/utils";

type Props = {
  filename: string;
  code: string;
  copyLabel?: string;
  copiedLabel?: string;
  className?: string;
};

export function CodeWindow({ filename, code, copyLabel, copiedLabel, className }: Props) {
  return (
    <figure className={cn("overflow-hidden rounded-none border border-border bg-code text-code-foreground", className)}>
      <figcaption className="flex items-center gap-3 border-b border-white/10 px-4 py-2">
        <span aria-hidden className="flex gap-1.5">
          <span className="size-2.5 bg-coral" />
          <span className="size-2.5 bg-peach" />
          <span className="size-2.5 bg-mint" />
        </span>
        <span className="flex-1 truncate text-[length:var(--text-label)] tracking-wide text-code-muted">{filename}</span>
        {copyLabel && copiedLabel ? <CopyButton text={code} label={copyLabel} doneLabel={copiedLabel} /> : null}
      </figcaption>
      <pre className="overflow-x-auto p-5 text-[length:var(--text-small)] leading-relaxed" tabIndex={0}>
        <code>{code}</code>
      </pre>
    </figure>
  );
}
