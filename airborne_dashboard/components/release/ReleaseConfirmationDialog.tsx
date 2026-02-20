"use client";

import React from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogFooter,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { ReleaseConfigRequest, Pkg } from "@/types/release";
import hljs from "highlight.js";
import json from "highlight.js/lib/languages/json";
import "highlight.js/styles/vs2015.css";

hljs.registerLanguage("json", json);

interface ReleaseConfirmationDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
  releaseConfig: ReleaseConfigRequest;
  selectedPackage: Pkg | null;
  org: string;
  app: string;
  mode: "create" | "clone" | "edit";
  isSubmitting?: boolean;
}

export function ReleaseConfirmationDialog({
  isOpen,
  onClose,
  onConfirm,
  releaseConfig,
  selectedPackage,
  org,
  app,
  mode,
  isSubmitting = false,
}: ReleaseConfirmationDialogProps) {
  const actionText = mode === "edit" ? "Update" : "Create";

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl md:max-w-4xl lg:max-w-6xl max-h-[80vh]">
        <DialogHeader>
          <DialogTitle>Confirm {actionText} Release</DialogTitle>
          <DialogDescription>
            Please confirm the details below before {mode === "edit" ? "updating" : "creating"} the release.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 mt-4 overflow-y-auto max-h-[calc(80vh-200px)]">
          <div>
            <span className="font-semibold">Organization:</span> {org}
          </div>
          <div>
            <span className="font-semibold">Application:</span> {app}
          </div>
          <div>
            <span className="font-semibold">Release Config:</span>
            <div className="mt-2 max-h-48 md:max-h-64 lg:max-h-80 overflow-x-auto overflow-y-auto rounded-md border border-gray-200">
              <pre className="whitespace-pre p-4 text-sm md:text-base">
                <code
                  className="language-json"
                  dangerouslySetInnerHTML={{
                    __html: hljs.highlight(
                      JSON.stringify(
                        {
                          ...releaseConfig,
                          package: {
                            ...(selectedPackage?.index && { index: selectedPackage.index }),
                            ...releaseConfig.package,
                          },
                        },
                        null,
                        2
                      ),
                      { language: "json" }
                    ).value,
                  }}
                />
              </pre>
            </div>
          </div>
        </div>

        <DialogFooter className="mt-6 flex justify-end gap-3">
          <Button variant="outline" onClick={onClose} disabled={isSubmitting}>
            Cancel
          </Button>
          <Button variant="default" onClick={onConfirm} disabled={isSubmitting}>
            {isSubmitting ? (mode === "edit" ? "Updating..." : "Creating...") : "Confirm"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export default ReleaseConfirmationDialog;
