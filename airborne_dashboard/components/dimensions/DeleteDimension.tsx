"use client";
import React, { useCallback, useEffect, useState } from "react";
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
import { ArrowRight, Trash2 } from "lucide-react";
import Link from "next/link";
import { apiFetch } from "@/lib/api";
import { useAppContext } from "@/providers/app-context";

/** The live release of one dimension slice that targets the dimension being deleted. */
type DimensionActiveRelease = {
  release_id: string;
  view_id: string;
  view_name: string;
  dimensions: { key: string; value: string }[];
  status: string;
  package_version: number;
};

interface DeleteDimensionProps {
  dimension: string;
  onDimensionDeleted?: (dimension: string) => void;
}

/**
 * Deleting a dimension is only safe once nothing targets it, so the dialog first asks the server
 * which slices are still live on it and sends the user off to delete those releases.
 */
const DeleteDimension: React.FC<DeleteDimensionProps> = ({ dimension, onDimensionDeleted }) => {
  const { token, org, app } = useAppContext();
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isChecking, setIsChecking] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [activeReleases, setActiveReleases] = useState<DimensionActiveRelease[] | null>(null);

  const dashboardPath = `/dashboard/${encodeURIComponent(org || "")}/${encodeURIComponent(app || "")}`;

  const checkActiveReleases = useCallback(async () => {
    setIsChecking(true);
    setActiveReleases(null);
    try {
      const res: { data: DimensionActiveRelease[] } = await apiFetch(
        `/organisations/applications/dimension/${encodeURIComponent(dimension)}/active-releases`,
        {},
        { token, org, app }
      );
      setActiveReleases(res.data ?? []);
    } catch (error) {
      console.error("Failed to check active releases:", error);
    } finally {
      setIsChecking(false);
    }
  }, [dimension, token, org, app]);

  useEffect(() => {
    if (isModalOpen) checkActiveReleases();
  }, [isModalOpen, checkActiveReleases]);

  const handleDelete = async () => {
    setIsDeleting(true);
    try {
      await apiFetch(
        `/organisations/applications/dimension/${encodeURIComponent(dimension)}`,
        { method: "DELETE" },
        { token, org, app }
      );
      onDimensionDeleted?.(dimension);
      setIsModalOpen(false);
    } catch (error) {
      // apiFetch surfaces the reason as a toast; re-check in case a release appeared meanwhile.
      console.error("Failed to delete dimension:", error);
      checkActiveReleases();
    } finally {
      setIsDeleting(false);
    }
  };

  const isBlocked = (activeReleases?.length ?? 0) > 0;

  return (
    <Dialog open={isModalOpen} onOpenChange={setIsModalOpen}>
      <DialogTrigger asChild>
        <Button variant="ghost" size="icon" className="cursor-pointer" title="Delete dimension">
          <Trash2 className="h-4 w-4 text-red-500" />
        </Button>
      </DialogTrigger>

      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Delete dimension</DialogTitle>
          <DialogDescription>
            A dimension can only be removed once nothing is being targeted with it, so Airborne checks your live
            releases first.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 text-sm">
          <p>
            Dimension: <span className="font-mono font-medium">{dimension}</span>
          </p>

          {isChecking && <p className="text-muted-foreground">Checking for releases that target it…</p>}

          {!isChecking && activeReleases !== null && !isBlocked && (
            <p className="text-muted-foreground">
              No release targets this dimension. Deleting it removes it from targeting for this app — future releases
              will no longer be able to use it.
            </p>
          )}

          {!isChecking && isBlocked && (
            <div className="space-y-3">
              <p>
                {activeReleases!.length} release{activeReleases!.length === 1 ? " is" : "s are"} still live on this
                dimension — one for each slice of users you have released to. Delete{" "}
                {activeReleases!.length === 1 ? "it" : "each of them"} from the matching view first; deleting a release
                hands those users back to your default configuration.
              </p>

              <ul className="space-y-2 rounded-md border bg-muted/40 p-3">
                {activeReleases!.map((release) => (
                  <li key={release.release_id} className="flex items-start justify-between gap-3">
                    <div className="min-w-0 space-y-1">
                      <div className="flex flex-wrap items-center gap-1.5">
                        <span className="font-medium">{release.view_name}</span>
                        <Badge variant="outline" className="text-xs">
                          {release.status}
                        </Badge>
                      </div>
                      <div className="flex flex-wrap gap-1.5">
                        {release.dimensions?.map((entry, index) => (
                          <Badge key={`${entry.key}-${index}`} variant="secondary" className="px-2 py-0.5 text-xs">
                            <span className="font-medium">{entry.key}:</span>
                            <span className="ml-1">{entry.value}</span>
                          </Badge>
                        ))}
                      </div>
                    </div>
                    <Button variant="ghost" size="sm" asChild className="shrink-0">
                      <Link href={`${dashboardPath}/releases/${encodeURIComponent(release.release_id)}`}>
                        Release
                        <ArrowRight className="h-3.5 w-3.5" />
                      </Link>
                    </Button>
                  </li>
                ))}
              </ul>

              <Button variant="outline" size="sm" asChild className="gap-1.5">
                <Link href={`${dashboardPath}/views?view_type=auto_generated`}>
                  Go to Release Views
                  <ArrowRight className="h-4 w-4" />
                </Link>
              </Button>
            </div>
          )}
        </div>

        <div className="flex justify-end gap-2">
          <Button variant="outline" onClick={() => setIsModalOpen(false)} disabled={isDeleting}>
            Cancel
          </Button>
          <Button
            variant="destructive"
            onClick={handleDelete}
            disabled={isChecking || isDeleting || isBlocked || activeReleases === null}
          >
            {isDeleting ? "Deleting..." : "Delete dimension"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default DeleteDimension;
