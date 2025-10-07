"use client";

import { useEffect, useState } from "react";
import useSWR from "swr";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Progress } from "@/components/ui/progress";
import {
  ArrowLeft,
  Users,
  Target,
  TrendingUp,
  Play,
  AlertTriangle,
  CheckCircle,
  Clock,
  FileText,
  Download,
  ExternalLink,
  Settings,
  RotateCw,
  Pencil,
  Copy,
} from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogTrigger,
} from "@/components/ui/dialog";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { apiFetch } from "@/lib/api";
import { useAppContext } from "@/providers/app-context";
import json from "highlight.js/lib/languages/json";
import hljs from "highlight.js";
import { toastWarning } from "@/hooks/use-toast";
import "highlight.js/styles/vs2015.css";
import Analytics from "@/components/analytics/Analytics";
import { Input } from "@/components/ui/input";
import { hasAppAccess } from "@/lib/utils";

hljs.registerLanguage("json", json);

type ISO8601 = string;

interface ChecksummedFile {
  file_path: string;
  url: string;
  checksum: string;
}

interface ReleaseConfig {
  boot_timeout: number;
  release_config_timeout: number;
  properties?: Record<string, any>;
}

interface ReleasePackage {
  version: number;
  index: ChecksummedFile;
  properties: Record<string, unknown>;
  important: ChecksummedFile[];
  lazy: ChecksummedFile[];
}

interface ReleaseExperiment {
  experiment_id: string;
  package_version: number;
  config_version: string;
  created_at: ISO8601;
  traffic_percentage: number;
  status: "CREATED" | "CONCLUDED" | "INPROGRESS" | (string & {});
}

type ServeReleaseConfig = Pick<ReleasePayload, "config" | "resources"> & {
  package: Pick<ReleasePayload["package"], "version" | "properties" | "index" | "important" | "lazy">;
};

export interface ReleasePayload {
  id: string;
  created_at: ISO8601;
  config: ReleaseConfig;
  package: ReleasePackage;
  resources: ChecksummedFile[];
  experiment: ReleaseExperiment;
  // If your dimensions can be richer, widen this union as needed
  dimensions: Record<string, string | number | boolean | null>;
}

function toServeReleaseConfig(payload: ReleasePayload): ServeReleaseConfig {
  const { config, resources, package: pkg } = payload;
  const { version, properties, index, important, lazy } = pkg;

  return {
    config,
    resources,
    package: { version, properties, index, important, lazy },
  };
}

