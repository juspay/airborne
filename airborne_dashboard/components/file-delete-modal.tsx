"use client";

import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { useAppContext } from "@/providers/app-context";
import { apiFetch } from "@/lib/api";
import { Trash2 } from "lucide-react";

interface FileDeleteModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  file: {
    id: string;
    file_path: string;
    version: number;
  } | null;
  onDeleted?: () => void;
}

export function FileDeleteModal({ open, onOpenChange, file, onDeleted }: FileDeleteModalProps) {
  const { token, org, app } = useAppContext();
  const [deleteAllVersions, setDeleteAllVersions] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleDelete = async () => {
    if (!file) return;

    setIsDeleting(true);
    setError(null);

    try {
      const fileKey = file.id || file.file_path;
      await apiFetch(
        `/file?file_id=${encodeURIComponent(fileKey)}&delete_all_versions=${deleteAllVersions}`,
        {
          method: "DELETE",
        },
        { token, org, app }
      );
      onOpenChange(false);
      setDeleteAllVersions(false);
      onDeleted?.();
    } catch (e: any) {
      setError(e.message || "Failed to delete file");
    } finally {
      setIsDeleting(false);
    }
  };

  const handleClose = () => {
    if (!isDeleting) {
      onOpenChange(false);
      setDeleteAllVersions(false);
      setError(null);
    }
  };

  if (!file) return null;

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 font-[family-name:var(--font-space-grotesk)]">
            <Trash2 className="h-5 w-5 text-red-500" />
            Delete File
          </DialogTitle>
          <DialogDescription>
            Are you sure you want to delete{" "}
            <code className="rounded bg-muted px-1 py-0.5 text-sm font-mono">{file.file_path}</code>?
            <br />
            <span className="text-red-600">This action cannot be undone.</span>
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          <div className="flex items-start space-x-3 rounded-lg border p-4">
            <Checkbox
              id="deleteAllVersions"
              checked={deleteAllVersions}
              onCheckedChange={(checked) => setDeleteAllVersions(checked === true)}
              className="mt-0.5"
            />
            <div className="space-y-1">
              <Label htmlFor="deleteAllVersions" className="text-sm font-medium leading-none cursor-pointer">
                Delete all versions
              </Label>
              <p className="text-xs text-muted-foreground">
                When checked, all versions of this file will be deleted. Otherwise, only version {file.version} will be
                removed.
              </p>
            </div>
          </div>

          {error && <div className="rounded-lg bg-red-50 p-3 text-sm text-red-600 dark:bg-red-950/50">{error}</div>}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={handleClose} disabled={isDeleting}>
            Cancel
          </Button>
          <Button variant="destructive" onClick={handleDelete} disabled={isDeleting} className="gap-2">
            {isDeleting ? "Deleting..." : "Delete File"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
