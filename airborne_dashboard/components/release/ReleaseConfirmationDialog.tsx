"use client";

import React, { useEffect, useState } from "react";
import { cn } from "@/lib/utils";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { RollbackMarkerSelect } from "@/components/control-center/marker-select";
import type { RollbackSensitiveReason } from "@/lib/control-center/types";
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
import { convertDottedToNestedObject } from "@/components/remote-config/utils/helpers";

hljs.registerLanguage("json", json);

interface ReleaseConfirmationDialogProps {
  isOpen: boolean;
  onClose: () => void;
  /** `reason` and `marker` are set when the release is raised as a deployment request (maker-checker on). */
  onConfirm: (reason?: string, marker?: RollbackSensitiveReason | null) => void;
  releaseConfig: ReleaseConfigRequest;
  selectedPackage: Pkg | null;
  org: string;
  app: string;
  mode: "create" | "clone" | "edit";
  isSubmitting?: boolean;
  /** Maker-checker is on for the application: nothing is released until a different checker approves. */
  asRequest?: boolean;
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
  asRequest = false,
}: ReleaseConfirmationDialogProps) {
  const actionText = mode === "edit" ? "Update" : "Create";
  const [reason, setReason] = useState("");
  const [marker, setMarker] = useState<RollbackSensitiveReason | null>(null);
  useEffect(() => {
    if (isOpen) {
      setReason("");
      setMarker(null);
    }
  }, [isOpen]);

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent
        className={cn(
          "max-w-2xl md:max-w-4xl lg:max-w-6xl max-h-[80vh]",
          // A request adds a marker and a reason below the config, so the whole dialog scrolls instead.
          asRequest && "max-h-[92vh] overflow-y-auto"
        )}
      >
        <DialogHeader>
          <DialogTitle>
            {asRequest
              ? mode === "edit"
                ? "Request override edit"
                : "Request release"
              : `Confirm ${actionText} Release`}
          </DialogTitle>
          <DialogDescription>
            {asRequest
              ? "Approval is on for this application. This exact configuration is sent as a request; a checker other than you approves it, and approval creates the release immediately. Nothing changes until then."
              : `Please confirm the details below before ${mode === "edit" ? "updating" : "creating"} the release.`}
          </DialogDescription>
        </DialogHeader>

        <div className={cn("space-y-4 mt-4", !asRequest && "overflow-y-auto max-h-[calc(80vh-200px)]")}>
          <div>
            <span className="font-semibold">Organization:</span> {org}
          </div>
          <div>
            <span className="font-semibold">Application:</span> {app}
          </div>
          <div>
            <span className="font-semibold">Release Config:</span>
            <div
              className={cn(
                "mt-2 max-h-48 md:max-h-64 lg:max-h-80 overflow-x-auto overflow-y-auto rounded-md border border-gray-200",
                asRequest && "md:max-h-40 lg:max-h-40"
              )}
            >
              <pre className="whitespace-pre p-4 text-sm md:text-base">
                <code
                  className="language-json"
                  dangerouslySetInnerHTML={{
                    __html: hljs.highlight(
                      JSON.stringify(
                        {
                          ...releaseConfig,
                          config: {
                            ...releaseConfig.config,
                            properties: releaseConfig.config?.properties
                              ? convertDottedToNestedObject(releaseConfig.config.properties)
                              : undefined,
                          },
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

        {asRequest && mode !== "edit" && (
          <div className="mt-4 rounded-md border p-3">
            <RollbackMarkerSelect
              value={marker}
              onChange={setMarker}
              disabled={isSubmitting}
              idPrefix="release-marker"
            />
          </div>
        )}

        {asRequest && (
          <div className="mt-4 space-y-1.5">
            <Label htmlFor="release-request-reason">Reason (required, shown to the checker)</Label>
            <Textarea
              id="release-request-reason"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              rows={2}
              placeholder="e.g. v5 fixes the checkout crash in JIRA-1234; QA signed off on build 512"
              disabled={isSubmitting}
            />
          </div>
        )}

        <DialogFooter className="mt-6 flex justify-end gap-3">
          <Button variant="outline" onClick={onClose} disabled={isSubmitting}>
            Cancel
          </Button>
          <Button
            variant="default"
            onClick={() => onConfirm(asRequest ? reason : undefined, asRequest && mode !== "edit" ? marker : undefined)}
            disabled={isSubmitting || (asRequest && reason.trim().length === 0)}
          >
            {isSubmitting
              ? asRequest
                ? "Raising request..."
                : mode === "edit"
                  ? "Updating..."
                  : "Creating..."
              : asRequest
                ? mode === "edit"
                  ? "Request override edit"
                  : "Request release"
                : "Confirm"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export default ReleaseConfirmationDialog;
