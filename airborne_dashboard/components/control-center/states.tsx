import type { ComponentType, ReactNode } from "react";
import { AlertTriangle, Lock } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export function Panel({ className, children }: { className?: string; children: ReactNode }) {
  return <section className={cn("rounded-lg border bg-card text-card-foreground", className)}>{children}</section>;
}

export function PanelTitle({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <h3 className={cn("text-[11px] font-semibold uppercase tracking-wider text-muted-foreground", className)}>
      {children}
    </h3>
  );
}

export function OverviewSkeleton() {
  return (
    <div className="space-y-6" aria-busy aria-label="Loading">
      <div className="flex gap-3">
        <Skeleton className="h-7 w-32" />
        <Skeleton className="h-7 w-28" />
        <Skeleton className="h-7 w-28" />
      </div>
      {[0, 1].map((i) => (
        <div key={i} className="space-y-3">
          <Skeleton className="h-5 w-40" />
          <div className="grid gap-3 lg:grid-cols-2">
            <Skeleton className="h-36 w-full" />
            <Skeleton className="h-36 w-full" />
          </div>
        </div>
      ))}
    </div>
  );
}

export function BlockSkeleton({ className }: { className?: string }) {
  return <Skeleton className={cn("h-24 w-full", className)} aria-busy />;
}

export function ErrorState({
  title,
  message,
  onRetry,
  className,
}: {
  title: string;
  message?: string;
  onRetry?: () => void;
  className?: string;
}) {
  return (
    <div
      role="alert"
      className={cn(
        "flex flex-col gap-2 rounded-lg border border-red-500/30 bg-red-500/5 p-4 text-sm sm:flex-row sm:items-center",
        className
      )}
    >
      <AlertTriangle className="h-4 w-4 shrink-0 text-red-700 dark:text-red-300" aria-hidden />
      <div className="flex-1">
        <p className="font-medium text-red-800 dark:text-red-200">{title}</p>
        {message && <p className="mt-0.5 break-words text-muted-foreground">{message}</p>}
      </div>
      {onRetry && (
        <Button variant="outline" size="sm" onClick={onRetry}>
          Retry
        </Button>
      )}
    </div>
  );
}

export function EmptyState({
  icon: Icon,
  title,
  message,
  action,
  className,
}: {
  icon?: ComponentType<{ className?: string }>;
  title: string;
  message?: ReactNode;
  action?: ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("rounded-lg border border-dashed p-6 text-center", className)}>
      {Icon && <Icon className="mx-auto mb-2 h-5 w-5 text-muted-foreground" aria-hidden />}
      <p className="text-sm font-medium">{title}</p>
      {message && <div className="mx-auto mt-1 max-w-md text-sm text-muted-foreground">{message}</div>}
      {action && <div className="mt-3 flex justify-center">{action}</div>}
    </div>
  );
}

export function PermissionDenied({ what, className }: { what: string; className?: string }) {
  return (
    <div className={cn("flex items-start gap-3 rounded-lg border p-4 text-sm", className)} role="alert">
      <Lock className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" aria-hidden />
      <div>
        <p className="font-medium">You do not have permission to {what}.</p>
        <p className="text-muted-foreground">Ask an organisation admin to grant access, then reload.</p>
      </div>
    </div>
  );
}
