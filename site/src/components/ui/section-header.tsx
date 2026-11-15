import { RevealHeading } from "@/components/ui/reveal-heading";
import { cn } from "@/lib/utils";

type Props = {
  index: string;
  label: string;
  title: string;
  intro?: string;
  titleAs?: "h1" | "h2";
  className?: string;
};

export function SectionHeader({ index, label, title, intro, titleAs = "h2", className }: Props) {
  return (
    <header className={cn("flex max-w-3xl flex-col gap-6", className)}>
      <p className="section-label">
        <span className="text-foreground">{index}</span> {label}
      </p>
      <RevealHeading as={titleAs} text={title} className={titleAs === "h1" ? "text-display" : undefined} />
      {intro ? <p className="text-muted-foreground">{intro}</p> : null}
    </header>
  );
}
