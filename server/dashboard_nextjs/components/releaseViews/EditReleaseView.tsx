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
import { Pencil, Trash } from "lucide-react";
import { Dimension } from "@/app/dashboard/[orgId]/[appId]/dimensions/page";
import { apiFetch } from "@/lib/api";
import { useAppContext } from "@/providers/app-context";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { View } from "@/app/dashboard/[orgId]/[appId]/views/page";

interface DimensionEntry {
  key: string;
  value: string;
}

interface EditReleaseViewProps {
  view: View;
  onViewUpdated?: (view: View) => void;
}

const EditReleaseView: React.FC<EditReleaseViewProps> = ({
  view,
  onViewUpdated,
}) => {
  const { token, org, app } = useAppContext();
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [dimensions, setDimensions] = useState<Dimension[]>([]);
  const [viewName, setViewName] = useState<string>(view.name || "");
  const [dimensionEntries, setDimensionEntries] = useState<DimensionEntry[]>(
    view.dimensions || [{ key: "", value: "" }]
  );

  const [isUpdating, setIsUpdating] = useState(false);
  const [isLoadingDimensions, setIsLoadingDimensions] = useState(false);

  const fetchDimensions = useCallback(async () => {
    setIsLoadingDimensions(true);
    try {
      const response = await apiFetch(
        `/organisations/applications/dimension/list`,
        { method: "GET" },
        { token, org, app }
      );
      setDimensions(response.data);
    } catch (err: any) {
      console.error("Error fetching dimensions:", err);
    } finally {
      setIsLoadingDimensions(false);
    }
  }, [app, org, token]);

  const handleAddEntry = () => {
    setDimensionEntries([...dimensionEntries, { key: "", value: "" }]);
  };

  const handleRemoveEntry = (index: number) => {
    setDimensionEntries(dimensionEntries.filter((_, i) => i !== index));
  };

  const handleEntryChange = (
    index: number,
    field: keyof DimensionEntry,
    value: string
  ) => {
    const updated = [...dimensionEntries];
    updated[index][field] = value;
    setDimensionEntries(updated);
  };

  const handleUpdateView = async () => {
    if (!viewName.trim()) return;

    const dimensionsArray = dimensionEntries
      .filter((entry) => entry.key && entry.value.trim())
      .map((entry) => ({
        key: entry.key,
        value: entry.value.trim(),
      }));

    if (dimensionsArray.length === 0) return;

    setIsUpdating(true);
    try {
      const response: View = await apiFetch(
        `/organisations/applications/dimension/release-view/${view.id}`,
        {
          method: "PUT",
          body: {
            name: viewName.trim(),
            dimensions: dimensionsArray,
          },
        },
        { token, org, app }
      );

      if (response) {
        onViewUpdated?.(response);
      }
      handleCloseModal();
    } catch (error: any) {
      console.error("Error updating view:", error);
    } finally {
      setIsUpdating(false);
    }
  };

  const handleCloseModal = () => {
    setIsModalOpen(false);
    setViewName(view.name || "");
    setDimensionEntries(view.dimensions || [{ key: "", value: "" }]);
  };

  useEffect(() => {
    fetchDimensions();
  }, [fetchDimensions]);

  return (
    <Dialog open={isModalOpen} onOpenChange={setIsModalOpen}>
      <DialogTrigger asChild>
        <Button variant="ghost" size="icon">
          <Pencil className="h-4 w-4" />
        </Button>
      </DialogTrigger>

      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Edit view</DialogTitle>
          <DialogDescription>
            Update details for <strong>{view.name}</strong>.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="key">View Name *</Label>
            <Input
              id="key"
              value={viewName}
              onChange={(e) =>
                setViewName(e.target.value.toLowerCase().replace(/\s+/g, "_"))
              }
            />
          </div>

          <div className="space-y-3">
            <Label>Dimensions *</Label>
            {dimensionEntries.map((entry, index) => (
              <div key={index} className="flex gap-2 items-center">
                <Select
                  value={entry.key}
                  onValueChange={(val) => handleEntryChange(index, "key", val)}
                  disabled={isLoadingDimensions || dimensions.length === 0}
                >
                  <SelectTrigger className="w-40">
                    <SelectValue placeholder="Select key" />
                  </SelectTrigger>
                  <SelectContent>
                    {dimensions.map((d) => (
                      <SelectItem key={d.dimension} value={d.dimension}>
                        {d.dimension}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>

                <Input
                  className="flex-1"
                  placeholder="Enter value"
                  value={entry.value}
                  onChange={(e) =>
                    handleEntryChange(index, "value", e.target.value)
                  }
                />

                {dimensionEntries.length > 1 && (
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    onClick={() => handleRemoveEntry(index)}
                  >
                    <Trash className="h-4 w-4" />
                  </Button>
                )}
              </div>
            ))}
            <Button type="button" variant="outline" onClick={handleAddEntry}>
              + Add Dimension
            </Button>
          </div>

          <div className="flex justify-end">
            <Button onClick={handleUpdateView} disabled={isUpdating}>
              {isUpdating ? "Updating..." : "Update View"}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default EditReleaseView;
