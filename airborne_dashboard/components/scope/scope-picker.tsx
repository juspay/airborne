"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter, usePathname, useSearchParams } from "next/navigation";
import { Check, ChevronDown, ChevronRight, ChevronsUpDown, Plus } from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Command, CommandEmpty, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { cn } from "@/lib/utils";
import { useAppContext } from "@/providers/app-context";
import { useScopeGroups } from "@/lib/control-center/hooks";
import { filtersFromSearch, filtersToParams } from "@/lib/control-center/deployments";
import {
  buildScopeTree,
  describeScope,
  pickerRows,
  type PickerRow,
  resolveGroup,
  rowIsCurrent,
  sameScope,
  scopeTarget,
  type Scope,
} from "@/lib/control-center/scope";
import { useScope } from "./use-scope";
import { QUIET_ROW } from "./quiet-focus";

const KIND_LABEL: Record<PickerRow["kind"], string> = {
  all: "",
  org: "Organisation",
  group: "Group",
  app: "Application",
};

/**
 * One control for where you are: All, an organisation, a group, an application. The button always shows the
 * current scope in full, so a page never leaves you guessing; the list says what each row is.
 */
export function ScopePicker({ onCreateOrg, createOrgLabel }: { onCreateOrg?: () => void; createOrgLabel?: string }) {
  const router = useRouter();
  const pathname = usePathname() ?? "";
  const search = useSearchParams();
  const scope = useScope();
  const { organisations } = useAppContext();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");

  const orgNames = useMemo(() => organisations.map((o) => o.name), [organisations]);
  const needGroups = open || Boolean(scope.group) || Boolean(scope.app);
  // Closed, the picker only needs the groups of the organisation in scope (to name the group or find an app's group).
  // Open, it lists every organisation, so it asks for all of them.
  const { groupsByOrg } = useScopeGroups(open ? orgNames : scope.org ? [scope.org] : [], needGroups);
  const tree = useMemo(() => buildScopeTree(organisations, groupsByOrg), [organisations, groupsByOrg]);
  // The organisation in scope starts open; others open on request (chevron, or ArrowRight on the row).
  const [opened, setOpened] = useState<Set<string>>(() => new Set());
  const expanded = useMemo(() => new Set([...opened, ...(scope.org ? [scope.org] : [])]), [opened, scope.org]);
  const [closed, setClosed] = useState<Set<string>>(() => new Set());
  const visible = useMemo(() => new Set([...expanded].filter((o) => !closed.has(o))), [expanded, closed]);
  const toggleOrg = (name: string, open: boolean) => {
    setOpened((p) => new Set(open ? [...p, name] : [...p].filter((x) => x !== name)));
    setClosed((p) => new Set(open ? [...p].filter((x) => x !== name) : [...p, name]));
  };
  const rows = useMemo(() => pickerRows(tree, query, visible), [tree, query, visible]);
  // The cursor starts on the best match, so type-then-Enter picks what was typed rather than its parent organisation.
  const [cursor, setCursor] = useState("");
  const best = rows.find((r) => r.match)?.key ?? rows.find((r) => rowIsCurrent(r, scope))?.key ?? rows[0]?.key ?? "";
  useEffect(() => {
    // cmdk moves its own cursor to the first row whenever the list changes; this runs after it.
    const t = setTimeout(() => setCursor(best), 0);
    return () => clearTimeout(t);
  }, [best, open]);
  const group = resolveGroup(scope, tree);
  const label = describeScope(scope, group?.name);

  const choose = (next: Scope) => {
    setOpen(false);
    setQuery("");
    if (sameScope(next, scope)) return;
    router.push(scopeTarget(pathname, next, filtersToParams(filtersFromSearch(search))));
  };

  const segments = [
    ...(scope.org ? [{ text: scope.org, kind: "Organisation" }] : []),
    ...(scope.group || (scope.app && group) ? [{ text: group?.name ?? "", kind: "Group" }] : []),
    ...(scope.app ? [{ text: scope.app, kind: "Application" }] : []),
  ].filter((s) => s.text);

  return (
    <Popover
      open={open}
      onOpenChange={(o) => {
        setOpen(o);
        if (!o) setQuery("");
      }}
    >
      <PopoverTrigger asChild>
        <button
          type="button"
          aria-label={`Scope: ${label}. Change scope`}
          data-testid="scope-picker"
          className="group flex h-9 min-w-0 max-w-full items-center gap-2 rounded-md border border-border bg-background/60 px-2.5 text-sm hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          <span className="shrink-0 text-[11px] font-medium uppercase tracking-wider text-muted-foreground">Scope</span>
          <span className="flex min-w-0 items-center gap-1.5" aria-hidden>
            {segments.length === 0 ? (
              <span className="font-medium">All organisations</span>
            ) : (
              segments.map((s, i) => {
                const deepest = i === segments.length - 1;
                return (
                  // On a phone only the deepest level fits: it carries its own kind so it is not mistaken for another.
                  <span
                    key={s.kind}
                    className={cn("min-w-0 items-center gap-1.5", deepest ? "flex" : "hidden sm:flex")}
                  >
                    {i > 0 && <span className="hidden text-muted-foreground/60 sm:inline">/</span>}
                    {deepest && <span className="shrink-0 text-xs text-muted-foreground sm:hidden">{s.kind}</span>}
                    <span
                      className={cn(
                        "truncate",
                        deepest ? "font-medium" : "text-muted-foreground",
                        s.kind === "Application" && "font-mono text-xs"
                      )}
                    >
                      {s.text}
                    </span>
                  </span>
                );
              })
            )}
          </span>
          <ChevronsUpDown className="h-3.5 w-3.5 shrink-0 text-muted-foreground" aria-hidden />
        </button>
      </PopoverTrigger>
      <PopoverContent align="start" collisionPadding={12} className="w-[min(28rem,calc(100vw-1.5rem))] p-0">
        <Command
          shouldFilter={false}
          loop
          label="Choose scope"
          value={cursor}
          onValueChange={setCursor}
          onKeyDown={(e) => {
            // Right opens the organisation under the cursor and Left closes it; nothing else changes.
            const row = rows.find((r) => r.key === cursor);
            if (!row || row.kind !== "org" || query.trim() !== "") return;
            const name = row.scope.org as string;
            if (e.key === "ArrowRight" && !row.expanded) {
              e.preventDefault();
              toggleOrg(name, true);
            } else if (e.key === "ArrowLeft" && row.expanded) {
              e.preventDefault();
              toggleOrg(name, false);
            }
          }}
        >
          <CommandInput
            value={query}
            onValueChange={setQuery}
            placeholder="Find an organisation, group or application"
          />
          <CommandList className="max-h-[min(24rem,60vh)] p-1">
            <CommandEmpty>Nothing named “{query.trim()}” in your organisations.</CommandEmpty>
            {rows.map((r) => {
              const current = rowIsCurrent(r, scope);
              return (
                <CommandItem
                  key={r.key}
                  value={r.key}
                  onSelect={() => choose(r.scope)}
                  aria-current={current ? "true" : undefined}
                  aria-expanded={r.kind === "org" && query.trim() === "" ? r.expanded : undefined}
                  className={cn(
                    // Two different things, shown differently: the keyboard cursor is a grey fill, the current
                    // scope is a check, a bar and a heavier name. The brand fill is not used for either.
                    "min-h-9 gap-2 py-2",
                    QUIET_ROW,
                    current &&
                      "before:absolute before:inset-y-1.5 before:left-0 before:w-0.5 before:rounded-full before:bg-primary",
                    r.kind === "group" && "pl-5",
                    r.kind === "app" && (r.scope.group ? "pl-9" : "pl-5")
                  )}
                >
                  <Check className={cn("h-3.5 w-3.5 shrink-0", current ? "opacity-100" : "opacity-0")} aria-hidden />
                  <span
                    className={cn(
                      "min-w-0 flex-1 truncate",
                      r.kind === "all" || r.kind === "org" ? "font-medium" : "",
                      current && "font-semibold",
                      r.kind === "app" && "font-mono text-xs"
                    )}
                  >
                    {r.label}
                  </span>
                  {KIND_LABEL[r.kind] && (
                    <span className="shrink-0 text-[11px] text-muted-foreground">
                      {KIND_LABEL[r.kind]}
                      {r.kind === "org" && r.apps !== undefined && ` · ${r.apps} app${r.apps === 1 ? "" : "s"}`}
                    </span>
                  )}
                  {r.kind === "org" && query.trim() === "" && (
                    <button
                      type="button"
                      tabIndex={-1}
                      aria-label={`${r.expanded ? "Hide" : "Show"} what is in ${r.label}`}
                      aria-expanded={r.expanded}
                      onClick={(e) => {
                        e.stopPropagation();
                        toggleOrg(r.scope.org as string, !r.expanded);
                      }}
                      onPointerDown={(e) => e.stopPropagation()}
                      className="-mr-1 shrink-0 rounded p-1 text-muted-foreground hover:bg-foreground/10 hover:text-foreground"
                    >
                      {r.expanded ? <ChevronDown className="h-3.5 w-3.5" /> : <ChevronRight className="h-3.5 w-3.5" />}
                    </button>
                  )}
                  {current && <span className="sr-only">(current scope)</span>}
                </CommandItem>
              );
            })}
          </CommandList>
          {onCreateOrg && (
            <div className="border-t p-1">
              <button
                type="button"
                onClick={() => {
                  setOpen(false);
                  onCreateOrg();
                }}
                className="flex w-full items-center gap-2 rounded-sm px-2 py-2 text-left text-sm text-muted-foreground hover:bg-accent hover:text-accent-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                <Plus className="h-3.5 w-3.5" aria-hidden />
                {createOrgLabel ?? "Create organisation"}
              </button>
            </div>
          )}
        </Command>
      </PopoverContent>
    </Popover>
  );
}
