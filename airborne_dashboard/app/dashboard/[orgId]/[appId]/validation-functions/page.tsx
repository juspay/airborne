"use client";

import { useState, useEffect, useCallback } from "react";
import { notFound } from "next/navigation";
import dynamic from "next/dynamic";
import { useTheme } from "next-themes";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { toastSuccess, toastError } from "@/hooks/use-toast";
import { Textarea } from "@/components/ui/textarea";
import { useAppContext } from "@/providers/app-context";
import { apiFetch, ErrorName } from "@/lib/api";
import { Play, Save, Info, AlertCircle, CheckCircle, Loader2 } from "lucide-react";
import { definePagePermissions, permission } from "@/lib/page-permissions";
import { usePagePermissions } from "@/hooks/use-page-permissions";
import useSWR from "swr";
import loader from "@monaco-editor/loader";
import * as monaco from "monaco-editor";

loader.config({ monaco });

const Editor = dynamic(() => import("@monaco-editor/react").then((mod) => mod.default), { ssr: false });

const DEFAULT_FUNCTION = `async function main(args) {
  return true;
}`;

const DEFAULT_TEST_ARGS = JSON.stringify(
  {
    payments: { version: "1.0.0", enabled: true },
    offers: { version: "2.1.0", enabled: false },
  },
  null,
  2
);

const PAGE_AUTHZ = definePagePermissions({
  read_validation_function: permission("validation_functions", "read", "app"),
  update_validation_function: permission("validation_functions", "update", "app"),
  test_validation_function: permission("validation_functions", "test", "app"),
});

interface ValidationFunctionApiResponse {
  function_code: string;
}

interface TestApiResponse {
  valid: boolean;
  result?: boolean;
  error?: string;
}

