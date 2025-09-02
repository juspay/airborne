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
import { Plus, Trash } from "lucide-react";
import { Dimension } from "@/app/dashboard/[orgId]/[appId]/dimensions/page";
import { apiFetch } from "@/lib/api";
import { useAppContext } from "@/providers/app-context";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { View } from "@/app/dashboard/[orgId]/[appId]/views/page";

interface DimensionEntry {
  key: string;
  value: string;
}

interface CreateReleaseViewProps {
  onViewCreated?: (view: View) => void;
}
const CreateReleaseView: React.FC<CreateReleaseViewProps> = ({ onViewCreated }) => {
  const { token, org, app } = useAppContext();
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [dimensions, setDimensions] = useState<Dimension[]>([]);
  const [viewName, setViewName] = useState<string>("");
  const [dimensionEntries, setDimensionEntries] = useState<DimensionEntry[]>([
    { key: "", value: "" },
  ]);

  const [isCreating, setIsCreating] = useState(false);
  const [isLoadingDimensions, setIsLoadingDimensions] = useState(false);

  const fetchDimensions = useCallback(async () => {
    setIsLoadingDimensions(true);
    try {
      const response = await apiFetch(
        `/organisations/applications/dimension/list`,
        {
          method: "GET",
        },
        {
          token,
          org,
          app,
        }
      );

      setDimensions(response.data);
    } catch (err: any) {
      console.error("Error fetching dimensions:", err);
    } finally {
      setIsLoadingDimensions(false);
    }
  }, [app, org]);

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
   const handleCreateView = async () => {
    if (!viewName.trim()) {
      // showError("Please enter a view name");
      return;
    }

    // Build dimensions as array to allow duplicate keys
    const dimensionsArray = dimensionEntries
      .filter(entry => entry.key && entry.value.trim())
      .map(entry => ({
        key: entry.key,
        value: entry.value.trim()
      }));

    if (dimensionsArray.length === 0) {
      // showError("Please add at least one dimension with a value");
      return;
    }

    setIsCreating(true);
    try {
      const response:View = await apiFetch(
        `/organisations/applications/dimension/release-view`,
        { method: "POST",
          body: { 
          name: viewName.trim(),
          dimensions: dimensionsArray,
          }
        },
        {
         token,
         org,
         app
        }
      );

      if(response){
        onViewCreated?.(response);
      }
      
      handleCloseModal();
      // showSuccess("Release view created successfully");
      
      // if (onViewCreated) {
      //   onViewCreated(response.data);
      // }
      
      
    } catch (error: any) {
      console.error("Error creating view:", error);
      // showError(error.response?.data?.message || "Failed to create view. Please try again.");
    } finally {
      setIsCreating(false);
    }
  };

  const handleCloseModal = () => {
    setIsModalOpen(false);
    setViewName("");
    setDimensionEntries([{ key: "", value: "" }]);
  }

  useEffect(() => {
    fetchDimensions();
  }, []);

  return (
    <Dialog open={isModalOpen} onOpenChange={setIsModalOpen}>
      <DialogTrigger asChild>
        <Button className="gap-2">
          <Plus className="h-4 w-4" />
          Create View
        </Button>
      </DialogTrigger>

      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Create a new view</DialogTitle>
          <DialogDescription>
            Please enter the details for the new view.
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
                  onValueChange={(val) =>
                    handleEntryChange(index, "key", val)
                  }
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

          {/* Submit */}
          <div className="flex justify-end">
            <Button onClick={handleCreateView} disabled={isCreating}>
              {isCreating ? "Creating..." : "Create View"}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default CreateReleaseView;
