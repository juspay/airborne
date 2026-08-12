"use client";
import React, { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Trash2 } from "lucide-react";
import { apiFetch } from "@/lib/api";
import { useAppContext } from "@/providers/app-context";
import { View } from "@/app/dashboard/[orgId]/[appId]/views/page";

interface DeleteSliceReleaseProps {
  view: View;
  onDeleteReleaseCreated?: (viewId: string, releaseId: string) => void;
}

type CreateDeleteReleaseResponse = {
  release_id: string;
  view_id: string;
  status: string;
};

/**
 * Starts the deletion of the release covering an auto-generated view's dimension slice. This does
 * not delete anything on its own — it creates a release carrying the default config, which still
 * has to be ramped and concluded from the Releases page.
 */
const DeleteSliceRelease: React.FC<DeleteSliceReleaseProps> = ({ view, onDeleteReleaseCreated }) => {
  const { token, org, app } = useAppContext();
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isCreating, setIsCreating] = useState(false);

  const handleDeleteRelease = async () => {
    setIsCreating(true);
    try {
      const res: CreateDeleteReleaseResponse = await apiFetch(
        `/releases/views/${view.id}/delete`,
        { method: "POST" },
        { token, org, app }
      );

      onDeleteReleaseCreated?.(view.id, res.release_id);
      setIsModalOpen(false);
    } catch (error) {
      // apiFetch already surfaces the reason as a toast; keep the dialog open so it can be retried.
      console.error("Error starting release deletion:", error);
    } finally {
      setIsCreating(false);
    }
  };

  return (
    <Dialog open={isModalOpen} onOpenChange={setIsModalOpen}>
      <DialogTrigger asChild>
        <Button variant="ghost" size="sm" className="cursor-pointer gap-1.5 text-red-500 hover:text-red-500">
          <Trash2 className="h-4 w-4" />
          Delete release
        </Button>
      </DialogTrigger>

      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Delete this release</DialogTitle>
          <DialogDescription>
            In Airborne a deletion is itself a release, so you roll it back out gradually instead of switching users
            over all at once.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 text-sm">
          <div className="space-y-2">
            <p className="text-muted-foreground">These users stop getting their own configuration:</p>
            <div className="flex flex-wrap gap-1.5">
              {view.dimensions?.map((dimension, index) => (
                <Badge key={`${dimension.key}-${index}`} variant="secondary" className="px-2 py-0.5 text-xs">
                  <span className="font-medium">{dimension.key}:</span>
                  <span className="ml-1">{dimension.value}</span>
                </Badge>
              ))}
            </div>
          </div>

          <ol className="space-y-3 rounded-md border bg-muted/40 p-4">
            <li className="flex gap-3">
              <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-primary/10 text-xs font-medium text-primary">
                1
              </span>
              <span>
                Airborne creates a <strong>deletion release</strong> for these dimensions. While it runs it previews
                your default configuration — whatever your global release ships.
              </span>
            </li>
            <li className="flex gap-3">
              <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-primary/10 text-xs font-medium text-primary">
                2
              </span>
              <span>
                Nothing reaches users yet. It starts at 0% traffic, and you <strong>ramp</strong> it from the Releases
                page — so only a share of these users moves back to the default at first, and you can watch for errors
                as you go.
              </span>
            </li>
            <li className="flex gap-3">
              <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-primary/10 text-xs font-medium text-primary">
                3
              </span>
              <span>
                <strong>Conclude</strong> it to finish: these dimensions lose their own configuration for good, so they
                follow your default from then on — including every global release you ship afterwards. This view goes
                away.
              </span>
            </li>
          </ol>

          <p className="text-muted-foreground">
            You can back out at any point — discard the deletion release before ramping, or conclude it on its control
            variant. Either way nothing changes and this view stays. While the deletion is in progress you won&apos;t be
            able to create a global release, because that would move the default it is based on.
          </p>
        </div>

        <div className="flex justify-end gap-2">
          <Button variant="outline" onClick={() => setIsModalOpen(false)} disabled={isCreating}>
            Cancel
          </Button>
          <Button variant="destructive" onClick={handleDeleteRelease} disabled={isCreating}>
            {isCreating ? "Creating..." : "Create deletion release"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default DeleteSliceRelease;