export default function ReleaseDetailPage() {
  const router = useRouter();
  const params = useParams() as { releaseId: string; appId: string; orgId: string };
  const releaseId = params.releaseId;
  const appId = params.appId;
  const orgId = params.orgId;

  const { token, org, app, setOrg, setApp, getAppAccess, getOrgAccess, loadingAccess } = useAppContext();

  // Keep context in sync (avoids blank org/app in provider)
  useEffect(() => {
    if (org !== orgId) setOrg(orgId);
    if (app !== appId) setApp(appId);
  }, [orgId, appId, org, app, setOrg, setApp]);

  const canFetch = Boolean(token && releaseId && orgId && appId);

  const { data, isLoading, mutate } = useSWR(
    canFetch ? ["/releases", releaseId, token, orgId, appId] : null,
    ([, id, t, o, a]) => apiFetch<any>(`/releases/${encodeURIComponent(id)}`, {}, { token: t, org: o, app: a })
  );
  const release: ReleasePayload = data;

  console.log("Release", release);

  const [isRamping, setIsRamping] = useState(false);
  const [rampDialogOpen, setRampDialogOpen] = useState(false);
  const [trafficPct, setTrafficPct] = useState(release?.experiment?.traffic_percentage || 0);
  const [isConcluding, setIsConcluding] = useState(false);
  const [concludeDialogOpen, setConcludeDialogOpen] = useState(false);
  const [isReverting, setIsReverting] = useState(false);
  const [isRevertDialogOpen, setIsRevertDialogOpen] = useState(false);
  const [isCloning, setIsCloning] = useState(false);

  if (isLoading) return <div>Loading...</div>;

  const serveRC: ServeReleaseConfig = toServeReleaseConfig(data);

  const getStatusColor = (status: string) => {
    switch (status?.toLowerCase()) {
      case "concluded":
      case "deployed":
        return "bg-green-100 text-green-800";
      case "inprogress":
      case "rolling_out":
        return "bg-blue-100 text-blue-800";
      case "created":
      case "draft":
        return "bg-gray-100 text-gray-800";
      case "discarded":
      case "failed":
        return "bg-red-100 text-red-800";
      default:
        return "bg-gray-100 text-gray-800";
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status?.toLowerCase()) {
      case "concluded":
      case "deployed":
        return <CheckCircle className="h-4 w-4" />;
      case "inprogress":
      case "rolling_out":
        return <Play className="h-4 w-4" />;
      case "created":
      case "draft":
        return <Clock className="h-4 w-4" />;
      case "discarded":
      case "failed":
        return <AlertTriangle className="h-4 w-4" />;
      default:
        return <Clock className="h-4 w-4" />;
    }
  };

  const formatNumber = (num: number) => {
    if (num >= 1000000) return `${(num / 1000000).toFixed(1)}M`;
    if (num >= 1000) return `${(num / 1000).toFixed(1)}K`;
    return num.toString();
  };

  const handleRampRelease = async () => {
    const pct = Math.min(50, Math.max(0, Number(trafficPct)));
    if (pct > 50) {
      toastWarning("Invalid Traffic Percentage", "Traffic percentage cannot exceed 50%");
      return;
    }

    setIsRamping(true);
    try {
      await apiFetch(
        `/releases/${encodeURIComponent(releaseId)}/ramp`,
        { method: "POST", body: { traffic_percentage: pct } },
        { token, org, app }
      );
      mutate();
      setRampDialogOpen(false);
    } catch (error) {
      console.error("Failed to ramp release:", error);
    } finally {
      setIsRamping(false);
    }
  };

  const handleConcludeRelease = async () => {
    setIsConcluding(true);
    try {
      await apiFetch(
        `/releases/${encodeURIComponent(releaseId)}/conclude`,
        {
          method: "POST",
          body: { chosen_variant: `${releaseId}-experimental_${release.package.version}` },
        },
        { token, org, app }
      );
      mutate();
      setConcludeDialogOpen(false);
    } catch (error) {
      console.error("Failed to conclude release:", error);
    } finally {
      setIsConcluding(false);
    }
  };

  const revertRelease = async () => {
    try {
      await apiFetch(
        `/releases/${encodeURIComponent(releaseId)}/conclude`,
        {
          method: "POST",
          body: { chosen_variant: `${releaseId}-control` },
        },
        { token, org, app }
      );
      mutate();
      setIsRevertDialogOpen(false);
    } catch (err) {
      console.log(err);
    } finally {
      setIsReverting(false);
    }
  };

  const handleCloneRelease = () => {
    setIsCloning(true);

    // Navigate to create page with just the release ID and clone flag
    router.push(
      `/dashboard/${encodeURIComponent(orgId)}/${encodeURIComponent(appId)}/releases/create?clone=true&releaseId=${encodeURIComponent(releaseId)}`
    );

    // Reset loading state after a short delay (navigation happens asynchronously)
    setTimeout(() => setIsCloning(false), 1000);
  };

  const currentTrafficPercentage = release.experiment.traffic_percentage || 0;
  const targetPercentage = 50;
  const affectedUsers = 0;
  const totalDownloads = 0;
  const errorCount = 0;

  const highlightedCode = hljs.highlight(JSON.stringify(serveRC, null, 2), { language: "json" }).value;

  return (
    <div className="min-h-screen bg-background">
      <div className="flex">
        {/* Main Content */}
        <main className="flex-1 p-6">
          {/* Page Header */}
          <div className="flex items-center gap-4 mb-8">
            <Button variant="ghost" size="sm" asChild>
              <Link href={`/dashboard/${encodeURIComponent(orgId)}/${encodeURIComponent(appId)}/releases`}>
                <ArrowLeft className="h-4 w-4" />
              </Link>
            </Button>
            <div className="flex-1">
              <div className="flex items-center gap-3 mb-2">
                <h1 className="text-3xl font-bold font-[family-name:var(--font-space-grotesk)]">Release {releaseId}</h1>
                <div className="flex items-center gap-2">
                  {getStatusIcon(release.experiment.status || "")}
                  <Badge variant="secondary" className={getStatusColor(release.experiment.status || "")}>
                    {release.experiment.status || "Unknown"}
                  </Badge>
                </div>
              </div>
              <p className="text-muted-foreground">{`Package version ${release.package?.version || "N/A"}`}</p>
            </div>
            <div className="flex gap-2">
              {!loadingAccess && hasAppAccess(getOrgAccess(org), getAppAccess(org, app)) && (
                <>
                  {release.experiment.status === "CREATED" && (
                    <Button
                      variant="outline"
                      onClick={() =>
                        router.push(
                          `/dashboard/${encodeURIComponent(org ?? "")}/${encodeURIComponent(app ?? "")}/releases/${releaseId}/edit`
                        )
                      }
                      size="sm"
                    >
                      <Pencil className="h-4 w-4 mr-2" />
                      Edit
                    </Button>
                  )}

                  <Button variant="outline" onClick={handleCloneRelease} disabled={isCloning} size="sm">
                    <Copy className="h-4 w-4 mr-2" />
                    {isCloning ? "Cloning..." : "Clone Release"}
                  </Button>

                  {release.experiment.status !== "CONCLUDED" && (
                    <>
                      <Dialog open={rampDialogOpen} onOpenChange={setRampDialogOpen}>
                        <DialogTrigger asChild>
                          <Button variant="outline" disabled={isRamping}>
                            <TrendingUp className="h-4 w-4 mr-2" />
                            {isRamping ? "Ramping..." : "Ramp"}
                          </Button>
                        </DialogTrigger>
                        <DialogContent>
                          <DialogHeader>
                            <DialogTitle>Ramp Release</DialogTitle>
                            <DialogDescription>Enter new traffic percentage (0-50%):</DialogDescription>
                          </DialogHeader>
                          <Input
                            type="number"
                            value={trafficPct}
                            min={0}
                            max={50}
                            onChange={(e) => setTrafficPct(Number(e.target.value))}
                            className="mb-4"
                          />
                          <DialogFooter className="justify-end gap-2">
                            <Button variant="outline" onClick={() => setRampDialogOpen(false)}>
                              Cancel
                            </Button>
                            <Button variant="default" onClick={handleRampRelease} disabled={isRamping}>
                              {isRamping ? "Ramping..." : "Ramp"}
                            </Button>
                          </DialogFooter>
                        </DialogContent>
                      </Dialog>

                      <Dialog open={concludeDialogOpen} onOpenChange={setConcludeDialogOpen}>
                        <DialogTrigger asChild>
                          <Button disabled={isConcluding}>
                            <CheckCircle className="h-4 w-4 mr-2" />
                            {isConcluding ? "Concluding..." : "Conclude"}
                          </Button>
                        </DialogTrigger>
                        <DialogContent>
                          <DialogHeader>
                            <DialogTitle>Conclude Release</DialogTitle>
                            <DialogDescription>
                              Are you sure you want to conclude this release? This will roll out to 100% and finalize
                              the deployment.
                            </DialogDescription>
                          </DialogHeader>
                          <DialogFooter className="justify-end gap-2">
                            <Button variant="outline" onClick={() => setConcludeDialogOpen(false)}>
                              Cancel
                            </Button>
                            <Button variant="destructive" onClick={handleConcludeRelease} disabled={isConcluding}>
                              {isConcluding ? "Concluding..." : "Conclude"}
                            </Button>
                          </DialogFooter>
                        </DialogContent>
                      </Dialog>
                    </>
                  )}

                  {release.experiment.status === "INPROGRESS" && (
                    <Dialog open={isRevertDialogOpen} onOpenChange={setIsRevertDialogOpen}>
                      <DialogTrigger asChild>
                        <Button disabled={isReverting}>
                          <RotateCw className="h-4 w-4 mr-2" />
                          Revert Release
                        </Button>
                      </DialogTrigger>

                      {/* Dialog content */}
                      <DialogContent>
                        <DialogHeader>
                          <DialogTitle>Confirm Revert</DialogTitle>
                          <DialogDescription>
                            Are you sure you want to revert this release? This action cannot be undone.
                          </DialogDescription>
                        </DialogHeader>
                        <DialogFooter>
                          <Button variant="outline" onClick={() => setIsRevertDialogOpen(false)}>
                            Cancel
                          </Button>
                          <Button variant="destructive" onClick={revertRelease} disabled={isReverting}>
                            {isReverting ? "Reverting..." : "Revert Release"}
                          </Button>
                        </DialogFooter>
                      </DialogContent>
                    </Dialog>
                  )}
                </>
              )}
            </div>
          </div>

          <Tabs defaultValue="overview" className="space-y-6">
            <TabsList>
              <TabsTrigger value="overview">Overview</TabsTrigger>
              <TabsTrigger value="files">Files</TabsTrigger>
              <TabsTrigger value="dimensions">Targeting</TabsTrigger>
              <TabsTrigger value="analytics">Analytics</TabsTrigger>
            </TabsList>

            <TabsContent value="overview" className="space-y-6">
              {/* Stats Cards */}
              <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
                <Card>
                  <CardContent className="p-6">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-sm font-medium text-muted-foreground">Traffic %</p>
                        <p className="text-2xl font-bold">{currentTrafficPercentage}%</p>
                      </div>
                      <Target className="h-8 w-8 text-muted-foreground" />
                    </div>
                  </CardContent>
                </Card>

                <Card>
                  <CardContent className="p-6">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-sm font-medium text-muted-foreground">Affected Users</p>
                        <p className="text-2xl font-bold">{formatNumber(affectedUsers)}</p>
                      </div>
                      <Users className="h-8 w-8 text-muted-foreground" />
                    </div>
                  </CardContent>
                </Card>

                <Card>
                  <CardContent className="p-6">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-sm font-medium text-muted-foreground">Downloads</p>
                        <p className="text-2xl font-bold">{formatNumber(totalDownloads)}</p>
                      </div>
                      <Download className="h-8 w-8 text-muted-foreground" />
                    </div>
                  </CardContent>
                </Card>

                <Card>
                  <CardContent className="p-6">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-sm font-medium text-muted-foreground">Errors</p>
                        <p className="text-2xl font-bold">{errorCount}</p>
                      </div>
                      <AlertTriangle className="h-8 w-8 text-muted-foreground" />
                    </div>
                  </CardContent>
                </Card>
              </div>

              {/* Rollout Progress */}
              <Card>
                <CardHeader>
                  <CardTitle className="font-[family-name:var(--font-space-grotesk)]">Rollout Progress</CardTitle>
                  <CardDescription>
                    Max percentage you can choose for your release is capped to 50%, this is to balance traffic between
                    your A(Control) and B(Experiment) release. To make this release live for everyone, you can conclude
                    the release.
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium">Traffic Percentage</span>
                    <span className="text-sm text-muted-foreground">
                      {currentTrafficPercentage}% of {targetPercentage}%
                    </span>
                  </div>
                  <Progress value={currentTrafficPercentage * 2} className="w-full" />
                  <div className="grid grid-cols-3 gap-4 text-sm">
                    <div>
                      <p className="font-medium">Strategy</p>
                      <p className="text-muted-foreground">{"Linear"}</p>
                    </div>
                    <div>
                      <p className="font-medium">Created</p>
                      <p className="text-muted-foreground">
                        {release.created_at ? new Date(release.created_at).toLocaleDateString() : "—"}
                      </p>
                    </div>
                    {/* <div>
                        <p className="font-medium">Created By</p>
                        <p className="text-muted-foreground">{release.metadata?.created_by || "—"}</p>
                      </div> */}
                  </div>
                </CardContent>
              </Card>

              {/* Release Info */}
              <Card>
                <CardHeader>
                  <CardTitle className="font-[family-name:var(--font-space-grotesk)]">Release Information</CardTitle>
                  <CardDescription>Detailed information about this release</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid grid-cols-2 gap-6">
                    <div className="space-y-2">
                      <p className="text-sm font-medium">Release ID</p>
                      <p className="text-sm text-muted-foreground font-mono">{releaseId}</p>
                    </div>
                    <div className="space-y-2">
                      <p className="text-sm font-medium">Package Version</p>
                      <p className="text-sm text-muted-foreground">{release.package?.version || "—"}</p>
                    </div>
                  </div>
                  {/* {release.metadata?.notes && (
                      <div className="space-y-2">
                        <p className="text-sm font-medium">Release Notes</p>
                        <p className="text-sm text-muted-foreground">{release.metadata.notes}</p>
                      </div>
                    )} */}
                </CardContent>
              </Card>

              {/* Release Config */}
              <Card>
                <CardHeader>
                  <CardTitle className="font-[family-name:var(--font-space-grotesk)]">Release Config</CardTitle>
                  <CardDescription></CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="relative">
                    <Button
                      variant="ghost"
                      size="sm"
                      className="absolute right-4 top-4 bg-white mt-5"
                      onClick={() => navigator.clipboard.writeText(JSON.stringify(serveRC, null, 2))}
                    >
                      Copy
                    </Button>
                  </div>
                  <pre className="hljs whitespace-pre overflow-x-auto rounded-md p-4 text-sm">
                    <code className="language-json" dangerouslySetInnerHTML={{ __html: highlightedCode }} />
                  </pre>
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="files" className="space-y-6">
              {/* Package Files */}
              <Card>
                <CardHeader>
                  <CardTitle className="font-[family-name:var(--font-space-grotesk)]">Package Files</CardTitle>
                  <CardDescription>Files included in this release package</CardDescription>
                </CardHeader>
                <CardContent>
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Path</TableHead>
                        <TableHead>URL</TableHead>
                        <TableHead>Checksum</TableHead>
                        <TableHead>Priority</TableHead>
                        <TableHead>Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {[...release.package.important, ...release.package.lazy].map((file, index) => (
                        <TableRow key={index}>
                          <TableCell>
                            <div className="flex items-center gap-2">
                              <FileText className="h-4 w-4 text-muted-foreground" />
                              <span className="font-medium">{file.file_path}</span>
                            </div>
                          </TableCell>
                          <TableCell>
                            <Badge variant="outline">{file.url || "Unknown"}</Badge>
                          </TableCell>
                          <TableCell className="text-muted-foreground">{file.checksum}</TableCell>
                          <TableCell className="text-muted-foreground">
                            {release.package.important.findIndex((f) => f.file_path == file.file_path) == -1
                              ? "lazy"
                              : "important"}
                          </TableCell>
                          <TableCell>
                            {file.url && (
                              <Button variant="ghost" size="sm" asChild>
                                <a href={file.url} target="_blank" rel="noopener noreferrer">
                                  <ExternalLink className="h-4 w-4" />
                                </a>
                              </Button>
                            )}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </CardContent>
              </Card>

              {/* Resource Files */}
              <Card>
                <CardHeader>
                  <CardTitle className="font-[family-name:var(--font-space-grotesk)]">Resource Files</CardTitle>
                  <CardDescription>Files included in this release resources</CardDescription>
                </CardHeader>
                <CardContent>
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Path</TableHead>
                        <TableHead>URL</TableHead>
                        <TableHead>Checksum</TableHead>
                        <TableHead>Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {release.resources.map((file, index) => (
                        <TableRow key={index}>
                          <TableCell>
                            <div className="flex items-center gap-2">
                              <FileText className="h-4 w-4 text-muted-foreground" />
                              <span className="font-medium">{file.file_path}</span>
                            </div>
                          </TableCell>
                          <TableCell>
                            <Badge variant="outline">{file.url || "Unknown"}</Badge>
                          </TableCell>
                          <TableCell className="text-muted-foreground">{file.checksum}</TableCell>
                          <TableCell>
                            {file.url && (
                              <Button variant="ghost" size="sm" asChild>
                                <a href={file.url} target="_blank" rel="noopener noreferrer">
                                  <ExternalLink className="h-4 w-4" />
                                </a>
                              </Button>
                            )}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="dimensions" className="space-y-6">
              <Card>
                <CardHeader>
                  <CardTitle className="font-[family-name:var(--font-space-grotesk)]">Release Dimensions</CardTitle>
                  <CardDescription>Targeting and configuration parameters for this release</CardDescription>
                </CardHeader>
                <CardContent>
                  {release.dimensions ? (
                    <div className="space-y-4">
                      {Object.entries(release.dimensions).map(([key, value]) => (
                        <div key={key} className="flex items-center justify-between p-4 border rounded-lg">
                          <div>
                            <p className="font-medium">{key}</p>
                            <p className="text-sm text-muted-foreground">Dimension parameter</p>
                          </div>
                          <div className="text-right">
                            <p className="font-mono text-sm">{JSON.stringify(value)}</p>
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="text-center py-8">
                      <Settings className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                      <p className="text-muted-foreground">No dimensions configured for this release</p>
                    </div>
                  )}
                </CardContent>
              </Card>

              {/* Ramp Configuration */}
              <Card>
                <CardHeader>
                  <CardTitle className="font-[family-name:var(--font-space-grotesk)]">Ramp Configuration</CardTitle>
                  <CardDescription>Traffic ramping and rollout settings</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-2 gap-6">
                    <div className="space-y-2">
                      <p className="text-sm font-medium">Current Traffic</p>
                      <p className="text-2xl font-bold">{currentTrafficPercentage}%</p>
                    </div>
                    <div className="space-y-2">
                      <p className="text-sm font-medium">Target Traffic</p>
                      <p className="text-2xl font-bold">{targetPercentage}%</p>
                    </div>
                    <div className="space-y-2">
                      <p className="text-sm font-medium">Rollout Strategy</p>
                      <p className="text-sm text-muted-foreground">{"Linear"}</p>
                    </div>
                    <div className="space-y-2">
                      <p className="text-sm font-medium">Status</p>
                      <Badge variant="outline" className={getStatusColor(release.experiment.status || "")}>
                        {release.experiment.status || "Unknown"}
                      </Badge>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="analytics" className="space-y-6">
              <Analytics releaseId={releaseId} />
            </TabsContent>
          </Tabs>
        </main>
      </div>
    </div>
  );
}
