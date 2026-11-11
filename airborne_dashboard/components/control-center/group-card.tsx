"use client";

import Link from "next/link";
import { ChevronRight, MoreHorizontal, Pencil, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";
import { sortMembersByPlatform, summariseAttention } from "@/lib/control-center/format";
import type { OverviewGroup } from "@/lib/control-center/types";
import { AppStatusRow, RowHeader } from "./app-status-row";
import { groupPath } from "./paths";
import { AttentionChips } from "./attention-strip";
import { GroupCacheNotice } from "./cache-notice";

export function GroupCard({
  org,
  group,
  canManage,
  onEdit,
  onDelete,
  className,
}: {
  org: string;
  group: OverviewGroup;
  canManage: boolean;
  onEdit?: (group: OverviewGroup) => void;
  onDelete?: (group: OverviewGroup) => void;
  className?: string;
}) {
  const members = sortMembersByPlatform(group.members);
  const attention = summariseAttention(members);
  const href = groupPath(org, group.id);

  return (
    <section className={cn("rounded-lg border bg-card text-card-foreground", className)} aria-label={group.name}>
      <header className="flex items-center gap-3 border-b px-4 py-2.5">
        <Link href={href} className="group/title flex min-w-0 flex-1 items-center gap-2">
          <h3 className="truncate text-sm font-semibold group-hover/title:underline">{group.name}</h3>
          <span className="hidden shrink-0 text-xs text-muted-foreground sm:inline">
            {members.length} platform{members.length === 1 ? "" : "s"}
          </span>
          <ChevronRight className="h-3.5 w-3.5 shrink-0 text-muted-foreground opacity-60 group-hover/title:opacity-100" />
        </Link>
        <AttentionChips summary={attention} compact />
        {canManage && (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon" className="h-7 w-7" aria-label={`Manage group ${group.name}`}>
                <MoreHorizontal className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={() => onEdit?.(group)}>
                <Pencil className="mr-2 h-4 w-4" /> Edit group
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => onDelete?.(group)} className="text-red-600 dark:text-red-400">
                <Trash2 className="mr-2 h-4 w-4" /> Delete group
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        )}
      </header>
      <GroupCacheNotice org={org} apps={members} className="border-b px-4 py-2" />
      <RowHeader />
      <div className="divide-y">
        {members.map((m) => (
          <AppStatusRow key={m.application} org={org} app={m} showCacheNotice={false} />
        ))}
      </div>
    </section>
  );
}