export default function ValidationFunctionsPage() {
  const { token, org, app } = useAppContext();
  const { resolvedTheme } = useTheme();
  const permissions = usePagePermissions(PAGE_AUTHZ);

  const [functionCode, setFunctionCode] = useState(DEFAULT_FUNCTION);
  const [testArgs, setTestArgs] = useState(DEFAULT_TEST_ARGS);
  const [isSaving, setIsSaving] = useState(false);
  const [isTesting, setIsTesting] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [testResult, setTestResult] = useState<TestApiResponse | null>(null);

  const canRead = permissions.can("read_validation_function");
  const canUpdate = permissions.can("update_validation_function");
  const canTest = permissions.can("test_validation_function");
  const editorTheme = resolvedTheme === "dark" ? "vs-dark" : "light";

  const { data, error, isLoading } = useSWR<ValidationFunctionApiResponse>(
    token && org && app && permissions.isReady && canRead
      ? ["/organisations/applications/validation-functions", org, app]
      : null,
    async () =>
      apiFetch<ValidationFunctionApiResponse>(
        "/organisations/applications/validation-functions",
        { method: "GET" },
        { token, org, app }
      )
  );

  useEffect(() => {
    if (data?.function_code) {
      setFunctionCode(data.function_code);
    }
  }, [data]);

  if (error && error.name === ErrorName.Forbidden) {
    notFound();
  }
  if (permissions.isReady && !canRead) {
    notFound();
  }

  const handleSave = useCallback(async () => {
    if (!token || !org || !app) return;
    setIsSaving(true);
    setSaveError(null);

    try {
      await apiFetch<ValidationFunctionApiResponse>(
        "/organisations/applications/validation-functions",
        {
          method: "PUT",
          body: { function_code: functionCode },
        },
        { token, org, app }
      );
      toastSuccess("Saved", "Validation function saved successfully.");
    } catch (err: any) {
      const msg = err.message || "Failed to save validation function";
      setSaveError(msg);
      toastError("Save failed", msg);
    } finally {
      setIsSaving(false);
    }
  }, [functionCode, token, org, app]);

  const handleTest = useCallback(async () => {
    if (!token || !org || !app) return;
    setIsTesting(true);
    setTestResult(null);

    try {
      let parsedArgs: unknown;
      try {
        parsedArgs = JSON.parse(testArgs);
      } catch {
        setTestResult({ valid: false, error: "Invalid JSON in test arguments" });
        setIsTesting(false);
        return;
      }

      const result = await apiFetch<TestApiResponse>(
        "/organisations/applications/validation-functions/test",
        {
          method: "POST",
          body: {
            function_code: functionCode,
            test_args: parsedArgs,
          },
        },
        { token, org, app }
      );
      setTestResult(result);
    } catch (err: any) {
      setTestResult({ valid: false, error: err.message || "Test execution failed" });
    } finally {
      setIsTesting(false);
    }
  }, [functionCode, testArgs, token, org, app]);

  if (isLoading || permissions.isLoading) {
    return (
      <div className="p-6">
        <div className="animate-pulse space-y-4">
          <div className="h-8 w-1/3 bg-muted rounded" />
          <div className="h-4 w-1/2 bg-muted rounded" />
          <div className="h-96 bg-muted rounded mt-6" />
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 max-w-7xl mx-auto">
      {/* Inject global style for Monaco shading. 
        Using hsl(var(--muted)) adapts smoothly between light/dark Next-Themes. 
      */}
      <style>{`
             .locked-line-decoration {
               background-color: ${
                 resolvedTheme === "dark" ? "rgba(255, 255, 255, 0.06)" : "rgba(15, 23, 42, 0.06)"
               } !important;
               border-left: 3px solid ${
                 resolvedTheme === "dark" ? "rgba(255, 255, 255, 0.18)" : "rgba(15, 23, 42, 0.18)"
               } !important;
               border-top: 1px solid ${
                 resolvedTheme === "dark" ? "rgba(255, 255, 255, 0.08)" : "rgba(15, 23, 42, 0.08)"
               } !important;
               border-bottom: 1px solid ${
                 resolvedTheme === "dark" ? "rgba(255, 255, 255, 0.08)" : "rgba(15, 23, 42, 0.08)"
               } !important;
               box-shadow: inset 0 0 0 1px ${
                 resolvedTheme === "dark" ? "rgba(255, 255, 255, 0.04)" : "rgba(15, 23, 42, 0.04)"
               } !important;
               opacity: 1;
             }
           `}</style>

      {/* Page Header */}
      <div className="mb-6">
        <h1 className="text-3xl font-bold font-[family-name:var(--font-space-grotesk)]">Validation Function</h1>
        <p className="text-muted-foreground mt-2">
          Define a custom JavaScript validation function that controls package group eligibility.
        </p>
      </div>

      {/* Editor */}
      <Card className="mb-4">
        <CardHeader className="pb-3">
          <CardTitle>Editor</CardTitle>
          <CardDescription>
            Write the function body using the provided <code>args</code> object and return a boolean.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="border rounded-md overflow-hidden">
            <Editor
              height="360px"
              language="javascript"
              value={functionCode}
              onChange={(value) => setFunctionCode(value || "")}
              theme={editorTheme}
              options={{
                minimap: { enabled: false },
                scrollBeyondLastLine: false,
                fontSize: 14,
                wordWrap: "on",
                automaticLayout: true,
                readOnly: !canUpdate,
              }}
              loading={
                <div className="h-[360px] flex items-center justify-center bg-muted">
                  <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                </div>
              }
            />
          </div>
        </CardContent>
      </Card>

      {/* Action Bar */}
      <div className="flex flex-wrap items-center gap-3 mb-4">
        {canUpdate && (
          <Button onClick={handleSave} disabled={isSaving} size="sm">
            {isSaving ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Save className="h-4 w-4 mr-2" />}
            {isSaving ? "Saving..." : "Save Function"}
          </Button>
        )}
        {canTest && (
          <Button onClick={handleTest} disabled={isTesting} variant="outline" size="sm">
            {isTesting ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Play className="h-4 w-4 mr-2" />}
            {isTesting ? "Running..." : "Run Test"}
          </Button>
        )}

        {saveError && <span className="text-sm text-destructive">{saveError}</span>}
      </div>

      {/* Test Args & Result */}
      {canTest && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
          <div>
            <label className="text-sm font-medium mb-1.5 block">Test Arguments (JSON)</label>
            <Textarea
              value={testArgs}
              onChange={(e) => setTestArgs(e.target.value)}
              rows={6}
              className="font-mono text-sm resize-y"
              placeholder='{"packageGroupName": { "version": "1.0.0", "enabled": true }}'
            />
          </div>
          <div>
            <label className="text-sm font-medium mb-1.5 block">Test Result</label>
            <div className="h-full min-h-[120px] border rounded-md p-3 bg-muted/30">
              {testResult ? (
                <div className="space-y-2">
                  <div className="flex items-center gap-2">
                    {testResult.valid ? (
                      <>
                        <CheckCircle className="h-4 w-4 text-green-600" />
                        <span className="text-sm font-medium text-green-700">Passed</span>
                      </>
                    ) : (
                      <>
                        <AlertCircle className="h-4 w-4 text-red-600" />
                        <span className="text-sm font-medium text-red-700">Failed</span>
                      </>
                    )}
                  </div>
                  <p className="text-sm text-muted-foreground">
                    {testResult.valid ? `Returned: ${testResult.result}` : testResult.error}
                  </p>
                </div>
              ) : (
                <p className="text-sm text-muted-foreground italic">Run a test to see results here</p>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Horizontal Documentation Strip */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-base">
            <Info className="h-4 w-4 text-primary" />
            API Reference & Examples
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 text-sm">
            <div>
              <h4 className="font-semibold mb-2">Function Signature</h4>
              <div className="bg-muted p-2 rounded-md">
                <code className="text-xs">async function main(args)</code>
              </div>
              <p className="text-muted-foreground text-xs mt-2 leading-relaxed">
                The entry point must be an <code>async</code> named <code>main</code>.
              </p>
            </div>

            {/* Input Structure */}
            <div>
              <h4 className="font-semibold mb-2">
                Input (<code>args</code>)
              </h4>
              <pre className="bg-muted p-2 rounded-md text-xs overflow-x-auto">
                {`{
  "package_group_name": <package_metadata>
}`}
              </pre>
            </div>

            {/* Input Example */}
            <div>
              <h4 className="font-semibold mb-2">Example Input</h4>
              <pre className="bg-muted p-2 rounded-md text-xs overflow-x-auto">
                {`{
  "icon": {
    "version": "1.0.0",
    "enabled": true,
    "platform": "ios"
  }
}`}
              </pre>
            </div>
          </div>

          {/* Constraints footer */}
          <div className="mt-4 pt-3 border-t text-xs text-muted-foreground flex flex-wrap gap-x-4 gap-y-1">
            <span>
              Use <code>args</code> as input
            </span>
            <span>Must return a boolean</span>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
