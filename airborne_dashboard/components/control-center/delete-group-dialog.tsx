"use client";

import { useEffect } from "react";

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { toastSuccess } from "@/hooks/use-toast";
import { useAsyncAction, useGroupActions } from "@/lib/control-center/hooks";
import type { AppGroup } from "@/lib/control-center/types";
import { ErrorState } from "./states";

export function DeleteGroupDialog({
  open,
  onOpenChange,
  org,
  group,
  onDeleted,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  org: string;
  group: AppGroup | null;
  onDeleted?: () => void;
}) {
  const actions = useGroupActions();
  const { pending, error, run, clearError } = useAsyncAction();
  // The page keeps this dialog mounted and only toggles `open`: a refusal from the last attempt is not the answer to
  // the next one.
  useEffect(() => {
    if (open) clearError();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);
  if (!group) return null;

  const confirm = async () => {
    const ok = await run(async () => {
      await actions.remove(org, group.id);
      return true;
    });
    if (ok) {
      toastSuccess("Group deleted", `${group.name}. Its applications are now ungrouped.`);
      onOpenChange(false);
      onDeleted?.();
    }
  };

  return (
    <AlertDialog open={open} onOpenChange={(o) => (o || !pending) && onOpenChange(o)}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Delete group “{group.name}”?</AlertDialogTitle>
          <AlertDialogDescription asChild>
            <div className="space-y-2 text-sm text-muted-foreground">
              <p>
                Only the grouping is removed. No release, rollout or package changes. The{" "}
                {group.members.length === 1 ? "application" : `${group.members.length} applications`} below move to the
                Ungrouped section of {org}.
              </p>
              <ul className="font-mono text-xs">
                {group.members.map((m) => (
                  <li key={m.application}>
                    {m.application} <span className="font-sans text-muted-foreground">· {m.platform}</span>
                  </li>
                ))}
              </ul>
            </div>
          </AlertDialogDescription>
        </AlertDialogHeader>
        {error && <ErrorState title="Could not delete group" message={error} />}
        <AlertDialogFooter>
          <AlertDialogCancel disabled={pending}>Cancel</AlertDialogCancel>
          <AlertDialogAction
            onClick={(e) => {
              e.preventDefault();
              void confirm();
            }}
            disabled={pending}
            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
          >
            {pending ? "Deleting…" : "Delete group"}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
