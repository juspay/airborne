"use client";

import { useEffect, useState, useCallback } from "react";
import useSWR from "swr";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { ArrowLeft, FileText, Rocket, ChevronRight, Check, File, Package2, Crown, Info } from "lucide-react";
import Link from "next/link";
import { apiFetch } from "@/lib/api";
import { useAppContext } from "@/providers/app-context";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import { toastWarning } from "@/hooks/use-toast";
import { hasAppAccess } from "@/lib/utils";
import { notFound } from "next/navigation";
import { FileChooser, SelectedFile } from "@/components/file-chooser";

type PackageGroup = {
  id: string;
  name: string;
  is_primary: boolean;
};

export default function CreatePackagePage() {
  const { token, org, app, getAppAccess, getOrgAccess, loadingAccess } = useAppContext();
  const params = useParams<{ appId: string }>();
  const searchParams = useSearchParams();
  const appId = typeof params.appId === "string" ? params.appId : Array.isArray(params.appId) ? params.appId[0] : "";

  const groupIdFromUrl = searchParams.get("groupId");
  const isPrimaryFromUrl = searchParams.get("isPrimary") === "true";

  const [currentStep, setCurrentStep] = useState(1);

  const [selectedGroup, setSelectedGroup] = useState<PackageGroup | null>(null);

  const [tag, setTag] = useState("");
  const [selectedIndexFile, setSelectedIndexFile] = useState<SelectedFile | null>(null);

  const [selectedPackageFiles, setSelectedPackageFiles] = useState<SelectedFile[]>([]);

  const [isSubmitting, setIsSubmitting] = useState(false);
  const router = useRouter();

  useEffect(() => {
    if (!loadingAccess && !hasAppAccess(getOrgAccess(org), getAppAccess(org, app))) {
      notFound();
    }
  }, [loadingAccess, org, app, getOrgAccess, getAppAccess]);

  const { data: groupData, error: groupError } = useSWR(
    token && org && appId && groupIdFromUrl ? [`/package-groups/${groupIdFromUrl}`, appId] : null,
    async () =>
      apiFetch<PackageGroup>(`/package-groups/${groupIdFromUrl}`, { method: "GET" }, { token, org, app: appId })
  );

  useEffect(() => {
    if (groupError) {
      notFound();
    }
  }, [groupError]);

  useEffect(() => {
    if (groupData) {
      setSelectedGroup(groupData);
    }
  }, [groupData]);

  useEffect(() => {
    if (!groupIdFromUrl) {
      notFound();
    }
  }, [groupIdFromUrl]);

  const isPrimary = selectedGroup?.is_primary ?? isPrimaryFromUrl;
  const effectiveTotalSteps = isPrimary ? 2 : 1;

  const handleIndexFileChange = useCallback((files: SelectedFile[]) => {
    setSelectedIndexFile(files.length > 0 ? files[0] : null);
  }, []);

  const handlePackageFilesChange = useCallback((files: SelectedFile[]) => {
    setSelectedPackageFiles(files);
  }, []);

  const canProceedToStep = (step: number) => {
    if (isPrimary) {
      switch (step) {
        case 1:
          return selectedIndexFile;
        case 2:
          return true;
        default:
          return false;
      }
    } else {
      return true;
    }
  };

  async function onCreate() {
    if (!selectedGroup) {
      toastWarning("No Group Selected", "Please select a package group");
      return;
    }

    setIsSubmitting(true);
    try {
      const fileIds = selectedPackageFiles.map((f) => `${f.file_path}@version:${f.version}`);
      const filteredFileIds = selectedIndexFile
        ? fileIds.filter((id) => !id.startsWith(`${selectedIndexFile.file_path}@`))
        : fileIds;

      const indexPath =
        isPrimary && selectedIndexFile
          ? `${selectedIndexFile.file_path}@version:${selectedIndexFile.version}`
          : undefined;

      await apiFetch(
        `/package-groups/${selectedGroup.id}/packages`,
        {
          method: "POST",
          body: {
            ...(indexPath ? { index: indexPath } : {}),
            tag: tag || undefined,
            files: filteredFileIds,
          },
        },
        { token, org, app: appId }
      );
      router.push(`/dashboard/${encodeURIComponent(org || "")}/${encodeURIComponent(appId)}/packages`);
    } catch (e: any) {
      console.log("Package creation failed", e);
    } finally {
      setIsSubmitting(false);
    }
  }

  const steps = isPrimary
    ? [
        { number: 1, title: "Package Details & Index File", icon: Package2 },
        { number: 2, title: "Select Package Files", icon: File },
      ]
    : [{ number: 1, title: "Package Details & Files", icon: File }];

  return (
    <div className="p-6">
      <div className="flex items-center gap-4 mb-8">
        <Button variant="ghost" size="sm" asChild>
          <Link href={`/dashboard/${encodeURIComponent(org || "")}/${encodeURIComponent(appId)}/packages`}>
            <ArrowLeft className="h-4 w-4" />
          </Link>
        </Button>
        <div className="flex-1">
          <h1 className="text-3xl font-bold font-[family-name:var(--font-space-grotesk)] text-balance">
            Create Package
          </h1>
          <p className="text-muted-foreground mt-2">
            Creating package in <span className="font-medium">{selectedGroup?.name || "..."}</span>
            {isPrimary && (
              <Badge variant="outline" className="ml-2 gap-1">
                <Crown className="h-3 w-3" />
                Primary Group
              </Badge>
            )}
          </p>

          <div className="flex items-center gap-4 mt-6">
            {steps.map((step, index) => {
              const status =
                step.number < currentStep ? "completed" : step.number === currentStep ? "current" : "upcoming";
              const Icon = step.icon;
              return (
                <div key={step.number} className="flex items-center">
                  <div className="flex items-center gap-3">
                    <div
                      className={`
                          flex items-center justify-center w-10 h-10 rounded-full border-2 transition-colors
                          ${status === "completed" ? "bg-primary border-primary text-primary-foreground" : status === "current" ? "border-primary text-primary bg-primary/10" : "border-muted-foreground/30 text-muted-foreground"}
                        `}
                    >
                      {status === "completed" ? <Check className="h-5 w-5" /> : <Icon className="h-5 w-5" />}
                    </div>
                    <div className="hidden sm:block">
                      <div
                        className={`font-medium text-sm ${status !== "upcoming" ? "text-foreground" : "text-muted-foreground"}`}
                      >
                        {step.title}
                      </div>
                      <div className="text-xs text-muted-foreground">Step {step.number}</div>
                    </div>
                  </div>
                  {index < steps.length - 1 && <ChevronRight className="h-4 w-4 text-muted-foreground mx-4" />}
                </div>
              );
            })}
          </div>
        </div>
      </div>

      <div className="space-y-6">
        {isPrimary && currentStep === 1 && (
          <div className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle className="font-[family-name:var(--font-space-grotesk)]">Package Details</CardTitle>
                <CardDescription>Basic information about your package</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="tag">Tag</Label>
                  <Input
                    id="tag"
                    placeholder="e.g., latest, v1.0, production"
                    value={tag}
                    onChange={(e) => setTag(e.target.value)}
                  />
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="font-[family-name:var(--font-space-grotesk)]">Select Index File</CardTitle>
                <CardDescription>
                  Choose the main entry point file for your package.
                  <Alert className="mt-3">
                    <Info className="h-4 w-4" />
                    <AlertDescription>
                      Index file is <strong>required</strong> for primary package groups. This serves as the main entry
                      point for OTA updates.
                    </AlertDescription>
                  </Alert>
                </CardDescription>
              </CardHeader>
              <CardContent>
                <FileChooser
                  mode="single"
                  selected={selectedIndexFile ? [selectedIndexFile] : []}
                  onChange={handleIndexFileChange}
                />
                {selectedIndexFile && (
                  <div className="mt-4 p-3 bg-green-50 dark:bg-green-950 border border-green-200 dark:border-green-800 rounded-lg">
                    <div className="flex items-center gap-2">
                      <FileText className="h-4 w-4 text-green-600" />
                      <span className="font-mono text-sm">{selectedIndexFile.file_path}</span>
                      <span className="text-muted-foreground text-xs">(v{selectedIndexFile.version})</span>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        )}

        {((!isPrimary && currentStep === 1) || (isPrimary && currentStep === 2)) && (
          <div className="space-y-6">
            {!isPrimary && (
              <Card>
                <CardHeader>
                  <CardTitle className="font-[family-name:var(--font-space-grotesk)]">Package Details</CardTitle>
                  <CardDescription>Basic information about your package</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="tag">Tag</Label>
                    <Input
                      id="tag"
                      placeholder="e.g., latest, v1.0, production"
                      value={tag}
                      onChange={(e) => setTag(e.target.value)}
                    />
                  </div>
                  <Alert>
                    <Info className="h-4 w-4" />
                    <AlertDescription>
                      This is a <strong>secondary package group</strong>. Index file is not required and cannot be
                      specified.
                    </AlertDescription>
                  </Alert>
                </CardContent>
              </Card>
            )}

            <Card>
              <CardHeader>
                <CardTitle className="font-[family-name:var(--font-space-grotesk)]">Select Package Files</CardTitle>
                <CardDescription>Choose files to include in this package</CardDescription>
              </CardHeader>
              <CardContent>
                <FileChooser
                  mode="multi"
                  selected={selectedPackageFiles}
                  onChange={handlePackageFilesChange}
                  excludeFiles={selectedIndexFile ? [selectedIndexFile.file_path] : []}
                />
              </CardContent>
            </Card>
          </div>
        )}
      </div>

      <div className="fixed bottom-0 left-64 right-0 bg-background border-t p-4 z-50">
        <div className="max-w-7xl mx-auto flex items-center justify-between px-6">
          <div className="flex gap-2">
            <Button variant="outline" asChild>
              <Link href={`/dashboard/${encodeURIComponent(org || "")}/${encodeURIComponent(appId)}/packages`}>
                Cancel
              </Link>
            </Button>
            {currentStep > 1 && (
              <Button variant="outline" onClick={() => setCurrentStep((s) => s - 1)}>
                Previous
              </Button>
            )}
          </div>
          <div className="flex gap-2">
            {currentStep < effectiveTotalSteps ? (
              <Button onClick={() => setCurrentStep((s) => s + 1)} disabled={!canProceedToStep(currentStep)}>
                Next Step
              </Button>
            ) : (
              <Button
                onClick={() => onCreate()}
                disabled={isPrimary ? !selectedIndexFile || isSubmitting : isSubmitting}
                className="gap-2"
              >
                <Rocket className="h-4 w-4" />
                Create Package
              </Button>
            )}
          </div>
        </div>
      </div>

      <div className="h-20" />
    </div>
  );
}
