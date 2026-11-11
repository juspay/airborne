import { cn } from "@/lib/utils";
import { isDefaultContext, splitReach } from "@/lib/control-center/format";
import type { DimensionContext } from "@/lib/control-center/types";

/** Where a release lands: its dimension context and any native version constraints inside it. */
export function Reach({
  dimensions,
  className,
  compact,
}: {
  dimensions: DimensionContext;
  className?: string;
  compact?: boolean;
}) {
  const { nativeVersions, dimensions: dims } = splitReach(dimensions);
  if (isDefaultContext(dimensions)) {
    return (
      <div className={cn("text-sm", className)}>
        <p className="font-medium">All users of this application</p>
        {!compact && (
          <p className="text-xs text-muted-foreground">
            No dimensions, so every native version the app serves is included.
          </p>
        )}
      </div>
    );
  }
  return (
    <div className={cn("space-y-3 text-sm", className)}>
      {nativeVersions.length > 0 && (
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">App versions</p>
          <dl className="mt-1 space-y-0.5">
            {nativeVersions.map(([k, v]) => (
              <div key={k} className="flex items-baseline gap-2 font-mono text-xs">
                <dt className="text-muted-foreground">{k}</dt>
                <dd className="text-foreground">{v}</dd>
              </div>
            ))}
          </dl>
        </div>
      )}
      {dims.length > 0 && (
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Dimensions</p>
          <dl className="mt-1 space-y-0.5">
            {dims.map(([k, v]) => (
              <div key={k} className="flex items-baseline gap-2 font-mono text-xs">
                <dt className="text-muted-foreground">{k}</dt>
                <dd className="text-foreground">{v}</dd>
              </div>
            ))}
          </dl>
        </div>
      )}
      {nativeVersions.length === 0 && !compact && (
        <p className="text-xs text-muted-foreground">
          No native version constraint: every version matching these dimensions.
        </p>
      )}
    </div>
  );
}
