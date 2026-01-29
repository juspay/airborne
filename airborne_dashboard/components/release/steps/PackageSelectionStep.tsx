"use client";

import React, { useEffect, useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Search, Package, Plus, Info } from "lucide-react";
import Link from "next/link";
import { useReleaseForm } from "../ReleaseFormContext";
import { PaginationControls } from "../PaginationControls";
import { apiFetch } from "@/lib/api";
import { useAppContext } from "@/providers/app-context";
import { useDebouncedValue } from "@/hooks/useDebouncedValue";
import { hasAppAccess } from "@/lib/utils";
import { Pkg } from "@/types/release";

export function PackageSelectionStep() {
  const { token, org, app, getAppAccess, getOrgAccess } = useAppContext();
  const { mode, selectedPackage, setSelectedPackage } = useReleaseForm();

  const [packages, setPackages] = useState<Pkg[]>([]);
  const [packagesLoading, setPackagesLoading] = useState(false);
  const [pkgSearch, setPkgSearch] = useState("");
  const [pkgPage, setPkgPage] = useState(1);
  const [totalPackagesPage, setTotalPackagesPage] = useState(0);

  const debouncedPackageSearch = useDebouncedValue(pkgSearch, 500);
  const pkgCount = 10;

  useEffect(() => {
    if (!token || !org || !app) return;
    setPackagesLoading(true);
    apiFetch<any>(
      "/packages/list",
      {
        query: { page: pkgPage, count: pkgCount, search: debouncedPackageSearch ? debouncedPackageSearch : undefined },
      },
      { token, org, app }
    )
      .then((res) => {
        const loadedPackages = res.data || [];
        setPackages(loadedPackages);
        setTotalPackagesPage(res.total_pages);
      })
      .catch(() => setPackages([]))
      .finally(() => setPackagesLoading(false));
  }, [token, org, app, pkgCount, pkgPage, debouncedPackageSearch]);

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="font-[family-name:var(--font-space-grotesk)]">Select Package Version</CardTitle>
          <CardDescription>Choose an existing package to base this release on (optional)</CardDescription>
          {(mode === "clone" || mode === "edit") && selectedPackage && (
            <div className="flex items-center gap-2 p-3 bg-blue-50 border border-blue-200 rounded-lg mt-2">
              <Info className="h-4 w-4 text-blue-600" />
              <div className="text-sm text-blue-800">
                {mode === "edit" ? "Current" : "Original"} release uses package version {selectedPackage.version}
                {mode === "clone" && " - it should be automatically selected if available"}.
              </div>
            </div>
          )}
        </CardHeader>
        <CardContent>
          <div className="mb-4">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search packages..."
                value={pkgSearch}
                onChange={(e) => {
                  setPkgSearch(e.target.value);
                  setPkgPage(1);
                }}
                className="pl-10"
              />
            </div>
          </div>
          {packagesLoading ? (
            <div className="flex items-center justify-center py-12">
              <div className="flex items-center gap-3">
                <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-primary"></div>
                <span className="text-muted-foreground">Loading packages...</span>
              </div>
            </div>
          ) : packages.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <Package className="h-12 w-12 text-muted-foreground mb-4" />
              <h3 className="text-lg font-semibold mb-2">No packages found</h3>
              <p className="text-muted-foreground mb-4">
                {pkgSearch.trim() !== ""
                  ? `No packages found matching "${pkgSearch}".`
                  : "You haven't created any packages yet."}
              </p>
              {hasAppAccess(getOrgAccess(org), getAppAccess(org, app)) && pkgSearch.trim() === "" && (
                <Button asChild className="gap-2">
                  <Link
                    href={`/dashboard/${encodeURIComponent(org || "")}/${encodeURIComponent(
                      app || ""
                    )}/packages/create`}
                  >
                    <Plus className="h-4 w-4" />
                    Create your first package
                  </Link>
                </Button>
              )}
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-[50px]"></TableHead>
                  <TableHead>Version</TableHead>
                  <TableHead>Tag</TableHead>
                  <TableHead>Index</TableHead>
                  <TableHead>Files</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {packages.map((p) => {
                  const key = `${p.tag}:${p.version}`;
                  const checked = selectedPackage
                    ? selectedPackage.version === p.version && selectedPackage.tag === p.tag
                    : false;
                  return (
                    <TableRow key={key}>
                      <TableCell>
                        <Checkbox
                          checked={checked}
                          onCheckedChange={(isChecked) => setSelectedPackage(isChecked ? p : null)}
                        />
                      </TableCell>
                      <TableCell className="text-muted-foreground">{p.version}</TableCell>
                      <TableCell>
                        <span className="font-mono text-sm">{p.tag}</span>
                      </TableCell>
                      <TableCell className="font-mono text-sm">{p.index}</TableCell>
                      <TableCell className="text-muted-foreground">{p.files.length}</TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          )}

          <PaginationControls currentPage={pkgPage} totalPages={totalPackagesPage} onPageChange={setPkgPage} />
        </CardContent>
      </Card>
    </div>
  );
}

export default PackageSelectionStep;
