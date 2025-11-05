"use client";

import { useState, useEffect } from "react";
import useSWR from "swr";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Settings, Save, History, AlertCircle, Calendar, ChevronLeft, ChevronRight, EyeOff } from "lucide-react";
import { apiFetch } from "@/lib/api";
import { useAppContext } from "@/providers/app-context";
import { useToast } from "@/hooks/use-toast";
import { hasAppAccess } from "@/lib/utils";

interface ApplicationSettings {
  maven_namespace: string;
  maven_artifact_id: string;
  maven_group_id: string;
  created_at: string;
}

interface SettingsHistoryEntry {
  version: number;
  maven_namespace: string;
  maven_artifact_id: string;
  maven_group_id: string;
  created_at: string;
}

interface SettingsHistoryResponse {
  org_id: string;
  app_id: string;
  settings: SettingsHistoryEntry[];
  total: number;
  page: number;
  per_page: number;
  total_pages: number;
}

export default function SettingsPage() {
  const { token, org, app, getOrgAccess, getAppAccess, user } = useAppContext();
  const { toast } = useToast();

  // Form state
  const [formData, setFormData] = useState({
    maven_namespace: "",
    maven_artifact_id: "",
    maven_group_id: "",
  });

  // UI state
  const [isLoading, setIsLoading] = useState(false);
  const [activeTab, setActiveTab] = useState("current");

  // History pagination state
  const [currentPage, setCurrentPage] = useState(1);
  const [perPage] = useState(10);

  // Fetch current settings
  const {
    data: currentSettings,
    mutate: refetchSettings,
    isLoading: settingsLoading,
  } = useSWR<ApplicationSettings>(token && org && app ? ["/organisations/applications/settings", org, app] : null, () =>
    apiFetch<ApplicationSettings>("/organisations/applications/settings", {}, { token, org, app })
  );

  // Fetch history (only if super admin and history tab is active)
  const { data: historyData, isLoading: historyLoading } = useSWR<SettingsHistoryResponse>(
    user?.is_super_admin && activeTab === "history" && token && org && app
      ? ["/organisations/applications/settings/history", org, app, currentPage, perPage]
      : null,
    () =>
      apiFetch<SettingsHistoryResponse>(
        "/organisations/applications/settings/history",
        { method: "GET", query: { page: currentPage, per_page: perPage } },
        { token, org, app }
      )
  );

  // Update form when current settings load
  useEffect(() => {
    if (currentSettings) {
      setFormData({
        maven_namespace: currentSettings.maven_namespace,
        maven_artifact_id: currentSettings.maven_artifact_id,
        maven_group_id: currentSettings.maven_group_id,
      });
    }
  }, [currentSettings]);

  const handleInputChange = (field: keyof typeof formData) => (e: React.ChangeEvent<HTMLInputElement>) => {
    setFormData((prev) => ({ ...prev, [field]: e.target.value }));
  };

  const handleSave = async () => {
    if (!hasAppAccess(getOrgAccess(org), getAppAccess(org, app), "admin")) {
      toast({
        title: "Insufficient permissions",
        description: "You need admin access to update settings",
        variant: "destructive",
      });
      return;
    }

    setIsLoading(true);
    try {
      await apiFetch(
        "/organisations/applications/settings",
        {
          method: "POST",
          body: {
            maven_namespace: formData.maven_namespace || undefined,
            maven_artifact_id: formData.maven_artifact_id || undefined,
            maven_group_id: formData.maven_group_id || undefined,
          },
        },
        { token, org, app }
      );

      await refetchSettings();

      toast({
        title: "Settings updated",
        description: "Application settings have been successfully updated",
      });
    } catch (error) {
      console.error("Failed to update settings:", error);
      toast({
        title: "Update failed",
        description: "Failed to update application settings. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleString();
  };

  const hasChanges =
    currentSettings &&
    (formData.maven_namespace !== currentSettings.maven_namespace ||
      formData.maven_artifact_id !== currentSettings.maven_artifact_id ||
      formData.maven_group_id !== currentSettings.maven_group_id);

  const canEdit = hasAppAccess(getOrgAccess(org), getAppAccess(org, app), "admin");

  return (
    <div className="container mx-auto p-6 max-w-4xl">
      <div className="flex items-center gap-4 mb-8">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-primary/10 rounded-lg">
            <Settings className="h-6 w-6 text-primary" />
          </div>
          <div>
            <h1 className="text-3xl font-bold">Application Settings</h1>
            <p className="text-muted-foreground">Configure application-specific settings for {app}</p>
          </div>
        </div>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
        {user?.is_super_admin && (
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="current" className="flex items-center gap-2">
              <Settings className="h-4 w-4" />
              Current Settings
            </TabsTrigger>
            <TabsTrigger value="history" className="flex items-center gap-2">
              <History className="h-4 w-4" />
              Settings History
            </TabsTrigger>
          </TabsList>
        )}

        <TabsContent value="current">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Settings className="h-5 w-5" />
                Maven Configuration
              </CardTitle>
              <CardDescription>
                Configure Maven repository settings for this application. These settings are used for package
                distribution and dependency management.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              {settingsLoading ? (
                <div className="space-y-4">
                  <div className="h-4 bg-muted rounded animate-pulse" />
                  <div className="h-4 bg-muted rounded animate-pulse w-3/4" />
                  <div className="h-4 bg-muted rounded animate-pulse w-1/2" />
                </div>
              ) : (
                <>
                  <div className="grid gap-6">
                    <div className="grid gap-2">
                      <Label htmlFor="maven_namespace">Maven Namespace</Label>
                      <Input
                        id="maven_namespace"
                        value={formData.maven_namespace}
                        onChange={handleInputChange("maven_namespace")}
                        placeholder="com.example"
                        disabled={!canEdit}
                      />
                      <p className="text-sm text-muted-foreground">The Maven namespace for your application packages</p>
                    </div>

                    <div className="grid gap-2">
                      <Label htmlFor="maven_artifact_id">Maven Artifact ID</Label>
                      <Input
                        id="maven_artifact_id"
                        value={formData.maven_artifact_id}
                        onChange={handleInputChange("maven_artifact_id")}
                        placeholder="my-app"
                        disabled={!canEdit}
                      />
                      <p className="text-sm text-muted-foreground">
                        The unique identifier for your artifact within the group
                      </p>
                    </div>

                    <div className="grid gap-2">
                      <Label htmlFor="maven_group_id">Maven Group ID</Label>
                      <Input
                        id="maven_group_id"
                        value={formData.maven_group_id}
                        onChange={handleInputChange("maven_group_id")}
                        placeholder="com.example.apps"
                        disabled={!canEdit}
                      />
                      <p className="text-sm text-muted-foreground">
                        The group ID that identifies your organization or project
                      </p>
                    </div>
                  </div>

                  {currentSettings && (
                    <div className="pt-4 border-t">
                      <div className="flex items-center gap-2 text-sm text-muted-foreground">
                        <Calendar className="h-4 w-4" />
                        Last updated: {formatDate(currentSettings.created_at)}
                      </div>
                    </div>
                  )}

                  <div className="flex items-center gap-4 pt-4">
                    {canEdit ? (
                      <>
                        <Button
                          onClick={handleSave}
                          disabled={isLoading || !hasChanges}
                          className="flex items-center gap-2"
                        >
                          {isLoading ? (
                            <div className="h-4 w-4 animate-spin rounded-full border-2 border-current border-r-transparent" />
                          ) : (
                            <Save className="h-4 w-4" />
                          )}
                          {isLoading ? "Saving..." : "Save Changes"}
                        </Button>
                        {hasChanges && (
                          <div className="flex items-center gap-2 text-sm text-muted-foreground">
                            <AlertCircle className="h-4 w-4" />
                            You have unsaved changes
                          </div>
                        )}
                      </>
                    ) : (
                      <div className="flex items-center gap-2 text-sm text-muted-foreground">
                        <EyeOff className="h-4 w-4" />
                        View-only mode - Admin access required to edit settings
                      </div>
                    )}
                  </div>
                </>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {user?.is_super_admin && (
          <TabsContent value="history">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <History className="h-5 w-5" />
                  Settings History
                </CardTitle>
                <CardDescription>
                  View historical changes to application settings. Only available to super administrators.
                </CardDescription>
              </CardHeader>
              <CardContent>
                {historyLoading ? (
                  <div className="space-y-4">
                    <div className="h-4 bg-muted rounded animate-pulse" />
                    <div className="h-4 bg-muted rounded animate-pulse" />
                    <div className="h-4 bg-muted rounded animate-pulse" />
                  </div>
                ) : historyData?.settings?.length ? (
                  <>
                    <div className="rounded-md border">
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead>Version</TableHead>
                            <TableHead>Maven Namespace</TableHead>
                            <TableHead>Artifact ID</TableHead>
                            <TableHead>Group ID</TableHead>
                            <TableHead>Created At</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {historyData.settings.map((entry) => (
                            <TableRow key={entry.version}>
                              <TableCell>
                                <Badge variant="secondary">v{entry.version}</Badge>
                              </TableCell>
                              <TableCell className="font-mono text-sm">{entry.maven_namespace || "-"}</TableCell>
                              <TableCell className="font-mono text-sm">{entry.maven_artifact_id || "-"}</TableCell>
                              <TableCell className="font-mono text-sm">{entry.maven_group_id || "-"}</TableCell>
                              <TableCell className="text-muted-foreground">{formatDate(entry.created_at)}</TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </div>

                    {/* Pagination */}
                    {historyData.total_pages > 1 && (
                      <div className="flex items-center justify-between pt-4">
                        <div className="text-sm text-muted-foreground">
                          Showing {(currentPage - 1) * perPage + 1} to{" "}
                          {Math.min(currentPage * perPage, historyData.total)} of {historyData.total} entries
                        </div>
                        <div className="flex items-center gap-2">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => setCurrentPage((prev) => Math.max(1, prev - 1))}
                            disabled={currentPage === 1}
                          >
                            <ChevronLeft className="h-4 w-4" />
                            Previous
                          </Button>
                          <div className="flex items-center gap-1">
                            <span className="text-sm">
                              Page {currentPage} of {historyData.total_pages}
                            </span>
                          </div>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => setCurrentPage((prev) => Math.min(historyData.total_pages, prev + 1))}
                            disabled={currentPage === historyData.total_pages}
                          >
                            Next
                            <ChevronRight className="h-4 w-4" />
                          </Button>
                        </div>
                      </div>
                    )}
                  </>
                ) : (
                  <div className="text-center py-8 text-muted-foreground">
                    <History className="h-8 w-8 mx-auto mb-2 opacity-50" />
                    <p>No settings history available</p>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        )}
      </Tabs>
    </div>
  );
}
