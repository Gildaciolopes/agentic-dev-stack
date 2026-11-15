import type { AnchorHTMLAttributes, ButtonHTMLAttributes, ReactNode } from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { Link } from "@/i18n/navigation";
import { cn } from "@/lib/utils";

export const buttonVariants = cva(
  "inline-flex min-h-11 items-center justify-center gap-2 whitespace-nowrap rounded-none font-mono font-bold transition-[transform,filter,background-color] duration-150 ease-out active:scale-[0.98] disabled:pointer-events-none disabled:opacity-50 touch-manipulation",
  {
    variants: {
      variant: {
        primary: "bg-[image:var(--grad-primary)] text-black hover:brightness-110",
        secondary: "border-2 border-foreground bg-transparent text-foreground hover:bg-foreground hover:text-background",
        ghost: "bg-transparent text-foreground hover:bg-muted",
      },
      size: {
        sm: "px-4 py-2 text-[length:var(--text-small)]",
        md: "px-6 py-3 text-[length:var(--text-small)]",
        lg: "px-8 py-4 text-[length:var(--text-body)]",
      },
    },
    defaultVariants: { variant: "primary", size: "md" },
  },
);

type Common = VariantProps<typeof buttonVariants> & { className?: string; children?: ReactNode };
type AsButton = Common & { href?: undefined } & Omit<ButtonHTMLAttributes<HTMLButtonElement>, "className" | "children">;
type AsLink = Common & { href: string } & Omit<AnchorHTMLAttributes<HTMLAnchorElement>, "href" | "className" | "children">;
export type ButtonProps = AsButton | AsLink;

export function Button(props: ButtonProps) {
  if (props.href !== undefined) {
    const { href, variant, size, className, children, ...rest } = props;
    const cls = cn(buttonVariants({ variant, size }), className);
    if (href.startsWith("/")) {
      return (
        <Link href={href} className={cls} {...rest}>
          {children}
        </Link>
      );
    }
    return (
      <a href={href} className={cls} {...rest}>
        {children}
      </a>
    );
  }
  const { variant, size, className, children, type = "button", ...rest } = props;
  return (
    <button type={type} className={cn(buttonVariants({ variant, size }), className)} {...rest}>
      {children}
    </button>
  );
}
