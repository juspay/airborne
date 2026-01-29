"use client";

import React, { useState } from "react";
import { Button } from "@/components/ui/button";
import { Settings, Target, Cog, FileText, Info, Copy } from "lucide-react";
import { PlugIcon as PkgIcon } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useAppContext } from "@/providers/app-context";
import { apiFetch } from "@/lib/api";

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

  const handleSubmit = async (config: ReleaseConfigRequest) => {
    setIsSubmitting(true);
    try {
      if (mode === "edit" && releaseId) {
        await apiFetch(
          `/releases/${encodeURIComponent(releaseId)}`,
          { method: "PUT", body: config },
          { token, org, app }
        );
      } else {
        await apiFetch("/releases", { method: "POST", body: config }, { token, org, app });
      }
      setIsConfirmationDialogOpen(false);
      router.push(`/dashboard/${encodeURIComponent(org || "")}/${encodeURIComponent(app || "")}/releases`);
    } catch (e: any) {
      console.error("Release operation failed", e);
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

      <div className="flex items-center justify-between mt-8 pt-6 border-t">
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
            <Button onClick={handleCreateClick} disabled={isSubmitting}>
              {getActionButtonText()}
            </Button>
          )}
        </div>
      </div>

      {isConfirmationDialogOpen && releaseConfig && (
        <ReleaseConfirmationDialog
          isOpen={isConfirmationDialogOpen}
          onClose={() => setIsConfirmationDialogOpen(false)}
          onConfirm={() => {
            handleSubmit(releaseConfig);
          }}
          releaseConfig={releaseConfig}
          selectedPackage={selectedPackage}
          org={org || ""}
          app={app || ""}
          mode={mode}
          isSubmitting={isSubmitting}
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
