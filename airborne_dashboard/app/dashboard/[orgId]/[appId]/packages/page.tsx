"use client";

import { useState } from "react";
import useSWR from "swr";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Search, Edit, Filter, PlugIcon as PkgIcon, Rocket, Plus } from "lucide-react";
import Link from "next/link";
import { apiFetch } from "@/lib/api";
import { useAppContext } from "@/providers/app-context";
import { hasAppAccess } from "@/lib/utils";
import { useDebouncedValue } from "@/hooks/useDebouncedValue";

type ApiPackage = {
  index: string;
  tag?: string;
  version: number;
  files: string[];
};

export default function PackagesPage() {
  const [searchQuery, setSearchQuery] = useState("");
  const debouncedSearchQuery = useDebouncedValue(searchQuery, 500);
  const [filterStatus, setFilterStatus] = useState("all");
  const { token, org, app, getAppAccess, getOrgAccess } = useAppContext();

  const { data } = useSWR(token && org && app ? ["/packages/list", debouncedSearchQuery] : null, async () =>
    apiFetch<any>("/packages/list", { query: { offset: 0, limit: 50 } }, { token, org, app })
  );
  const packages: ApiPackage[] = data?.packages || [];

  const filtered = packages.filter((p) => {
    const name = p.index || "";
    return name.toLowerCase().includes(searchQuery.toLowerCase());
  });

  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-3xl font-bold font-[family-name:var(--font-space-grotesk)] text-balance">Packages</h1>
          <p className="text-muted-foreground mt-2">Bundle files together with properties and metadata</p>
        </div>
        {hasAppAccess(getOrgAccess(org), getAppAccess(org, app)) && (
          <Button asChild className="gap-2">
            <Link href={`/dashboard/${encodeURIComponent(org || "")}/${encodeURIComponent(app || "")}/packages/create`}>
              <Plus className="h-4 w-4" />
              Create Package
            </Link>
          </Button>
        )}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Packages Versions</CardTitle>
            <PkgIcon className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-primary">{packages.length}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Files</CardTitle>
            <PkgIcon className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-primary">
              {packages.reduce((sum, pkg) => sum + pkg.files.length, 0)}
            </div>
            <p className="text-xs text-muted-foreground">across all packages</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Draft Packages</CardTitle>
            <Edit className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-yellow-600">{packages.filter((p) => p.tag === "draft").length}</div>
            <p className="text-xs text-muted-foreground">ready for review</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Release Usage</CardTitle>
            <Rocket className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-primary">{packages.reduce((sum, pkg) => sum + pkg.version, 0)}</div>
            <p className="text-xs text-muted-foreground">total deployments</p>
          </CardContent>
        </Card>
      </div>

      <Card className="mb-6">
        <CardContent className="p-4">
          <div className="flex items-center gap-4">
            <div className="flex-1">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search packages by name or tag..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-10"
                />
              </div>
            </div>
            <Select value={filterStatus} onValueChange={setFilterStatus}>
              <SelectTrigger className="w-48">
                <Filter className="mr-2 h-4 w-4" />
                <SelectValue placeholder="Filter by status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="font-[family-name:var(--font-space-grotesk)]">Packages ({filtered.length})</CardTitle>
          <CardDescription>All packages with bundled file identifiers</CardDescription>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Tag</TableHead>
                <TableHead>Index</TableHead>
                <TableHead>Version</TableHead>
                <TableHead>Files</TableHead>
                <TableHead className="w-[50px]"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.map((pkg, i) => (
                <TableRow key={`${pkg.tag}-${pkg.version}-${i}`}>
                  <TableCell>{pkg.tag && <Badge variant="outline">{pkg.tag}</Badge>}</TableCell>
                  <TableCell className="font-mono text-sm">{pkg.index}</TableCell>
                  <TableCell className="text-muted-foreground">{pkg.version}</TableCell>
                  <TableCell className="text-muted-foreground">{pkg.files.length} files</TableCell>
                  {/* <TableCell>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="sm">
                            <MoreHorizontal className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem>
                            <Edit className="mr-2 h-4 w-4" />
                            Edit Package
                          </DropdownMenuItem>
                          <DropdownMenuItem>
                            <Copy className="mr-2 h-4 w-4" />
                            Duplicate
                          </DropdownMenuItem>
                          <DropdownMenuItem className="text-destructive">
                            <Trash2 className="mr-2 h-4 w-4" />
                            Delete
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </TableCell> */}
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
