import type { ReactNode } from "react";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * The scope picker is the only breadcrumb, so pages carry none. A page below an application's own page names its
 * parent once, as a way back: it is a link, not a trail.
 */
export interface BackLink {
  label: string;
  href: string;
}

export function CcPageHeader({
  back,
  title,
  titleAdornment,
  subtitle,
  actions,
  className,
}: {
  back?: BackLink;
  title: ReactNode;
  titleAdornment?: ReactNode;
  subtitle?: ReactNode;
  actions?: ReactNode;
  className?: string;
}) {
  return (
    <header className={cn("flex flex-col gap-3", className)}>
      {back && (
        <Link
          href={back.href}
          className="inline-flex w-fit min-w-0 items-center gap-1 text-xs text-muted-foreground hover:text-foreground hover:underline"
        >
          <ArrowLeft className="h-3 w-3 shrink-0" aria-hidden />
          <span className="truncate">{back.label}</span>
        </Link>
      )}
      <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-3">
            <h1 className="min-w-0 max-w-full break-words text-2xl md:truncate font-semibold tracking-tight font-[family-name:var(--font-space-grotesk)]">
              {title}
            </h1>
            {titleAdornment}
          </div>
          {subtitle && <div className="mt-1 text-sm text-muted-foreground">{subtitle}</div>}
        </div>
        {actions && <div className="flex min-w-0 flex-wrap items-center gap-2 md:justify-end">{actions}</div>}
      </div>
    </header>
  );
}
