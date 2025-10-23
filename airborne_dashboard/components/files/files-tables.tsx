"use client";

import type React from "react";

import { Checkbox } from "@/components/ui/checkbox";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { FileVersions } from "./file-versions";
import { cn } from "@/lib/utils";

export interface FileRow {
  file_path: string;
  latest_version: number;
  total_versions: number;
  id: string;
}

export interface FileTableProps {
  files: FileRow[];
  isLoading?: boolean;
  onSelect?: (file_path: string, file_id: string) => void;
  isFilePathSelected?: (file_path: string) => boolean;
  isFileIdSelected?: (file_path: string, file_id: string) => boolean;
  disabled?: (file_path: string) => { disabled: boolean; text: string };
}

export function FileTable({
  files,
  isLoading = false,
  onSelect,
  isFilePathSelected,
  isFileIdSelected,
  disabled,
}: FileTableProps) {
  const hasSelectionMode = onSelect !== undefined && isFilePathSelected !== undefined && isFileIdSelected;

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-8">
        <p className="text-muted-foreground">Loading files...</p>
      </div>
    );
  }

  if (files.length === 0) {
    return (
      <div className="flex items-center justify-center py-8">
        <p className="text-muted-foreground">No files found</p>
      </div>
    );
  }

  return (
    <div className="border rounded-lg overflow-hidden">
      {/* Table Header */}
      <div className="grid gap-0 bg-muted/50 border-b border-border">
        <div
          className={cn(
            "grid items-center px-4 py-3 text-sm font-semibold text-foreground",
            hasSelectionMode ? "grid-cols-[48px_1fr_120px_120px]" : "grid-cols-[1fr_120px_120px]"
          )}
        >
          {hasSelectionMode && <div className="w-12" />}
          <div>File Path</div>
          <div>Latest Version</div>
          <div>Total Versions</div>
        </div>
      </div>

      {/* Accordion Rows */}
      <Accordion type="single" collapsible className="w-full">
        {files.map((file) => {
          const isDisabled = disabled?.(file.file_path);
          return (
            <AccordionItem
              key={file.id}
              value={file.id}
              className={cn("border-b last:border-b-0", isDisabled?.disabled && "opacity-50 cursor-not-allowed")}
            >
              <div
                className={cn(
                  "grid items-center px-4 py-3 hover:bg-muted/50 transition-colors",
                  hasSelectionMode ? "grid-cols-[48px_1fr_120px_120px]" : "grid-cols-[1fr_120px_120px]"
                )}
              >
                {hasSelectionMode && (
                  <div onClick={() => onSelect(file.file_path, file.id)}>
                    <Checkbox checked={isFilePathSelected(file.file_path)} />
                  </div>
                )}
                <AccordionTrigger
                  disabled={isDisabled?.disabled}
                  className="hover:no-underline py-0 justify-start gap-2"
                >
                  <div className="flex flex-col">
                    <span className="text-sm font-medium truncate">{file.file_path}</span>
                    {isDisabled?.disabled && <span className="text-xs text-amber-600">{isDisabled.text}</span>}
                  </div>
                </AccordionTrigger>
                <div className="text-sm">v{file.latest_version}</div>
                <div className="text-sm text-muted-foreground">{file.total_versions}</div>
              </div>

              {/* Accordion Content */}
              <AccordionContent className="bg-muted/20 border-t px-4 py-4">
                <div className={hasSelectionMode ? "ml-12" : ""}>
                  <FileVersions filePath={file.file_path} onSelect={onSelect} isSelected={isFileIdSelected} />
                </div>
              </AccordionContent>
            </AccordionItem>
          );
        })}
      </Accordion>
    </div>
  );
}
