"use client";

import React, { useEffect, useMemo } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Info } from "lucide-react";
import { useReleaseForm } from "../ReleaseFormContext";
import { FileChooser, SelectedFile } from "@/components/file-chooser";
import { parseFileRef } from "@/lib/utils";

export function ResourcesStep() {
  const { mode, files, selectedPackage, selectedResources, setSelectedResources } = useReleaseForm();

  // Convert selectedResources Set<resourceId> to SelectedFile array for FileChooser
  const selectedFiles: SelectedFile[] = useMemo(() => {
    return Array.from(selectedResources).map((resourceId) => {
      const { filePath, version } = parseFileRef(resourceId);
      return {
        file_path: filePath,
        version: version ?? 1,
        url: "",
      };
    });
  }, [selectedResources]);

  // Get package file paths to filter them out
  const packageFilePaths = useMemo(() => {
    return new Set([
      ...files.map((f) => f.file_path),
      ...(selectedPackage?.index ? [parseFileRef(selectedPackage.index).filePath] : []),
      ...(selectedPackage?.files || []).map((fileRef) => parseFileRef(fileRef).filePath),
    ]);
  }, [files, selectedPackage]);

  // Update selectedResources when FileChooser changes
  const handleResourcesChange = (files: SelectedFile[]) => {
    // Convert SelectedFile[] to resource IDs (file_path@version:N format)
    const newResourceIds = new Set(files.map((f) => `${f.file_path}@version:${f.version}`));

    // Filter out files that are already in the package
    const filteredIds = new Set(
      Array.from(newResourceIds).filter((id) => {
        const { filePath } = parseFileRef(id);
        return !packageFilePaths.has(filePath);
      })
    );

    setSelectedResources(filteredIds);
  };

  // Remove package files from selection - only runs when package changes, not when selection changes
  useEffect(() => {
    if (packageFilePaths.size === 0) return;

    const newSet = new Set(selectedResources);
    let changed = false;
    for (const resourceId of selectedResources) {
      const { filePath } = parseFileRef(resourceId);
      if (packageFilePaths.has(filePath)) {
        newSet.delete(resourceId);
        changed = true;
      }
    }
    if (changed) {
      setSelectedResources(newSet);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [packageFilePaths, setSelectedResources]);

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="font-[family-name:var(--font-space-grotesk)]">Select Resources</CardTitle>
          <CardDescription>Choose additional files to include as resources in this release</CardDescription>
          {(mode === "clone" || mode === "edit") && selectedResources.size > 0 && (
            <div className="flex items-start gap-2 p-3 bg-blue-50 border border-blue-200 rounded-lg mt-2">
              <Info className="h-4 w-4 text-blue-600 mt-0.5" />
              <div className="text-sm text-blue-800">
                <span className="font-medium">
                  {mode === "edit" ? "Current" : "Original"} release has {selectedResources.size} resource
                  {selectedResources.size !== 1 ? "s" : ""} pre-selected.
                </span>
              </div>
            </div>
          )}
        </CardHeader>
        <CardContent>
          <FileChooser
            mode="multi"
            selected={selectedFiles}
            onChange={handleResourcesChange}
            excludeFiles={Array.from(packageFilePaths)}
          />

          {selectedResources.size > 0 && (
            <div className="mt-4 p-3 bg-green-50 border border-green-200 rounded-lg">
              <div className="text-sm text-green-800">
                Selected {selectedResources.size} resource
                {selectedResources.size !== 1 ? "s" : ""} for this release
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

export default ResourcesStep;
