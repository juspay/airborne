"use client";

import React, { useMemo, useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Search, FileText, Info } from "lucide-react";
import { useReleaseForm } from "../ReleaseFormContext";
import { PaginationControls } from "../PaginationControls";
import { useDebouncedValue } from "@/hooks/useDebouncedValue";

const FILES_PER_PAGE = 10;

export function FilePrioritiesStep() {
  const { files, filePriority, updateFilePriority } = useReleaseForm();
  const [filesSearch, setFilesSearch] = useState("");
  const [filesCurrentPage, setFilesCurrentPage] = useState(1);

  const debouncedFilesSearch = useDebouncedValue(filesSearch, 300);

  const filteredFiles = useMemo(
    () => files.filter((f) => f.file_path.toLowerCase().includes(debouncedFilesSearch.toLowerCase())),
    [files, debouncedFilesSearch]
  );

  const filesTotalPages = Math.ceil(filteredFiles.length / FILES_PER_PAGE);
  const paginatedFiles = useMemo(
    () => filteredFiles.slice((filesCurrentPage - 1) * FILES_PER_PAGE, filesCurrentPage * FILES_PER_PAGE),
    [filteredFiles, filesCurrentPage]
  );

  const handleFilesSearchChange = (value: string) => {
    setFilesSearch(value);
    setFilesCurrentPage(1);
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="font-[family-name:var(--font-space-grotesk)]">Configure File Priorities</CardTitle>
          <CardDescription>Choose which files load immediately (important) vs on-demand (lazy)</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex items-center gap-2 p-3 bg-blue-10 border border-blue-200 rounded-lg mb-4">
            <Info className="h-4 w-4 text-blue-600" />
            <div className="text-sm">
              All files default to Important. Switch to Lazy to defer loading.
              <span className="block mt-1 text-muted-foreground">
                Files are merged from multiple packages. Primary package files take precedence for duplicate paths.
              </span>
            </div>
          </div>

          {files.length > 0 && (
            <div className="mb-4">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search files..."
                  value={filesSearch}
                  onChange={(e) => handleFilesSearchChange(e.target.value)}
                  className="pl-10"
                />
              </div>
            </div>
          )}

          {files.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <FileText className="mx-auto h-8 w-8 mb-2" />
              <p className="text-sm">No files available.</p>
            </div>
          ) : filteredFiles.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <FileText className="mx-auto h-8 w-8 mb-2" />
              <p className="text-sm">No files found matching your search.</p>
            </div>
          ) : (
            <div className="space-y-4">
              <div className="text-sm text-muted-foreground">
                Showing {Math.min(FILES_PER_PAGE, paginatedFiles.length)} of {filteredFiles.length} files
                {filesCurrentPage > 1 && ` (page ${filesCurrentPage})`}
                {filesSearch && ` matching "${filesSearch}"`}
              </div>

              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>File</TableHead>
                    <TableHead>Tag</TableHead>
                    <TableHead>Version</TableHead>
                    <TableHead>Priority</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {paginatedFiles.map((f) => {
                    const id = f.id || `${f.file_path}@version:${f.version}`;
                    return (
                      <TableRow key={id}>
                        <TableCell className="font-mono text-sm">{f.file_path}</TableCell>
                        <TableCell>
                          <Badge variant="outline">{f.tag || "N/A"}</Badge>
                        </TableCell>
                        <TableCell className="text-muted-foreground">{f.version || "N/A"}</TableCell>
                        <TableCell>
                          <Select
                            value={filePriority[id] || "important"}
                            onValueChange={(v) => updateFilePriority(id, v as "important" | "lazy")}
                          >
                            <SelectTrigger className="w-32">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="important">Important</SelectItem>
                              <SelectItem value="lazy">Lazy</SelectItem>
                            </SelectContent>
                          </Select>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>

              <PaginationControls
                currentPage={filesCurrentPage}
                totalPages={filesTotalPages}
                onPageChange={setFilesCurrentPage}
              />
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

export default FilePrioritiesStep;
