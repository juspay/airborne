"use client";

import { useEffect, useState, useCallback } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ArrowLeft, FileText, Rocket, ChevronRight, Check, File, Package2 } from "lucide-react";
import Link from "next/link";
import { apiFetch } from "@/lib/api";
import { useAppContext } from "@/providers/app-context";
import { useRouter } from "next/navigation";
import { toastWarning } from "@/hooks/use-toast";
import { hasAppAccess } from "@/lib/utils";
import { notFound } from "next/navigation";
import { FileChooser, SelectedFile } from "@/components/file-chooser";

export default function CreatePackagePage() {
  const { token, org, app, getAppAccess, getOrgAccess, loadingAccess } = useAppContext();
  const totalSteps = 2;
  const [currentStep, setCurrentStep] = useState(1);

  // Step 1: Package Details & Index File
  const [tag, setTag] = useState("");
  const [packageProperties] = useState("{}");
  const [selectedIndexFile, setSelectedIndexFile] = useState<SelectedFile | null>(null);

  // Step 2: Package Files
  const [selectedPackageFiles, setSelectedPackageFiles] = useState<SelectedFile[]>([]);

  const [isSubmitting, setIsSubmitting] = useState(false);
  const router = useRouter();

  useEffect(() => {
    if (!loadingAccess && !hasAppAccess(getOrgAccess(org), getAppAccess(org, app))) {
      notFound();
    }
  }, [loadingAccess, org, app, getOrgAccess, getAppAccess, hasAppAccess]);

  // File selection handlers
  const handleIndexFileChange = useCallback((files: SelectedFile[]) => {
    setSelectedIndexFile(files.length > 0 ? files[0] : null);
  }, []);

  const handlePackageFilesChange = useCallback((files: SelectedFile[]) => {
    setSelectedPackageFiles(files);
  }, []);

  const canProceedToStep = (step: number) => {
    switch (step) {
      case 1:
        return selectedIndexFile;
      case 2:
        return true;
      default:
        return false;
    }
  };

  async function onCreate(_submitAsDraft?: boolean) {
    setIsSubmitting(true);
    try {
      let properties: Record<string, any> = {};
      try {
        properties = packageProperties.trim() ? JSON.parse(packageProperties) : {};
      } catch {
        toastWarning("Invalid JSON", "Package properties must be valid JSON");
        setIsSubmitting(false);
        return;
      }

      // Convert SelectedFile[] to file_id strings
      const fileIds = selectedPackageFiles.map((f) => `${f.file_path}@version:${f.version}`);
      // Filter out the index file from the package files if it was selected
      const filteredFileIds = selectedIndexFile
        ? fileIds.filter((id) => !id.startsWith(`${selectedIndexFile.file_path}@`))
        : fileIds;
      const indexPath = selectedIndexFile ? `${selectedIndexFile.file_path}@version:${selectedIndexFile.version}` : "";

      await apiFetch(
        "/packages",
        {
          method: "POST",

          body: {
            index: indexPath,
            tag: tag || undefined,
            properties,
            files: filteredFileIds,
          },
        },
        { token, org, app }
      );
      router.push(`/dashboard/${encodeURIComponent(org || "")}/${encodeURIComponent(app || "")}/packages`);
    } catch (e: any) {
      console.log("Package creation failed", e);
      // Error toast will be shown automatically by apiFetch
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <div className="p-6">
      <div className="flex items-center gap-4 mb-8">
        <Button variant="ghost" size="sm" asChild>
          <Link href={`/dashboard/${encodeURIComponent(org || "")}/${encodeURIComponent(app || "")}/packages`}>
            <ArrowLeft className="h-4 w-4" />
          </Link>
        </Button>
        <div className="flex-1">
          <h1 className="text-3xl font-bold font-[family-name:var(--font-space-grotesk)] text-balance">
            Create Package Version
          </h1>
          <p className="text-muted-foreground mt-2">Bundle files together with properties and metadata</p>

          <div className="flex items-center gap-4 mt-6">
            {[
              { number: 1, title: "Package Details & Index File", icon: Package2 },
              { number: 2, title: "Select Package Files", icon: File },
            ].map((step, index) => {
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
                  {index < 1 && <ChevronRight className="h-4 w-4 text-muted-foreground mx-4" />}
                </div>
              );
            })}
          </div>
        </div>
      </div>

      <div className="space-y-6">
        {currentStep === 1 && (
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
                <CardDescription>Choose the main entry point file for your package</CardDescription>
              </CardHeader>
              <CardContent>
                <FileChooser
                  mode="single"
                  selected={selectedIndexFile ? [selectedIndexFile] : []}
                  onChange={handleIndexFileChange}
                />
                {selectedIndexFile && (
                  <div className="mt-4 p-3 bg-green-50 border border-green-200 rounded-lg">
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

        {currentStep === 2 && (
          <div className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle className="font-[family-name:var(--font-space-grotesk)]">Select Package Files</CardTitle>
                <CardDescription>Choose additional files to include in this package</CardDescription>
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

      {/* Fixed Bottom Bar */}
      <div className="fixed bottom-0 left-64 right-0 bg-background border-t p-4 z-50">
        <div className="max-w-7xl mx-auto flex items-center justify-between px-6">
          <div className="flex gap-2">
            <Button variant="outline" asChild>
              <Link href={`/dashboard/${encodeURIComponent(org || "")}/${encodeURIComponent(app || "")}/packages`}>
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
            {currentStep < totalSteps ? (
              <Button onClick={() => setCurrentStep((s) => s + 1)} disabled={!canProceedToStep(currentStep)}>
                Next Step
              </Button>
            ) : (
              <>
                <Button
                  onClick={() => onCreate()}
                  disabled={!canProceedToStep(1) || !canProceedToStep(2) || isSubmitting}
                  className="gap-2"
                >
                  <Rocket className="h-4 w-4" />
                  Create Package
                </Button>
              </>
            )}
          </div>
        </div>
      </div>

      {/* Spacer for fixed bottom bar */}
      <div className="h-20" />
    </div>
  );
}
