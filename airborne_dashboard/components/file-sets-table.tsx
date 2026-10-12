"use client";

import { useState } from "react";
import useSWR, { useSWRConfig } from "swr";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ChevronDown, ChevronRight, FolderPlus, Layers, Loader2, Plus, Search } from "lucide-react";
import { FileChooser, type SelectedFile } from "@/components/file-chooser";
import { useAppContext } from "@/providers/app-context";
import { apiFetch } from "@/lib/api";
import { toastSuccess } from "@/hooks/use-toast";
import { definePagePermissions, permission } from "@/lib/page-permissions";
import { usePagePermissions } from "@/hooks/use-page-permissions";
import type { FileSet, FileSetsResponse, FileSetDetail, FileSetVersion } from "@/types/files";

const GROUP_AUTHZ = definePagePermissions({
  read_file_set: permission("file_set", "read", "app"),
  create_file_set: permission("file_set", "create", "app"),
});

function selectedFileToKey(file: SelectedFile): string {
  return `${file.file_path}@version:${file.version}`;
}

function formatFileSize(bytes: number) {
  if (bytes === 0) return "0 B";
  const k = 1024;
  const sizes = ["B", "KB", "MB", "GB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + " " + sizes[i];
}

function versionFilesToSelected(version?: FileSetVersion | null): SelectedFile[] {
  return (version?.files || []).map((f) => ({
    file_path: f.file_path,
    version: f.version,
    url: f.url,
    tag: f.tag || undefined,
  }));
}

export function FileSetsTable() {
  const { token, org, app } = useAppContext();
  const permissions = usePagePermissions(GROUP_AUTHZ);
  const canRead = permissions.can("read_file_set");
  const canCreate = permissions.can("create_file_set");

  const { mutate } = useSWRConfig();
  const [expandedGroup, setExpandedGroup] = useState<string | null>(null);
  const [expandedVersion, setExpandedVersion] = useState<number | null>(null);
  const [groupSearch, setGroupSearch] = useState("");
  const [fileSearch, setFileSearch] = useState("");

  // Create-set / new-version dialog (shared: pick files + metadata)
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [versionTarget, setVersionTarget] = useState<FileSet | null>(null); // null = creating a set
  const [groupName, setGroupName] = useState("");
  const [groupFiles, setGroupFiles] = useState<SelectedFile[]>([]);
  const [metadataText, setMetadataText] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [dialogError, setDialogError] = useState<string | null>(null);

  const {
    data,
    isLoading,
    mutate: mutateGroups,
  } = useSWR(
    token && org && app && canRead ? ["/file-sets", app] : null,
    async () =>
      apiFetch<FileSetsResponse>("/file-sets", { method: "GET", query: { page: 1, count: 100 } }, { token, org, app }),
    { revalidateOnFocus: false }
  );

  const allGroups = data?.data || [];
  const groups = groupSearch.trim()
    ? allGroups.filter((g) => g.name.toLowerCase().includes(groupSearch.trim().toLowerCase()))
    : allGroups;

  // Version history of the expanded set
  const { data: expandedDetail, isLoading: isLoadingDetail } = useSWR(
    token && org && app && expandedGroup ? ["/file-sets/detail", expandedGroup] : null,
    async () =>
      apiFetch<FileSetDetail>(
        `/file-sets/${encodeURIComponent(expandedGroup!)}`,
        { method: "GET" },
        { token, org, app }
      ),
    { revalidateOnFocus: false }
  );

  if (!canRead) return null;

  const openCreate = () => {
    setVersionTarget(null);
    setGroupName("");
    setGroupFiles([]);
    setMetadataText("");
    setDialogError(null);
    setIsDialogOpen(true);
  };

  const openNewVersion = (group: FileSet) => {
    setVersionTarget(group);
    setGroupName(group.name);
    setGroupFiles(versionFilesToSelected(group.latest));
    setMetadataText("");
    setDialogError(null);
    setIsDialogOpen(true);
  };

  const handleSubmit = async () => {
    if (!token || !org || !app) return;

    let metadata: Record<string, unknown> | undefined = undefined;
    if (metadataText.trim()) {
      try {
        metadata = JSON.parse(metadataText);
      } catch {
        setDialogError("Metadata must be valid JSON");
        return;
      }
    }

    setIsSubmitting(true);
    setDialogError(null);
    const files = groupFiles.map(selectedFileToKey);
    try {
      if (versionTarget) {
        await apiFetch(
          `/file-sets/${encodeURIComponent(versionTarget.name)}/versions`,
          { method: "POST", body: { files, ...(metadata ? { metadata } : {}) } },
          { token, org, app }
        );
        toastSuccess(`Created a new version of "${versionTarget.name}"`);
      } else {
        await apiFetch(
          "/file-sets",
          { method: "POST", body: { name: groupName.trim(), files, ...(metadata ? { metadata } : {}) } },
          { token, org, app }
        );
        toastSuccess("File set created");
      }
      setIsDialogOpen(false);
      mutateGroups();
      // The version history is cached separately; refresh it so an expanded
      // set shows the new version without collapsing and expanding again.
      if (versionTarget) mutate(["/file-sets/detail", versionTarget.name]);
    } catch (error) {
      setDialogError(error instanceof Error ? error.message : "Request failed");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Card className="mt-6">
      <CardHeader className="flex flex-row items-start justify-between space-y-0">
        <div>
          <CardTitle className="font-[family-name:var(--font-space-grotesk)]">
            File Sets ({isLoading ? "..." : groups.length})
          </CardTitle>
          <CardDescription>
            Versioned collections of files you can select together in packages and releases
          </CardDescription>
        </div>
        {canCreate && (
          <Button className="gap-2" onClick={openCreate}>
            <Plus className="h-4 w-4" />
            Create File Set
          </Button>
        )}
      </CardHeader>
      <CardContent>
        {allGroups.length > 0 && (
          <div className="relative max-w-sm mb-4">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search file sets..."
              value={groupSearch}
              onChange={(e) => setGroupSearch(e.target.value)}
              className="pl-10 h-9"
            />
          </div>
        )}
        {isLoading ? (
          <div className="flex items-center justify-center py-12">
            <div className="flex items-center gap-3">
              <Loader2 className="h-6 w-6 animate-spin text-primary" />
              <span className="text-muted-foreground">Loading file sets...</span>
            </div>
          </div>
        ) : groups.length === 0 && groupSearch.trim() ? (
          <div className="flex flex-col items-center justify-center py-12 text-center">
            <Search className="h-12 w-12 text-muted-foreground mb-4" />
            <h3 className="text-lg font-semibold mb-2">No file sets match &quot;{groupSearch.trim()}&quot;</h3>
          </div>
        ) : groups.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12 text-center">
            <FolderPlus className="h-12 w-12 text-muted-foreground mb-4" />
            <h3 className="text-lg font-semibold mb-2">No file sets yet</h3>
            <p className="text-muted-foreground mb-4">
              Collect related files so you can add them all at once when building a package or release.
            </p>
            {canCreate && (
              <Button className="gap-2" onClick={openCreate}>
                <Plus className="h-4 w-4" />
                Create your first file set
              </Button>
            )}
          </div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-10"></TableHead>
                <TableHead>Name</TableHead>
                <TableHead>Latest</TableHead>
                <TableHead>Files</TableHead>
                <TableHead>Versions</TableHead>
                <TableHead>Updated</TableHead>
                <TableHead className="w-32">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {groups.map((group) => {
                const isExpanded = expandedGroup === group.name;
                return [
                  <TableRow
                    key={group.name}
                    className="cursor-pointer hover:bg-muted"
                    onClick={() => {
                      setExpandedGroup(isExpanded ? null : group.name);
                      setExpandedVersion(null);
                    }}
                  >
                    <TableCell>
                      {isExpanded ? (
                        <ChevronDown className="h-4 w-4 text-muted-foreground" />
                      ) : (
                        <ChevronRight className="h-4 w-4 text-muted-foreground" />
                      )}
                    </TableCell>
                    <TableCell className="font-medium">{group.name}</TableCell>
                    <TableCell>
                      {group.latest ? (
                        <Badge variant="secondary" className="text-[10px]">
                          v{group.latest.version}
                        </Badge>
                      ) : (
                        <span className="text-muted-foreground">—</span>
                      )}
                    </TableCell>
                    <TableCell className="text-muted-foreground text-xs">{group.latest?.files.length ?? 0}</TableCell>
                    <TableCell className="text-muted-foreground text-xs">{group.total_versions}</TableCell>
                    <TableCell className="text-muted-foreground text-xs">
                      {new Date(group.updated_at).toLocaleDateString(undefined, {
                        month: "short",
                        day: "numeric",
                        year: "numeric",
                      })}
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-1">
                        {canCreate && (
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-7 px-2"
                            title="New version"
                            onClick={(e) => {
                              e.stopPropagation();
                              openNewVersion(group);
                            }}
                          >
                            <Layers className="h-3.5 w-3.5" />
                          </Button>
                        )}
                      </div>
                    </TableCell>
                  </TableRow>,
                  isExpanded && (
                    <TableRow key={`${group.name}-expanded`} className="bg-muted/30">
                      <TableCell colSpan={7} className="p-0">
                        <div className="py-2">
                          {isLoadingDetail ? (
                            <div className="flex items-center gap-2 text-sm text-muted-foreground pl-10 py-3">
                              <Loader2 className="h-4 w-4 animate-spin" />
                              Loading versions...
                            </div>
                          ) : (
                            <Table>
                              <TableHeader>
                                <TableRow className="bg-muted/50 hover:bg-muted/50">
                                  <TableHead className="pl-10 w-28">Version</TableHead>
                                  <TableHead>Files</TableHead>
                                  <TableHead>Metadata</TableHead>
                                  <TableHead>Created</TableHead>
                                </TableRow>
                              </TableHeader>
                              <TableBody>
                                {(expandedDetail?.versions || []).map((v) => {
                                  const isVersionOpen = expandedVersion === v.version;
                                  const hasMetadata = Object.keys(v.metadata || {}).length > 0;
                                  return [
                                    <TableRow
                                      key={v.version}
                                      className="hover:bg-muted/50 cursor-pointer"
                                      onClick={() => {
                                        setExpandedVersion(isVersionOpen ? null : v.version);
                                        setFileSearch("");
                                      }}
                                    >
                                      <TableCell className="pl-10 font-medium">
                                        <span className="inline-flex items-center gap-1">
                                          {isVersionOpen ? (
                                            <ChevronDown className="h-3.5 w-3.5 text-muted-foreground" />
                                          ) : (
                                            <ChevronRight className="h-3.5 w-3.5 text-muted-foreground" />
                                          )}
                                          {v.version}
                                        </span>
                                      </TableCell>
                                      <TableCell className="text-muted-foreground text-xs">
                                        {v.files.length} file{v.files.length === 1 ? "" : "s"}
                                      </TableCell>
                                      <TableCell
                                        className="text-muted-foreground text-xs font-mono truncate max-w-md"
                                        title={hasMetadata ? JSON.stringify(v.metadata) : undefined}
                                      >
                                        {hasMetadata ? JSON.stringify(v.metadata) : "—"}
                                      </TableCell>
                                      <TableCell className="text-muted-foreground text-xs">
                                        {new Date(v.created_at).toLocaleString(undefined, {
                                          month: "short",
                                          day: "numeric",
                                          year: "numeric",
                                          hour: "2-digit",
                                          minute: "2-digit",
                                        })}
                                      </TableCell>
                                    </TableRow>,
                                    isVersionOpen && (
                                      <TableRow key={`${v.version}-files`} className="bg-muted/20 hover:bg-muted/20">
                                        <TableCell colSpan={4} className="pl-16 py-2">
                                          {hasMetadata && (
                                            <pre className="text-[11px] bg-muted/50 rounded p-2 mb-2 overflow-x-auto max-w-3xl">
                                              {JSON.stringify(v.metadata, null, 2)}
                                            </pre>
                                          )}
                                          {v.files.length > 5 && (
                                            <div className="relative max-w-xs mb-2">
                                              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground/70" />
                                              <Input
                                                placeholder="Search files in this version..."
                                                value={fileSearch}
                                                onChange={(e) => setFileSearch(e.target.value)}
                                                onClick={(e) => e.stopPropagation()}
                                                className="pl-8 h-8 text-xs"
                                              />
                                            </div>
                                          )}
                                          {v.files.length === 0 ? (
                                            <p className="text-xs text-muted-foreground">This version has no files.</p>
                                          ) : (
                                            <Table>
                                              <TableHeader>
                                                <TableRow className="hover:bg-transparent">
                                                  <TableHead className="h-8 text-xs">File Path</TableHead>
                                                  <TableHead className="h-8 text-xs w-20">Version</TableHead>
                                                  <TableHead className="h-8 text-xs">Tag</TableHead>
                                                  <TableHead className="h-8 text-xs">URL</TableHead>
                                                  <TableHead className="h-8 text-xs w-24">Size</TableHead>
                                                </TableRow>
                                              </TableHeader>
                                              <TableBody>
                                                {v.files
                                                  .filter(
                                                    (f) =>
                                                      !fileSearch.trim() ||
                                                      f.file_path
                                                        .toLowerCase()
                                                        .includes(fileSearch.trim().toLowerCase()) ||
                                                      (f.tag || "")
                                                        .toLowerCase()
                                                        .includes(fileSearch.trim().toLowerCase())
                                                  )
                                                  .map((f) => (
                                                    <TableRow key={f.id} className="hover:bg-muted/40">
                                                      <TableCell className="py-1.5 font-mono text-xs" title={f.id}>
                                                        {f.file_path}
                                                      </TableCell>
                                                      <TableCell className="py-1.5 text-xs">v{f.version}</TableCell>
                                                      <TableCell className="py-1.5">
                                                        {f.tag ? (
                                                          <Badge
                                                            variant="outline"
                                                            className="text-[10px] max-w-48 overflow-hidden"
                                                            title={f.tag}
                                                          >
                                                            <span className="truncate">{f.tag}</span>
                                                          </Badge>
                                                        ) : (
                                                          <span className="text-muted-foreground text-xs">—</span>
                                                        )}
                                                      </TableCell>
                                                      <TableCell
                                                        className="py-1.5 text-muted-foreground text-xs truncate max-w-md"
                                                        title={f.url}
                                                      >
                                                        {f.url || "—"}
                                                      </TableCell>
                                                      <TableCell className="py-1.5 text-muted-foreground text-xs">
                                                        {formatFileSize(f.size)}
                                                      </TableCell>
                                                    </TableRow>
                                                  ))}
                                              </TableBody>
                                            </Table>
                                          )}
                                        </TableCell>
                                      </TableRow>
                                    ),
                                  ];
                                })}
                              </TableBody>
                            </Table>
                          )}
                        </div>
                      </TableCell>
                    </TableRow>
                  ),
                ];
              })}
            </TableBody>
          </Table>
        )}
      </CardContent>

      {/* Create set / new version dialog */}
      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="sm:max-w-3xl max-h-[85vh] overflow-y-auto overflow-x-hidden">
          <DialogHeader>
            <DialogTitle>{versionTarget ? `New version of "${versionTarget.name}"` : "Create File Set"}</DialogTitle>
            <DialogDescription>
              {versionTarget
                ? `Creates version ${(versionTarget.latest?.version ?? 0) + 1} — an immutable snapshot of the files you pick, with its own metadata. Pre-filled with the latest version's files.`
                : "Name the set (unique within the application), pick the files for version 1, and optionally attach metadata."}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            {!versionTarget && (
              <div className="space-y-2">
                <Label htmlFor="file-set-name">Set Name</Label>
                <Input
                  id="file-set-name"
                  placeholder="e.g., hyperpay-config"
                  value={groupName}
                  onChange={(e) => setGroupName(e.target.value)}
                />
              </div>
            )}
            <div className="space-y-2">
              <Label>Files ({groupFiles.length} selected, at least one required)</Label>
              <FileChooser mode="multi" selected={groupFiles} onChange={setGroupFiles} showFileSets={false} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="file-set-metadata">Version Metadata (JSON, optional)</Label>
              <Textarea
                id="file-set-metadata"
                placeholder='{"release_notes":"bumped hyperpay bundle","jira":"PICAF-123"}'
                rows={3}
                value={metadataText}
                onChange={(e) => setMetadataText(e.target.value)}
              />
            </div>
            {dialogError && <p className="text-sm text-red-600">{dialogError}</p>}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsDialogOpen(false)} disabled={isSubmitting}>
              Cancel
            </Button>
            <Button
              onClick={handleSubmit}
              disabled={isSubmitting || groupFiles.length === 0 || (!versionTarget && !groupName.trim())}
            >
              {isSubmitting
                ? versionTarget
                  ? "Creating version..."
                  : "Creating..."
                : versionTarget
                  ? "Create Version"
                  : "Create Set"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Rename dialog */}
    </Card>
  );
}
