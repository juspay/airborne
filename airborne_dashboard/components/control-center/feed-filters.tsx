"use client";

import { useEffect, useRef, useState, type ComponentType } from "react";
import {
  Check,
  CheckCircle2,
  Cloud,
  CircleDot,
  ShieldCheck,
  SlidersHorizontal,
  Undo2,
  UserCheck,
  X,
  XCircle,
} from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/lib/utils";
import { useDebouncedValue } from "@/hooks/useDebouncedValue";
import {
  FEED_PLATFORMS,
  filtersActive,
  SINCE_LABEL,
  STATUS_CHIPS,
  toggleChip,
  type FeedFilters,
  type SinceRange,
} from "@/lib/control-center/deployments";
import { platformLabel } from "@/lib/control-center/format";
import { PlatformIcon } from "./platform-mark";

const CHIP_ICON: Record<string, ComponentType<{ className?: string }>> = {
  rollouts: CircleDot,
  concluded: CheckCircle2,
  rolled_back: Undo2,
  discarded: XCircle,
  approvals: UserCheck,
  cache: Cloud,
  policy: ShieldCheck,
};

const FOCUS = "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring";

/**
 * A filter that is off is plain: outlined, grey. One that is on is the same chip with a darker fill and a check. Every
 * chip, action or platform, looks the same when it is on: the tone of an action is the overview's business, not the
 * filter's, and one "on" look reads as one kind of control.
 */
function Toggle({
  pressed,
  onClick,
  children,
  icon: Icon,
}: {
  pressed: boolean;
  onClick: () => void;
  children: React.ReactNode;
  icon?: ComponentType<{ className?: string }>;
}) {
  return (
    <button
      type="button"
      aria-pressed={pressed}
      onClick={onClick}
      className={cn(
        "inline-flex h-7 items-center gap-1.5 rounded-md border px-2.5 text-xs font-medium",
        FOCUS,
        pressed
          ? "border-foreground/60 bg-foreground/10 text-foreground"
          : "border-border bg-transparent text-muted-foreground hover:border-foreground/30 hover:text-foreground"
      )}
    >
      {pressed ? <Check className="h-3 w-3" aria-hidden /> : Icon ? <Icon className="h-3 w-3 opacity-60" /> : null}
      {children}
    </button>
  );
}

/**
 * One row: action chips (the only action filter), platform, and "More" for the actor and the time range. The filters
 * live in the URL, so a filtered feed can be linked to; the actor box waits for a pause in typing before it asks the
 * server.
 */
export function FeedFilterBar({ filters, onChange }: { filters: FeedFilters; onChange: (next: FeedFilters) => void }) {
  const [actor, setActor] = useState(filters.actor);
  const debounced = useDebouncedValue(actor, 400);
  // The last value this box sent to the URL. A URL that merely echoes it must not overwrite what was typed since.
  const sent = useRef(filters.actor);
  useEffect(() => {
    // The URL changed from outside (Clear, back button): the box follows it.
    if (filters.actor !== sent.current) {
      sent.current = filters.actor;
      setActor(filters.actor);
    }
  }, [filters.actor]);
  useEffect(() => {
    if (debounced.trim() !== sent.current.trim()) {
      sent.current = debounced;
      onChange({ ...filters, actor: debounced });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [debounced]);

  const moreCount = (filters.actor.trim() !== "" || actor.trim() !== "" ? 1 : 0) + (filters.since !== "any" ? 1 : 0);

  return (
    <div
      className="flex flex-wrap items-center gap-x-2 gap-y-2"
      role="search"
      aria-label="Filter deployment events"
      data-testid="feed-filters"
    >
      <div className="flex flex-wrap items-center gap-1.5" role="group" aria-label="Action">
        {STATUS_CHIPS.map((c) => (
          <Toggle
            key={c.key}
            pressed={c.actions.every((a) => filters.actions.includes(a))}
            icon={CHIP_ICON[c.key]}
            onClick={() => onChange({ ...filters, actions: toggleChip(filters.actions, c.actions) })}
          >
            {c.label}
          </Toggle>
        ))}
      </div>

      <span className="hidden h-5 w-px bg-border sm:block" aria-hidden />

      <div className="flex items-center gap-1.5" role="group" aria-label="Platform">
        {FEED_PLATFORMS.map((p) => (
          <Toggle
            key={p}
            pressed={filters.platform === p}
            onClick={() => onChange({ ...filters, platform: filters.platform === p ? undefined : p })}
          >
            <PlatformIcon platform={p} />
            {platformLabel(p)}
          </Toggle>
        ))}
      </div>

      <Popover>
        <PopoverTrigger asChild>
          <Button variant="outline" size="sm" className="h-7 gap-1.5 text-xs font-medium text-muted-foreground">
            <SlidersHorizontal className="h-3.5 w-3.5" aria-hidden />
            More
            {moreCount > 0 && (
              <span className="rounded bg-foreground/10 px-1.5 font-mono text-[11px] text-foreground">{moreCount}</span>
            )}
          </Button>
        </PopoverTrigger>
        <PopoverContent align="start" className="w-72 space-y-3 p-3">
          <label className="block space-y-1 text-xs font-medium">
            Actor
            <Input
              value={actor}
              onChange={(e) => setActor(e.target.value)}
              placeholder="Exact email"
              aria-label="Actor"
              className="h-8 text-xs font-normal"
            />
          </label>
          <label className="block space-y-1 text-xs font-medium">
            Time
            <select
              value={filters.since}
              onChange={(e) => onChange({ ...filters, since: e.target.value as SinceRange })}
              aria-label="Time range"
              className={cn("h-8 w-full rounded-md border border-input bg-background px-2 text-xs font-normal", FOCUS)}
            >
              {(Object.keys(SINCE_LABEL) as SinceRange[]).map((k) => (
                <option key={k} value={k}>
                  {SINCE_LABEL[k]}
                </option>
              ))}
            </select>
          </label>
        </PopoverContent>
      </Popover>

      {(filtersActive(filters) || actor.trim() !== "") && (
        <Button
          variant="ghost"
          size="sm"
          className="h-7 gap-1 text-xs text-muted-foreground"
          onClick={() => {
            setActor("");
            sent.current = "";
            onChange({ actions: [], platform: undefined, actor: "", since: "any" });
          }}
        >
          <X className="h-3.5 w-3.5" aria-hidden /> Clear
        </Button>
      )}
    </div>
  );
}
