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
import { Trash } from "lucide-react";
import { apiFetch } from "@/lib/api";
import { useAppContext } from "@/providers/app-context";
import { View } from "@/app/dashboard/[orgId]/[appId]/views/page";

interface DeleteReleaseViewProps {
  view: View;
  onViewDeleted?: (viewId: string) => void;
}

const DeleteReleaseView: React.FC<DeleteReleaseViewProps> = ({ view, onViewDeleted }) => {
  const { token, org, app } = useAppContext();
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  const handleDelete = async () => {
    setIsDeleting(true);
    try {
      await apiFetch(
        `/organisations/applications/dimension/release-view/${view.id}`,
        { method: "DELETE" },
        { token, org, app }
      );

      onViewDeleted?.(view.id);
      handleClose();
    } catch (error: any) {
      console.error("Error deleting view:", error);
    } finally {
      setIsDeleting(false);
    }
  };

  const handleClose = () => {
    setIsModalOpen(false);
  };

  return (
    <Dialog open={isModalOpen} onOpenChange={setIsModalOpen}>
      <DialogTrigger asChild>
        <Button variant="ghost" size="icon" className="cursor-pointer">
          <Trash className="h-4 w-4 text-red-500" />
        </Button>
      </DialogTrigger>

      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Delete view</DialogTitle>
          <DialogDescription>
            Are you sure you want to delete <strong className="text-red-600">{view.name}</strong>? <br />
            This action cannot be undone.
          </DialogDescription>
        </DialogHeader>

        <div className="flex justify-end gap-2">
          <Button variant="outline" onClick={handleClose} disabled={isDeleting}>
            Cancel
          </Button>
          <Button variant="destructive" onClick={handleDelete} disabled={isDeleting}>
            {isDeleting ? "Deleting..." : "Delete"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default DeleteReleaseView;
