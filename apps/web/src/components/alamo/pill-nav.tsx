import { motion, useReducedMotion } from "framer-motion";
import { cn } from "../../lib/cn";

export type PillOption<T extends string> = {
  value: T;
  label: string;
};

export function PillNav<T extends string>({
  options,
  value,
  onChange,
  ariaLabel,
  className,
}: {
  options: PillOption<T>[];
  value: T;
  onChange: (value: T) => void;
  ariaLabel: string;
  className?: string;
}) {
  const reduce = useReducedMotion();

  return (
    <div
      className={cn("inline-flex flex-wrap gap-1 rounded-full border border-border bg-muted/40 p-1", className)}
      role="group"
      aria-label={ariaLabel}
    >
      {options.map((option) => {
        const active = option.value === value;
        return (
          <button
            key={option.value}
            type="button"
            aria-pressed={active}
            className={cn(
              "relative min-h-10 rounded-full px-3.5 text-sm font-medium transition-colors",
              "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
              active ? "text-primary-foreground" : "text-foreground-muted hover:text-foreground",
            )}
            onClick={() => {
              if (!active) onChange(option.value);
            }}
          >
            {active && !reduce ? (
              <motion.span
                layoutId="pill-nav-indicator"
                className="absolute inset-0 rounded-full bg-primary shadow-sm"
                transition={{ type: "spring", stiffness: 420, damping: 32 }}
              />
            ) : null}
            {active && reduce ? <span className="absolute inset-0 rounded-full bg-primary" aria-hidden="true" /> : null}
            <span className="relative z-[1]">{option.label}</span>
          </button>
        );
      })}
    </div>
  );
}
