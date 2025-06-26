import { useState } from "react";
import { Application, Organisation } from "../../types";
import UploadPackage from "./UploadPackage";
import CreateRelease from "./CreateRelease";
import { CheckCircle } from "lucide-react";

interface ReleaseWorkflowProps {
  application: Application;
  organization: Organisation;
  onClose: () => void;
  onComplete: (releaseInfo: any) => void;
}

type WorkflowStep = "package" | "release";

export default function ReleaseWorkflow({
  application,
  organization,
  onClose,
  onComplete,
}: ReleaseWorkflowProps) {
  const [currentStep, setCurrentStep] = useState<WorkflowStep>("package");
  const [packageVersion, setPackageVersion] = useState<number | null>(null);

  // Handle the completion of package upload
  const handlePackageUploaded = (version: number) => {
    setPackageVersion(version);
    setCurrentStep("release");
  };

  // Handle release creation
  const handleReleaseCreated = (releaseInfo: any) => {
    onComplete(releaseInfo);
  };

  return (
    <div>
      {/* Stepper UI */}
      <div className="fixed top-0 left-0 right-0 z-50 bg-white border-b border-gray-200 shadow-sm">
        <div className="container mx-auto px-4 py-3">
          <div className="flex items-center justify-center">
            <div className="flex items-center">
              <div
                className={`flex items-center ${
                  currentStep === "package"
                    ? "text-purple-600 font-medium"
                    : "text-gray-500"
                }`}
              >
                <span
                  className={`flex items-center justify-center w-8 h-8 rounded-full mr-2 ${
                    currentStep === "package"
                      ? "bg-purple-100 text-purple-600"
                      : packageVersion
                      ? "bg-green-100 text-green-500"
                      : "bg-gray-100"
                  }`}
                >
                  {packageVersion ? <CheckCircle size={16} /> : "1"}
                </span>
                <span>Upload Package</span>
              </div>

              <div className="mx-4 h-0.5 w-10 bg-gray-200"></div>

              <div
                className={`flex items-center ${
                  currentStep === "release"
                    ? "text-purple-600 font-medium"
                    : "text-gray-500"
                }`}
              >
                <span
                  className={`flex items-center justify-center w-8 h-8 rounded-full mr-2 ${
                    currentStep === "release"
                      ? "bg-purple-100 text-purple-600"
                      : "bg-gray-100"
                  }`}
                >
                  2
                </span>
                <span>Create Release</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Component for current step */}
      <div className="pt-16">
        {currentStep === "package" && (
          <UploadPackage
            application={application}
            organization={organization}
            onClose={onClose}
            onSuccess={handlePackageUploaded}
          />
        )}

        {currentStep === "release" &&
          packageVersion !== null && (
            <CreateRelease
              application={application}
              organization={organization}
              versionInfo={{
                packageVersion,
              }}
              onClose={onClose}
              onBack={() => setCurrentStep("package")}
              onSuccess={handleReleaseCreated}
            />
          )}
      </div>
    </div>
  );
}
