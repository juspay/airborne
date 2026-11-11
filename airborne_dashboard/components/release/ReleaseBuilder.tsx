"use client";

import React, { useState } from "react";
import { Button } from "@/components/ui/button";
import { Settings, Target, Cog, FileText, Info, Copy } from "lucide-react";
import { PlugIcon as PkgIcon } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useAppContext } from "@/providers/app-context";
import { apiFetch } from "@/lib/api";
import { useApprovalActions, useApprovalPolicy, useMe } from "@/lib/control-center/hooks";
import { classifyApprovalError, isMaker, requestButtonLabel } from "@/lib/control-center/approval";
import { requestPath } from "@/components/control-center/paths";
import type { RollbackSensitiveReason } from "@/lib/control-center/types";
import { toastError, toastSuccess, toastWarning } from "@/hooks/use-toast";

import { ReleaseFormProvider, useReleaseForm } from "./ReleaseFormContext";
import { StepIndicator } from "./StepIndicator";
import { ConfigurationStep } from "./steps/ConfigurationStep";
import { TargetingStep } from "./steps/TargetingStep";
import { RemoteConfigStep } from "./steps/RemoteConfigStep";
import { PackageSelectionStep } from "./steps/PackageSelectionStep";
import { FilePrioritiesStep } from "./steps/FilePrioritiesStep";
import { ResourcesStep } from "./steps/ResourcesStep";
import { ReleaseConfirmationDialog } from "./ReleaseConfirmationDialog";
import { ReleaseMode, ReleaseConfigRequest, ApiReleaseData, ReleaseStep } from "@/types/release";

const RELEASE_STEPS: ReleaseStep[] = [
  { number: 1, title: "Configure", icon: Settings },
  { number: 2, title: "Targeting", icon: Target },
  { number: 3, title: "Remote Config", icon: Cog },
  { number: 4, title: "Package & Details", icon: PkgIcon },
  { number: 5, title: "File Priorities", icon: Info },
  { number: 6, title: "Resources", icon: FileText },
];

