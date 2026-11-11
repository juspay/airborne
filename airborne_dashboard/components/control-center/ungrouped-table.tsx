"use client";

import { Button } from "@/components/ui/button";
import { FolderPlus } from "lucide-react";
import { cn } from "@/lib/utils";
import type { AppStatus } from "@/lib/control-center/types";
import { AppStatusRow, RowHeader } from "./app-status-row";
import { GroupCacheNotice } from "./cache-notice";

export function UngroupedSection({
  org,
  apps,
  canManage,
  onAddToGroup,
  className,
}: {
  org: string;
  apps: AppStatus[];
  canManage: boolean;
  onAddToGroup?: (application: string) => void;
  className?: string;
}) {
  if (apps.length === 0) return null;
  return (
    <section
      className={cn("rounded-lg border border-dashed bg-card/40 text-card-foreground", className)}
      aria-label="Ungrouped"
    >
      <header className="flex items-center gap-3 border-b border-dashed px-4 py-2.5">
        <h3 className="text-sm font-semibold text-muted-foreground">Ungrouped</h3>
        <span className="text-xs text-muted-foreground">
          {apps.length} app{apps.length === 1 ? "" : "s"} not yet in a product group
        </span>
      </header>
      <GroupCacheNotice org={org} apps={apps} className="border-b border-dashed px-4 py-2" />
      <RowHeader />
      <div className="divide-y divide-dashed">
        {apps.map((a) => (
          <AppStatusRow
            key={a.application}
            org={org}
            app={a}
            showPlatform={false}
            showCacheNotice={false}
            trailing={
              canManage && onAddToGroup ? (
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-7 gap-1.5 self-start text-xs text-muted-foreground md:absolute md:right-3 md:top-2 md:opacity-0 md:focus-visible:opacity-100 md:group-hover/row:opacity-100"
                  onClick={() => onAddToGroup(a.application)}
                >
                  <FolderPlus className="h-3.5 w-3.5" /> Add to group
                </Button>
              ) : undefined
            }
          />
        ))}
      </div>
    </section>
  );
}
