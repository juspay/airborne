"use client";

import { useEffect, useState, type ReactNode } from "react";
import { Command, CommandEmpty, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import type { AppChoice } from "@/lib/control-center/scope";
import { QUIET_ROW } from "./quiet-focus";

/**
 * Create always lives in the top bar. With no application in scope it cannot know what to create in, so it asks
 * first: "Which app?", then offers what can be created there. Nothing is created from a guess.
 */
export function CreateChooser({
  open,
  onOpenChange,
  choices,
  showOrg,
  picked,
  onPick,
  onBack,
  children,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  choices: AppChoice[];
  showOrg: boolean;
  picked: { org: string; app: string } | null;
  onPick: (c: { org: string; app: string }) => void;
  onBack: () => void;
  /** What can be created in the picked application. */
  children: ReactNode;
}) {
  const [query, setQuery] = useState("");
  useEffect(() => {
    if (!open) setQuery("");
  }, [open]);
  const shown = choices.filter((c) => {
    const q = query.trim().toLowerCase();
    return q === "" || c.app.toLowerCase().includes(q) || c.org.toLowerCase().includes(q);
  });
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="gap-0 p-0 sm:max-w-md" data-testid="create-chooser">
        {picked ? (
          <div className="space-y-3 p-6">
            <DialogHeader>
              <DialogTitle>
                Create in <span className="font-mono text-base">{picked.app}</span>
              </DialogTitle>
              <DialogDescription>{picked.org}</DialogDescription>
            </DialogHeader>
            <div className="space-y-2">{children}</div>
            <Button variant="ghost" size="sm" className="text-muted-foreground" onClick={onBack}>
              Choose another app
            </Button>
          </div>
        ) : (
          <>
            <DialogHeader className="p-6 pb-3">
              <DialogTitle>Which app?</DialogTitle>
              <DialogDescription>Choose where to create something. Nothing is created yet.</DialogDescription>
            </DialogHeader>
            <Command shouldFilter={false} label="Choose an application" className="rounded-t-none border-t">
              <CommandInput value={query} onValueChange={setQuery} placeholder="Find an application" />
              <CommandList className="max-h-[min(20rem,50vh)] p-1">
                <CommandEmpty>
                  {choices.length === 0
                    ? "There is no application you can create in, in this scope."
                    : `Nothing named “${query.trim()}”.`}
                </CommandEmpty>
                {shown.map((c) => (
                  <CommandItem
                    key={`${c.org}/${c.app}`}
                    value={`${c.org}/${c.app}`}
                    onSelect={() => onPick({ org: c.org, app: c.app })}
                    className={`min-h-9 gap-2 py-2 ${QUIET_ROW}`}
                  >
                    <span className="min-w-0 flex-1 truncate font-mono text-xs">{c.app}</span>
                    <span className="shrink-0 text-[11px] text-muted-foreground">
                      {[showOrg ? c.org : null, c.group ?? null].filter(Boolean).join(" · ")}
                    </span>
                  </CommandItem>
                ))}
              </CommandList>
            </Command>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
