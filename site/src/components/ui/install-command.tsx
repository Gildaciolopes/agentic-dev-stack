import { CopyButton } from "@/components/ui/copy-button";
import { cn } from "@/lib/utils";

type Props = {
  command: string;
  copyLabel: string;
  copiedLabel: string;
  prompt?: string;
  className?: string;
};

export function InstallCommand({ command, copyLabel, copiedLabel, prompt = "$", className }: Props) {
  return (
    <div className={cn("flex flex-wrap items-center justify-between gap-3 rounded-none border border-border bg-code py-2 pl-5 pr-2 text-code-foreground", className)}>
      <code className="min-w-0 break-all text-[length:var(--text-small)]">
        <span aria-hidden className="mr-3 text-cyan">{prompt}</span>
        {command}
      </code>
      <CopyButton text={command} label={copyLabel} doneLabel={copiedLabel} />
    </div>
  );
}
