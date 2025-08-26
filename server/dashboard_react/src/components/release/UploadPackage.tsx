import { useState } from "react";
import { Save, FileUp, X, Package, Copy, Check } from "lucide-react";
import { Application, Organisation } from "../../types";
import axios from "../../api/axios";

interface UploadPackageProps {
  application: Application;
  organization: Organisation;
  onClose: () => void;
  onSuccess: (packageVersion: number) => void;
}

export default function UploadPackage({
  application,
  organization,
  onClose,
  onSuccess,
}: UploadPackageProps) {
  const [jsonInput, setJsonInput] = useState("");
  const [isValidJson, setIsValidJson] = useState(false);
  const [errorMessage, setErrorMessage] = useState("Please enter JSON data");
  const [indexFile, setIndexFile] = useState<File | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [uploadError, setUploadError] = useState("");
  const [isCopied, setIsCopied] = useState(false);

  const handleJsonChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const value = e.target.value;
    setJsonInput(value);
    validateJson(value);
  };

  const validateJson = (value: string) => {
    try {
      if (!value) {
        setIsValidJson(false);
        setErrorMessage("Please enter JSON data");
        return false;
      }
      const parsed = JSON.parse(value);

      // Validate required package fields
      if (!parsed.package?.name || !parsed.package?.version) {
        setIsValidJson(false);
        setErrorMessage("Missing required package fields in JSON");
        return false;
      }

      setIsValidJson(true);
      setErrorMessage("");
      return true;
    } catch (error) {
      console.error(error);
      setIsValidJson(false);
      setErrorMessage("Invalid JSON format");
      return false;
    }
  };

  const handleSubmitPackage = async () => {
    if (!isValidJson || !jsonInput) return;

    try {
      setIsSubmitting(true);
      setUploadError("");

      // Parse and extract only the package part
      const packageData = JSON.parse(jsonInput);

      const headers = {
        "x-organisation": organization.name,
        "x-application": application.application,
      };

      let response;

      // Use JSON endpoint if no file is uploaded
      response = await axios.post(
        "/organisations/applications/package/create_package_json_v1",
        packageData,
        { headers }
      );

      response = await axios.post(
        "/organisations/applications/config/create_json_v1",
        packageData,
        { headers }
      );

      // Call onSuccess with the package version returned
      onSuccess(response.data.version);
    } catch (error: any) {
      console.error(error);
      setUploadError(
        error.response?.data?.message ||
          "Error uploading package. Please try again."
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleIndexFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (file.size > 50 * 1024 * 1024) {
        // 50MB limit
        setUploadError("Index file size should be less than 50MB");
        return;
      }
      setIndexFile(file);
      setUploadError("");
    }
  };

  const removeIndexFile = () => {
    setIndexFile(null);
    setUploadError("");
  };

  const handleCopyExample = async () => {
    const exampleJson = `{
  "version": "1",
  "config": {
    "version": "1.0.0",
    "release_config_timeout": 1000,
    "boot_timeout": 1000,
    "properties": {
      "tenant_info": {

      }
    }
  },
  "package": {
    "name": "Application_Name",
    "version": "1",
    "properties": {
    },
    "index": { 
     "url": "https://assets.juspay.in/bundles/index.js",
     "filePath": "index.js"
   },
    "important": [],
    "lazy": []
  },
  "resources": []
}`;

    try {
      await navigator.clipboard.writeText(exampleJson);
      setIsCopied(true);
      setTimeout(() => setIsCopied(false), 2000);
    } catch (err) {
      console.error('Failed to copy text: ', err);
    }
  };

  return (
    <div className="fixed inset-0 bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900 bg-opacity-95 backdrop-blur-sm overflow-y-auto h-full w-full z-50">
      <div className="relative top-4 mx-auto p-8 w-3/4 max-w-6xl">
        <div className="bg-white/10 backdrop-blur-xl rounded-2xl border border-white/20 shadow-2xl">
          {/* Header */}
          <div className="flex items-center justify-between mb-6 pb-6 border-b border-white/20 p-8">
            <div className="flex items-center space-x-4">
              <div className="w-12 h-12 bg-gradient-to-r from-cyan-400 to-blue-500 rounded-xl flex items-center justify-center">
                <Package size={24} className="text-white" />
              </div>
              <div>
                <h2 className="text-2xl font-bold text-white">
                  Upload Release Config
                </h2>
                <p className="text-white/70">
                  Step 1: Release Config for {application?.application}
                </p>
              </div>
              <span className="px-4 py-2 text-sm bg-gradient-to-r from-purple-400/20 to-pink-400/20 text-purple-200 rounded-full border border-purple-300/30">
                {organization.name}
              </span>
            </div>
            <div className="flex items-center space-x-4">
                <div className="relative">
                  <input
                    type="file"
                    id="index-upload"
                    onChange={handleIndexFileUpload}
                    className="hidden"
                  />
                  {indexFile ? (
                    <div className="flex items-center justify-between w-full px-4 py-3 text-sm bg-white/10 border border-white/20 rounded-xl text-white/90 hidden">
                      <span className="truncate">{indexFile.name}</span>
                      <button
                        onClick={removeIndexFile}
                        className="ml-2 text-white/60 hover:text-white/90 transition-colors duration-200"
                      >
                        <X size={16} />
                      </button>
                    </div>
                  ) : (
                    <label
                      htmlFor="index-upload"
                      className="inline-flex items-center w-full px-4 py-3 text-sm bg-white/10 border border-white/20 rounded-xl hover:bg-white/20 cursor-pointer transition-all duration-200 text-white/90 hidden"
                    >
                      <FileUp size={16} className="mr-2 text-cyan-400" />
                      Upload Index File (Optional)
                    </label>
                  )}
                </div>
                {uploadError && (
                  <p className="mt-2 text-sm text-red-400">{uploadError}</p>
                )}
              <button
                onClick={onClose}
                className="text-white/60 hover:text-white/90 transition-colors duration-200"
              >
                <span className="sr-only">Close</span>
                <X size={24} />
              </button>
            </div>
          </div>

          {/* Main Content */}
          <div className="px-8 pb-8 space-y-6">
            {/* JSON Editor */}
            <div className="bg-white/5 backdrop-blur-sm rounded-xl p-6 border border-white/10">
              <div className="flex items-center justify-between mb-4">
                <label className="block text-sm font-medium text-white/90">
                  Release Config JSON
                </label>
              </div>
              <div className="relative">
                <textarea
                  value={jsonInput}
                  onChange={handleJsonChange}
                  className={`w-full h-96 p-4 font-mono text-sm rounded-xl resize-none bg-black/30 text-white placeholder-white/50 border transition-all duration-200 ${
                    isValidJson
                      ? "border-white/20 focus:border-cyan-400/50 focus:ring-2 focus:ring-cyan-400/20"
                      : "border-red-400/50 focus:border-red-400 focus:ring-2 focus:ring-red-400/20"
                  }`}
                  placeholder='Enter package data, e.g. {"package": {"name": "my-app", "version": "1.0.0", ...}, "resources": {}}'
                />
                {errorMessage && (
                  <p className="mt-2 text-sm text-red-400">{errorMessage}</p>
                )}
              </div>
            </div>

            {/* Action Buttons */}
            <div className="flex justify-end space-x-4 pt-6 border-t border-white/20">
              <button
                onClick={onClose}
                className="px-6 py-3 text-sm font-medium text-white/90 bg-white/10 border border-white/20 rounded-xl hover:bg-white/20 transition-all duration-200"
                disabled={isSubmitting}
              >
                Cancel
              </button>
              <button
                onClick={handleSubmitPackage}
                disabled={!isValidJson || !jsonInput || isSubmitting}
                className={`inline-flex items-center px-6 py-3 text-sm font-medium rounded-xl transition-all duration-200 ${
                  isValidJson && jsonInput && !isSubmitting
                    ? "bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-600 hover:to-blue-700 text-white shadow-lg shadow-cyan-500/25"
                    : "bg-white/5 text-white/40 cursor-not-allowed border border-white/10"
                }`}
              >
                <Save size={16} className="mr-2" />
                {isSubmitting ? "Uploading..." : "Upload Release Config & Continue"}
              </button>
            </div>

            {/* JSON Example - Collapsible */}
            <div className="bg-white/5 backdrop-blur-sm rounded-xl border border-white/10">
              <details>
                <summary className="px-6 py-4 text-sm font-medium text-white/90 cursor-pointer hover:bg-white/10 transition-colors duration-200 rounded-xl">
                  Release Config Format Example
                </summary>
                <div className="px-6 pb-6">
                  <div className="relative">
                    <button
                      onClick={handleCopyExample}
                      className="absolute top-2 right-2 p-2 text-white/60 hover:text-white/90 bg-white/10 hover:bg-white/20 rounded-lg transition-all duration-200 z-10"
                      title={isCopied ? "Copied!" : "Copy example"}
                    >
                      {isCopied ? (
                        <Check size={16} className="text-green-400" />
                      ) : (
                        <Copy size={16} />
                      )}
                    </button>
                    <pre className="p-4 text-xs text-white/70 overflow-x-auto bg-black/30 rounded-lg border border-white/10">
                      {`{
                      "version": "1",
                      "config": {
                        "version": "1.0.0",
                        "release_config_timeout": 1000,
                        "boot_timeout": 1000,
                        "properties": {
                          "tenant_info": {

                          }
                        }
                      },
                      "package": {
                        "name": "Application_Name",
                        "version": "1",
                        "properties": {
                        },
                        "index": { 
                        "url": "https://assets.juspay.in/bundles/index.js",
                        "filePath": "index.js"
                      },
                        "important": [],
                        "lazy": []
                      },
                      "resources": []
                    }`}
                    </pre>
                  </div>
                </div>
              </details>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
