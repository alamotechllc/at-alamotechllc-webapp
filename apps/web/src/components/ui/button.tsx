import { cva, type VariantProps } from "class-variance-authority";
import type { ButtonHTMLAttributes } from "react";
import { cn } from "../../lib/cn";

const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-md text-sm font-medium transition-colors duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background disabled:pointer-events-none disabled:cursor-not-allowed disabled:opacity-50",
  {
    variants: {
      variant: {
        default:
          "btn-keycap border border-primary/80 bg-primary text-primary-foreground shadow-button hover:bg-primary-hover active:bg-primary-hover",
        outline:
          "btn-keycap border border-border bg-background shadow-[var(--shadow-key)] hover:bg-muted hover:text-foreground active:bg-muted/80",
        accent:
          "btn-keycap border border-primary/80 bg-accent text-accent-foreground shadow-button hover:bg-accent-hover active:bg-accent-hover",
        ghost: "hover:bg-muted hover:text-foreground active:bg-muted/80",
      },
      size: {
        default: "h-10 px-4 py-2",
        sm: "h-9 px-3",
        lg: "h-11 px-8",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  },
);

export function Button({
  className,
  variant,
  size,
  type = "button",
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & VariantProps<typeof buttonVariants>) {
  return <button type={type} className={cn(buttonVariants({ variant, size }), className)} {...props} />;
}
