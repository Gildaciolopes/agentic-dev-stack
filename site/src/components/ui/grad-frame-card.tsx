import type { ComponentProps } from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

const frame = cva("rounded-none p-3", {
  variants: {
    tone: {
      warm: "bg-[linear-gradient(160deg,var(--spectrum-red),var(--spectrum-pink))]",
      cool: "bg-[linear-gradient(160deg,var(--spectrum-blue),var(--spectrum-pink))]",
      mint: "bg-[linear-gradient(160deg,var(--spectrum-mintlight),var(--spectrum-peach))]",
    },
  },
  defaultVariants: { tone: "warm" },
});

type Props = ComponentProps<"div"> & VariantProps<typeof frame>;

/** White inner card with black text in both themes, wrapped by a thick gradient frame. */
export function GradFrameCard({ tone, className, children, ...props }: Props) {
  return (
    <div className={cn(frame({ tone }), className)} {...props}>
      <div className="h-full rounded-none bg-white p-6 text-black">{children}</div>
    </div>
  );
}
