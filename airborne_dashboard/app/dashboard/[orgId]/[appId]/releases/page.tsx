"use client";

import { useState } from "react";
import useSWR from "swr";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Search, Filter, Plus } from "lucide-react";
import Link from "next/link";
import { apiFetch } from "@/lib/api";
import { useAppContext } from "@/providers/app-context";
import { hasAppAccess } from "@/lib/utils";
import { useRouter } from "next/navigation";

export type ApiRelease = {
  id: string;
  created_at?: string;
  package?: { version?: number };
  configuration?: any;
  experiment?: {
    status: string;
    traffic_percentage: number;
  };
};

export default function ReleasesPage() {
  const router = useRouter();
  const [searchQuery, setSearchQuery] = useState("");
  const [filterStatus, setFilterStatus] = useState("all");
  const { token, org, app, getAppAccess, getOrgAccess } = useAppContext();

  const { data } = useSWR(token && org && app ? ["/releases/list", searchQuery] : null, async () =>
    apiFetch<any>("/releases/list", {}, { token, org, app })
  );
  const releases: ApiRelease[] = data?.releases || [];
  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-3xl font-bold font-[family-name:var(--font-space-grotesk)] text-balance">Releases</h1>
          <p className="text-muted-foreground mt-2">Deploy packages to your users with controlled rollouts</p>
        </div>
        {hasAppAccess(getOrgAccess(org), getAppAccess(org, app)) && (
          <Button asChild className="gap-2">
            <Link href={`/dashboard/${encodeURIComponent(org || "")}/${encodeURIComponent(app || "")}/releases/create`}>
              <Plus className="h-4 w-4" />
              New Release
            </Link>
          </Button>
        )}
      </div>

      <Card className="mb-6">
        <CardContent className="p-4">
          <div className="flex items-center gap-4">
            <div className="flex-1">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search releases..."
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
                <SelectItem value="CREATED">Created</SelectItem>
                <SelectItem value="INPROGRESS">In Progress</SelectItem>
                <SelectItem value="CONCLUDED">Concluded</SelectItem>
                <SelectItem value="DISCARDED">Discarded</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="font-[family-name:var(--font-space-grotesk)]">Releases ({releases.length})</CardTitle>
          <CardDescription>All releases with deployment status and metrics</CardDescription>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>ID</TableHead>
                <TableHead>Package</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Created</TableHead>
                {/* <TableHead className="w-[200px]">Actions</TableHead> */}
              </TableRow>
            </TableHeader>
            <TableBody>
              {releases
                .filter((r) => (filterStatus === "all" ? true : r.experiment?.status === filterStatus))
                .map((r) => (
                  <TableRow
                    key={r.id}
                    className="cursor-pointer hover:bg-muted "
                    onClick={() =>
                      router.push(
                        `/dashboard/${encodeURIComponent(org || "")}/${encodeURIComponent(app || "")}/releases/${encodeURIComponent(r.id)}`
                      )
                    }
                  >
                    <TableCell className="font-mono text-sm">
                      <div className="block w-full h-full">{r.id}</div>
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      <div className="block w-full h-full">{r.package?.version ?? "—"}</div>
                    </TableCell>
                    <TableCell>
                      <div className="block w-full h-full">
                        {r.experiment?.status != "INPROGRESS" && (
                          <Badge variant="outline">{r.experiment?.status || "—"}</Badge>
                        )}
                        {r.experiment?.status == "INPROGRESS" && (
                          <Badge variant="outline">Ramping to {r.experiment?.traffic_percentage || "—"}%</Badge>
                        )}
                      </div>
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      <div className="block w-full h-full">
                        {r.created_at ? new Date(r.created_at).toLocaleString() : "—"}
                      </div>
                    </TableCell>
                    {/* <TableCell className="flex gap-2">
                        <Button size="sm" variant="outline" onClick={() => rampRelease(r.id)}>
                          Ramp
                        </Button>
                        <Button size="sm" variant="outline" onClick={() => concludeRelease(r.id)}>
                          Conclude
                        </Button>
                        <Button asChild size="sm" variant="ghost">
                          <Link href={`/dashboard/${encodeURIComponent(org || '')}/${encodeURIComponent(app || '')}/releases/${encodeURIComponent(r.id)}`}>
                            <MoreHorizontal className="h-4 w-4" />
                          </Link>
                        </Button>
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
