"use client";

import React, { useCallback, useEffect, useMemo } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Info } from "lucide-react";
import { useReleaseForm } from "../ReleaseFormContext";
import { FileChooser, SelectedFile } from "@/components/file-chooser";
import { FileSetPicker } from "@/components/file-set-picker";
import { parseFileRef } from "@/lib/utils";
import { toastError } from "@/hooks/use-toast";
import type { FileSet, FileSetMember } from "@/types/files";

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

  // File sets: ticking one copies its latest version's files into the
  // resources (the release doesn't remember the set); ticking it again
  // removes exactly those file versions. Files already in the package are
  // skipped.
  const isChosen = useCallback(
    (f: FileSetMember) => selectedResources.has(`${f.file_path}@version:${f.version}`),
    [selectedResources]
  );
  const selectableOf = useCallback(
    (setFiles: FileSetMember[]) => setFiles.filter((f) => !packageFilePaths.has(f.file_path)),
    [packageFilePaths]
  );
  const isSetSelected = useCallback(
    (_fileSet: FileSet, setFiles: FileSetMember[] | undefined) => {
      const candidates = setFiles ? selectableOf(setFiles) : [];
      return candidates.length > 0 && candidates.every(isChosen);
    },
    [selectableOf, isChosen]
  );
  const describeSet = useCallback(
    (_fileSet: FileSet, setFiles: FileSetMember[] | undefined) => {
      if (!setFiles) return undefined;
      const candidates = selectableOf(setFiles);
      if (candidates.length === 0) {
        return {
          badge: "all in package",
          disabled: true,
          title: "All files of this set are already in the package",
        };
      }
      const chosen = candidates.filter(isChosen).length;
      return {
        badge: chosen > 0 && chosen < candidates.length ? "partial" : undefined,
        note:
          candidates.length < setFiles.length
            ? `${candidates.length} of ${setFiles.length} selectable`
            : `${setFiles.length} file${setFiles.length === 1 ? "" : "s"}`,
      };
    },
    [selectableOf, isChosen]
  );
  const handleSetToggle = (fileSet: FileSet, setFiles: FileSetMember[]) => {
    const candidates = selectableOf(setFiles);
    if (candidates.length === 0) {
      toastError(`Cannot add file set "${fileSet.name}"`, "All of its files are already in the package.");
      return;
    }
    const keys = candidates.map((f) => `${f.file_path}@version:${f.version}`);
    if (candidates.every(isChosen)) {
      const next = new Set(selectedResources);
      keys.forEach((k) => next.delete(k));
      setSelectedResources(next);
      return;
    }
    // The exact same file version can't be selected twice, e.g. from two
    // overlapping sets. The same path at a different version is allowed.
    const duplicates = candidates.filter(isChosen);
    if (duplicates.length > 0) {
      const sample = `${duplicates[0].file_path}@v${duplicates[0].version}`;
      toastError(
        `Cannot add file set "${fileSet.name}"`,
        `${duplicates.length} of its file${duplicates.length === 1 ? " is" : "s are"} already selected (e.g. ${sample}). The same file version cannot be included twice.`
      );
      return;
    }
    setSelectedResources(new Set([...selectedResources, ...keys]));
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
          <FileSetPicker
            className="mb-4"
            isSelected={isSetSelected}
            onToggle={handleSetToggle}
            describe={describeSet}
          />
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
