import type { ComponentProps, ReactNode } from "react";
import { cn } from "@/lib/utils";

/** Package version, prefixed so it reads as a version at a glance. Monospace is for hashes and ids only. */
export function Pkg({
  version,
  className,
  size = "md",
  title,
}: {
  version: number;
  className?: string;
  size?: "sm" | "md" | "lg";
  /** Detail kept off the page: the config this package ships with, for example. */
  title?: string;
}) {
  return (
    <span
      title={title}
      className={cn(
        "tabular-nums tracking-tight text-foreground",
        size === "sm" && "text-xs",
        size === "md" && "text-sm font-semibold",
        size === "lg" && "text-2xl font-semibold",
        className
      )}
    >
      v{version}
    </span>
  );
}

export function Mono({ children, className, ...rest }: { children: ReactNode } & ComponentProps<"span">) {
  return (
    <span className={cn("font-mono text-xs text-muted-foreground", className)} {...rest}>
      {children}
    </span>
  );
}