function ReleaseBuilderContent() {
  const router = useRouter();
  const { token, org, app } = useAppContext();
  const {
    mode,
    releaseId,
    currentStep,
    totalSteps,
    goToNextStep,
    goToPreviousStep,
    canProceedToStep,
    createReleaseConfig,
    selectedPackage,
  } = useReleaseForm();

  const [isConfirmationDialogOpen, setIsConfirmationDialogOpen] = useState(false);
  const [releaseConfig, setReleaseConfig] = useState<ReleaseConfigRequest | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Maker-checker: when the application's policy is on, the release is raised as a request instead of created.
  const { policy } = useApprovalPolicy(org, app);
  const approvals = useApprovalActions();
  const me = useMe();
  const policyOn = Boolean(policy?.enabled);
  const maker = isMaker(policy, me);

  const handleSubmit = async (
    config: ReleaseConfigRequest,
    reason?: string,
    marker?: RollbackSensitiveReason | null
  ) => {
    setIsSubmitting(true);
    try {
      if (policyOn && org && app) {
        const req = await approvals.raise(org, app, {
          action: mode === "edit" && releaseId ? "update" : "create",
          payload:
            mode === "edit" && releaseId
              ? { release_id: releaseId, body: config }
              : { body: marker ? { ...config, rollback_sensitive: marker } : config },
          reason: (reason ?? "").trim(),
        });
        setIsConfirmationDialogOpen(false);
        toastSuccess("Request raised. Nothing has changed yet.", "A different checker must approve it.");
        router.push(requestPath(org, app, req.id));
        return;
      }
      let created: { id?: string; warnings?: string[] } = {};
      if (mode === "edit" && releaseId) {
        created = await apiFetch(
          `/releases/${encodeURIComponent(releaseId)}`,
          { method: "PUT", body: config, showErrorToast: false },
          { token, org, app }
        );
      } else {
        created = await apiFetch(
          "/releases",
          { method: "POST", body: config, showErrorToast: false },
          { token, org, app }
        );
        // Every release, including the first, is created at zero traffic. Say so before the operator looks for it.
        toastSuccess(
          "Release created, not started",
          "It is at a 0% rollout target. Open it, start the rollout, then make it live when you are ready."
        );
      }
      // The server warns about targeting (for example a general release behind locale-specific ones).
      for (const warning of created.warnings ?? []) toastWarning("Targeting warning", warning);
      setIsConfirmationDialogOpen(false);
      router.push(
        created.id
          ? `/dashboard/${encodeURIComponent(org || "")}/${encodeURIComponent(app || "")}/releases/${encodeURIComponent(created.id)}`
          : `/dashboard/${encodeURIComponent(org || "")}/${encodeURIComponent(app || "")}/releases`
      );
    } catch (e: any) {
      console.error("Release operation failed", e);
      const failure = classifyApprovalError(e, policyOn ? "raise" : "direct");
      if (failure.kind === "approval_required") {
        toastError(
          "Approval required",
          `${failure.message} Reload this page: it will then offer "Request release" instead.`
        );
      } else {
        toastError(policyOn ? "Could not raise the request" : "Release operation failed", failure.message);
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleCreateClick = () => {
    const config = createReleaseConfig();
    if (config) {
      setReleaseConfig(config);
      setIsConfirmationDialogOpen(true);
    }
  };

  const getActionButtonText = () => {
    if (policyOn) return mode === "edit" ? requestButtonLabel("update") : requestButtonLabel("create");
    switch (mode) {
      case "edit":
        return "Update Release";
      case "clone":
        return "Create Release";
      default:
        return "Create Release";
    }
  };

  const getPageTitle = () => {
    switch (mode) {
      case "edit":
        return "Edit Release";
      case "clone":
        return "Clone Release";
      default:
        return "Create Release";
    }
  };

  return (
    <div className="p-6">
      <div className="flex-1">
        <h1 className="text-3xl font-bold font-[family-name:var(--font-space-grotesk)] text-balance">
          {getPageTitle()}
        </h1>
        <p className="text-muted-foreground mt-2">Step-by-step: configure, remote config, package, files, targeting</p>

        {policyOn && (
          <div
            role="status"
            className="mt-4 flex items-start gap-2 rounded-lg border border-violet-500/40 bg-violet-500/5 p-3 text-sm"
          >
            <div>
              <p className="font-medium">Approval required for {app}</p>
              <p className="text-muted-foreground">
                {mode === "edit" ? "Updating" : "Creating"} a release here raises a request. Nothing is released until a
                checker other than you approves it.
                {!maker &&
                  " You are not listed as a maker for this application, so the server will refuse the request."}
              </p>
            </div>
          </div>
        )}

        {mode === "clone" && (
          <div className="flex items-center gap-2 p-3 bg-amber-50 border border-amber-200 rounded-lg mt-4">
            <Copy className="h-4 w-4 text-amber-600" />
            <div className="text-sm text-amber-800">
              You&apos;re creating a release based on a cloned configuration. All settings have been pre-populated from
              the original release.
            </div>
          </div>
        )}

        <StepIndicator steps={RELEASE_STEPS} currentStep={currentStep} />
      </div>

      <div className="space-y-6 mt-6">
        {currentStep === 1 && <ConfigurationStep />}
        {currentStep === 2 && <TargetingStep />}
        {currentStep === 3 && <RemoteConfigStep />}
        {currentStep === 4 && <PackageSelectionStep />}
        {currentStep === 5 && <FilePrioritiesStep />}
        {currentStep === 6 && <ResourcesStep />}
      </div>

      {/* Fixed Bottom Bar */}
      <div className="fixed bottom-0 left-64 right-0 bg-background border-t p-4 z-50">
        <div className="max-w-7xl mx-auto flex items-center justify-between px-6">
          <div className="flex gap-2">
            <Button variant="outline" asChild>
              <Link href={`/dashboard/${encodeURIComponent(org || "")}/${encodeURIComponent(app || "")}/releases`}>
                Cancel
              </Link>
            </Button>
            {currentStep > 1 && (
              <Button variant="outline" onClick={goToPreviousStep}>
                Previous
              </Button>
            )}
          </div>
          <div className="flex gap-2">
            {currentStep < totalSteps ? (
              <Button onClick={goToNextStep} disabled={!canProceedToStep(currentStep)}>
                Next Step
              </Button>
            ) : (
              <Button
                onClick={handleCreateClick}
                disabled={isSubmitting || (policyOn && !maker)}
                title={policyOn && !maker ? `You are not a maker for ${app}.` : undefined}
              >
                {getActionButtonText()}
              </Button>
            )}
          </div>
        </div>
      </div>

      {/* Spacer for fixed bottom bar */}
      <div className="h-20" />

      {isConfirmationDialogOpen && releaseConfig && (
        <ReleaseConfirmationDialog
          isOpen={isConfirmationDialogOpen}
          onClose={() => setIsConfirmationDialogOpen(false)}
          onConfirm={(reason, marker) => {
            handleSubmit(releaseConfig, reason, marker);
          }}
          releaseConfig={releaseConfig}
          selectedPackage={selectedPackage}
          org={org || ""}
          app={app || ""}
          mode={mode}
          isSubmitting={isSubmitting}
          asRequest={policyOn}
        />
      )}
    </div>
  );
}

interface ReleaseBuilderProps {
  mode: ReleaseMode;
  releaseId?: string;
  initialData?: ApiReleaseData;
}

export function ReleaseBuilder({ mode, releaseId, initialData }: ReleaseBuilderProps) {
  return (
    <ReleaseFormProvider mode={mode} releaseId={releaseId} initialData={initialData}>
      <ReleaseBuilderContent />
    </ReleaseFormProvider>
  );
}

export default ReleaseBuilder;
