"use client";

import { useEffect, useMemo, useState } from "react";
import { Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toastSuccess } from "@/hooks/use-toast";
import { PLATFORM_LABEL, PLATFORM_ORDER, guessPlatform } from "@/lib/control-center/format";
import { useAsyncAction, useGroupActions, useOrgApplications } from "@/lib/control-center/hooks";
import type { AppGroup, GroupMember, Platform } from "@/lib/control-center/types";
import { PlatformIcon } from "./platform-mark";
import { BlockSkeleton, ErrorState } from "./states";

export type GroupEditorMode = { kind: "create"; preselect?: string } | { kind: "edit"; group: AppGroup };

export function GroupEditorDialog({
  open,
  onOpenChange,
  org,
  mode,
  /** Every group in the org, used to show which apps are already taken. */
  groups,
  onSaved,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  org: string;
  mode: GroupEditorMode;
  groups: AppGroup[];
  onSaved?: () => void;
}) {
  const { applications, isLoading: appsLoading, error: appsError } = useOrgApplications(open ? org : null);
  const actions = useGroupActions();
  const { pending, error, run, clearError } = useAsyncAction();

  const [name, setName] = useState("");
  const [members, setMembers] = useState<Map<string, Platform>>(new Map());
  const [query, setQuery] = useState("");

  const editingId = mode.kind === "edit" ? mode.group.id : null;
  // What the form is seeded from. The group page builds `mode` inline, so it is a new object on every render and on
  // every poll; seeding on that would throw away the person's unsaved edits at the next refresh.
  const seed = mode.kind === "edit" ? `edit:${mode.group.id}` : `create:${mode.preselect ?? ""}`;

  useEffect(() => {
    if (!open) return;
    clearError();
    setQuery("");
    if (mode.kind === "edit") {
      setName(mode.group.name);
      setMembers(new Map(mode.group.members.map((m) => [m.application, m.platform])));
    } else {
      setName("");
      setMembers(mode.preselect ? new Map([[mode.preselect, guessPlatform(mode.preselect)]]) : new Map());
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, seed]);

  const takenBy = useMemo(() => {
    const m = new Map<string, string>();
    for (const g of groups) {
      if (g.id === editingId) continue;
      for (const member of g.members) m.set(member.application, g.name);
    }
    return m;
  }, [groups, editingId]);

  const sortedApps = useMemo(() => {
    const list = (applications ?? []).map((a) => a.application).sort((a, b) => a.localeCompare(b));
    const q = query.trim().toLowerCase();
    return q ? list.filter((a) => a.toLowerCase().includes(q)) : list;
  }, [applications, query]);

  // Members the organisation no longer lists (deleted or renamed application). They are saved with the group unless
  // the person removes them, so they have to be visible.
  const missing = useMemo(() => {
    if (!applications) return [];
    const known = new Set(applications.map((a) => a.application));
    return [...members.keys()].filter((a) => !known.has(a)).sort((a, b) => a.localeCompare(b));
  }, [applications, members]);

  const nameError = name.trim().length === 0 ? "Give the group a name, usually the product name." : null;
  const duplicate = groups.some((g) => g.id !== editingId && g.name.trim().toLowerCase() === name.trim().toLowerCase());
  const membersError = members.size === 0 ? "Pick at least one application." : null;
  const canSubmit = !nameError && !duplicate && !membersError && !pending;

  const toggle = (app: string, on: boolean) => {
    setMembers((prev) => {
      const next = new Map(prev);
      if (on) next.set(app, prev.get(app) ?? guessPlatform(app));
      else next.delete(app);
      return next;
    });
  };

  const setPlatform = (app: string, platform: Platform) => {
    setMembers((prev) => new Map(prev).set(app, platform));
  };

  const submit = async () => {
    if (!canSubmit) return;
    const body = {
      name: name.trim(),
      members: [...members.entries()].map<GroupMember>(([application, platform]) => ({ application, platform })),
    };
    const ok = await run(async () => {
      if (mode.kind === "edit") await actions.update(org, mode.group.id, body);
      else await actions.create(org, body);
      return true;
    });
    if (ok) {
      toastSuccess(
        mode.kind === "edit" ? "Group updated" : "Group created",
        `${body.name} · ${body.members.length} app(s)`
      );
      onOpenChange(false);
      onSaved?.();
    }
  };

  return (
    <Dialog open={open} onOpenChange={(o) => (o || !pending) && onOpenChange(o)}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{mode.kind === "edit" ? `Edit group · ${mode.group.name}` : "New group"}</DialogTitle>
          <DialogDescription>
            A group is one product across platforms. Each application can belong to one group in {org}.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="cc-group-name">Group name</Label>
            <Input
              id="cc-group-name"
              value={name}
              placeholder="Kharcha"
              autoFocus
              onChange={(e) => setName(e.target.value)}
              aria-invalid={Boolean(duplicate)}
            />
            {duplicate ? (
              <p className="text-xs text-destructive">A group with this name already exists.</p>
            ) : (
              <p className="text-xs text-muted-foreground">{nameError ?? "Shown as the card title on the overview."}</p>
            )}
          </div>

          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <Label>Members</Label>
              <span className="text-xs text-muted-foreground">
                {members.size} selected{membersError ? "" : ""}
              </span>
            </div>
            {(applications?.length ?? 0) > 8 && (
              <div className="relative">
                <Search className="pointer-events-none absolute left-2 top-2.5 h-3.5 w-3.5 text-muted-foreground" />
                <Input
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder="Filter applications"
                  className="h-8 pl-7 text-sm"
                />
              </div>
            )}
            {appsLoading ? (
              <BlockSkeleton className="h-32" />
            ) : appsError ? (
              <ErrorState title="Could not load applications" message={appsError.message} />
            ) : (
              <ul className="max-h-64 divide-y overflow-y-auto rounded-md border">
                {sortedApps.length === 0 && missing.length === 0 && (
                  <li className="px-3 py-3 text-sm text-muted-foreground">No applications match.</li>
                )}
                {missing.map((app) => (
                  <li key={app} className="flex items-center gap-3 px-3 py-2">
                    <Checkbox
                      id={`cc-member-${app}`}
                      checked
                      onCheckedChange={(v) => toggle(app, v === true)}
                      aria-label={`Remove ${app} from the group`}
                    />
                    <label
                      htmlFor={`cc-member-${app}`}
                      className="min-w-0 flex-1 truncate font-mono text-xs"
                      title={app}
                    >
                      {app}
                      <span className="ml-2 font-sans text-[11px] text-amber-700 dark:text-amber-300">
                        not found in {org}: untick to remove it
                      </span>
                    </label>
                  </li>
                ))}
                {sortedApps.map((app) => {
                  const owner = takenBy.get(app);
                  const checked = members.has(app);
                  const id = `cc-member-${app}`;
                  return (
                    <li key={app} className="flex items-center gap-3 px-3 py-2">
                      <Checkbox
                        id={id}
                        checked={checked}
                        disabled={Boolean(owner)}
                        onCheckedChange={(v) => toggle(app, v === true)}
                      />
                      <label
                        htmlFor={id}
                        className={`min-w-0 flex-1 truncate font-mono text-xs ${owner ? "text-muted-foreground" : ""}`}
                        title={app}
                      >
                        {app}
                        {owner && <span className="ml-2 font-sans text-[11px] text-muted-foreground">in {owner}</span>}
                      </label>
                      {checked && (
                        <Select value={members.get(app)} onValueChange={(v) => setPlatform(app, v as Platform)}>
                          <SelectTrigger className="h-7 w-[7.5rem] text-xs" aria-label={`Platform for ${app}`}>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {PLATFORM_ORDER.map((p) => (
                              <SelectItem key={p} value={p} className="text-xs">
                                <span className="inline-flex items-center gap-1.5">
                                  <PlatformIcon platform={p} className="text-muted-foreground" />
                                  {PLATFORM_LABEL[p]}
                                </span>
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      )}
                    </li>
                  );
                })}
              </ul>
            )}
            {membersError && <p className="text-xs text-muted-foreground">{membersError}</p>}
          </div>

          {error && <ErrorState title="Could not save group" message={error} />}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={pending}>
            Cancel
          </Button>
          <Button onClick={submit} disabled={!canSubmit}>
            {pending ? "Saving…" : mode.kind === "edit" ? "Save changes" : "Create group"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
