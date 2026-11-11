import { cn } from "@/lib/utils";
import { MAX_RAMP_TARGET } from "@/lib/control-center/format";
import type { Tone } from "./status-badge";
import { TONE_FILL } from "./status-badge";

/** A rollout in progress is neutral grey; colour is kept for states that mean something else. */
const FILL: Record<Tone, string> = { ...TONE_FILL, rolling: "bg-muted-foreground/60" };

interface Props {
  /** Rollout target in percent. Not adoption. */
  target: number;
  tone?: Tone;
  className?: string;
  /** Show the 50% ramp cap tick. */
  showCap?: boolean;
  size?: "sm" | "md";
  label?: string;
}

/**
 * A thin track showing where the rollout target sits between 0 and 100%.
 * The label always says "target": the server does not know how many devices have adopted it.
 */
export function RolloutTargetBar({ target, tone = "rolling", className, showCap = true, size = "sm", label }: Props) {
  const pct = Math.max(0, Math.min(100, target));
  return (
    <div className={cn("flex min-w-0 flex-col gap-1", className)}>
      <div className="flex items-baseline justify-between gap-3">
        {/* The numeral is a setting, not a verdict: it stays the foreground colour whatever the state. */}
        <span className={cn("font-semibold tabular-nums", size === "sm" ? "text-sm" : "text-xl")}>{pct}%</span>
        <span className="truncate text-[11px] uppercase tracking-wide text-muted-foreground">{label ?? "target"}</span>
      </div>
      <div
        role="img"
        aria-label={`Rollout target ${pct} percent`}
        className={cn("relative w-full overflow-hidden rounded-full bg-muted", size === "sm" ? "h-2" : "h-2.5")}
      >
        <div className={cn("h-full rounded-full", FILL[tone])} style={{ width: `${pct}%` }} />
        {showCap && pct < 100 && (
          <div
            className="absolute inset-y-0 w-0.5 bg-foreground/40"
            style={{ left: `${MAX_RAMP_TARGET}%` }}
            title={`Ramp cap ${MAX_RAMP_TARGET}%. Conclude to reach 100%.`}
          />
        )}
      </div>
    </div>
  );
}
