"use client";

import { useState } from "react";
import useSWR from "swr";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Filter, Plus, Package } from "lucide-react";
import Link from "next/link";
import { apiFetch } from "@/lib/api";
import { useAppContext } from "@/providers/app-context";
import { hasAppAccess } from "@/lib/utils";
import { useParams, useRouter } from "next/navigation";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import {
  Pagination,
  PaginationContent,
  PaginationItem,
  PaginationPrevious,
  PaginationNext,
  PaginationLink,
  PaginationEllipsis,
} from "@/components/ui/pagination";

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

enum StatusFilter {
  ALL = "all",
  CREATED = "created",
  INPROGRESS = "inprogress",
  CONCLUDED = "concluded",
  DISCARDED = "discarded",
}

export default function ReleasesPage() {
  const router = useRouter();
  const [filterStatus, setFilterStatus] = useState<StatusFilter>(StatusFilter.ALL);
  const [page, setPage] = useState(1);
  const [count] = useState(20); // items per page
  const { token, org, app, getAppAccess, getOrgAccess } = useAppContext();
  const params = useParams<{ appId: string }>();
  const appId = typeof params.appId === "string" ? params.appId : Array.isArray(params.appId) ? params.appId[0] : "";

  const queryParams = {
    page,
    count,
    ...(filterStatus !== "all" ? { status: filterStatus } : {}),
  };

  // Use appId from URL params in SWR key to ensure we fetch for the correct app when navigating
  const { data, isLoading } = useSWR(token && org && appId ? ["/releases/list", appId, queryParams] : null, async () =>
    apiFetch<any>("/releases/list", { query: queryParams }, { token, org, app: appId })
  );

  const releases: ApiRelease[] = data?.data || [];
  const totalPages = data?.total_pages || 1;

  // helper to render page items
  const renderPaginationItems = (currentPage: number, totalPages: number, onPageChange: (page: number) => void) => {
    const items = [];
    const maxVisiblePages = 5;

    if (totalPages <= maxVisiblePages) {
      // Show all pages if total pages is small
      for (let i = 1; i <= totalPages; i++) {
        items.push(
          <PaginationItem key={i}>
            <PaginationLink
              href="#"
              onClick={(e) => {
                e.preventDefault();
                onPageChange(i);
              }}
              isActive={currentPage === i}
            >
              {i}
            </PaginationLink>
          </PaginationItem>
        );
      }
    } else {
      // Show first page
      items.push(
        <PaginationItem key={1}>
          <PaginationLink
            href="#"
            onClick={(e) => {
              e.preventDefault();
              onPageChange(1);
            }}
            isActive={currentPage === 1}
          >
            1
          </PaginationLink>
        </PaginationItem>
      );

      // Show ellipsis if current page is far from start
      if (currentPage > 3) {
        items.push(
          <PaginationItem key="ellipsis1">
            <PaginationEllipsis />
          </PaginationItem>
        );
      }

      // Show pages around current page
      const start = Math.max(2, currentPage - 1);
      const end = Math.min(totalPages - 1, currentPage + 1);

      for (let i = start; i <= end; i++) {
        items.push(
          <PaginationItem key={i}>
            <PaginationLink
              href="#"
              onClick={(e) => {
                e.preventDefault();
                onPageChange(i);
              }}
              isActive={currentPage === i}
            >
              {i}
            </PaginationLink>
          </PaginationItem>
        );
      }

      // Show ellipsis if current page is far from end
      if (currentPage < totalPages - 2) {
        items.push(
          <PaginationItem key="ellipsis2">
            <PaginationEllipsis />
          </PaginationItem>
        );
      }

      // Show last page
      if (totalPages > 1) {
        items.push(
          <PaginationItem key={totalPages}>
            <PaginationLink
              href="#"
              onClick={(e) => {
                e.preventDefault();
                onPageChange(totalPages);
              }}
              isActive={currentPage === totalPages}
            >
              {totalPages}
            </PaginationLink>
          </PaginationItem>
        );
      }
    }

    return items;
  };

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
            <Select
              value={filterStatus}
              onValueChange={(value) => {
                setPage(1);
                setFilterStatus(value as StatusFilter);
              }}
            >
              <SelectTrigger className="w-48">
                <Filter className="mr-2 h-4 w-4" />
                <SelectValue placeholder="Filter by status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={StatusFilter.ALL}>All</SelectItem>
                <SelectItem value={StatusFilter.CREATED}>Created</SelectItem>
                <SelectItem value={StatusFilter.INPROGRESS}>In Progress</SelectItem>
                <SelectItem value={StatusFilter.CONCLUDED}>Concluded</SelectItem>
                <SelectItem value={StatusFilter.DISCARDED}>Discarded</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="font-[family-name:var(--font-space-grotesk)]">
            Releases ({isLoading ? "..." : data?.total_items || 0})
          </CardTitle>
          <CardDescription>All releases with deployment status and metrics</CardDescription>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="flex items-center justify-center py-12">
              <div className="flex items-center gap-3">
                <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-primary"></div>
                <span className="text-muted-foreground">Loading releases...</span>
              </div>
            </div>
          ) : releases.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <Package className="h-12 w-12 text-muted-foreground mb-4" />
              <h3 className="text-lg font-semibold mb-2">No releases found</h3>
              <p className="text-muted-foreground mb-4">
                {filterStatus !== StatusFilter.ALL
                  ? `No releases with status "${filterStatus}" found.`
                  : "You haven't created any releases yet."}
              </p>
              {hasAppAccess(getOrgAccess(org), getAppAccess(org, app)) && filterStatus === StatusFilter.ALL && (
                <Button asChild className="gap-2">
                  <Link
                    href={`/dashboard/${encodeURIComponent(org || "")}/${encodeURIComponent(app || "")}/releases/create`}
                  >
                    <Plus className="h-4 w-4" />
                    Create your first release
                  </Link>
                </Button>
              )}
            </div>
          ) : (
            <>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>ID</TableHead>
                    <TableHead>Package</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Created</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {releases.map((r) => (
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
                        <div className="block w-full h-full">{r.package?.version ?? "—"} </div>
                      </TableCell>
                      <TableCell>
                        <div className="block w-full h-full">
                          {r.experiment?.status !== "INPROGRESS" && (
                            <Badge variant="outline">{r.experiment?.status || "—"}</Badge>
                          )}
                          {r.experiment?.status === "INPROGRESS" && (
                            <Badge variant="outline">Ramping to {r.experiment?.traffic_percentage || "—"}%</Badge>
                          )}
                        </div>
                      </TableCell>
                      <TableCell className="text-muted-foreground">
                        <div className="block w-full h-full">
                          {r.created_at ? new Date(r.created_at).toLocaleString() : "—"}
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>

              {/* Releases Pagination */}
              {totalPages > 1 && (
                <div className="mt-4">
                  <Pagination>
                    <PaginationContent>
                      <PaginationItem>
                        <PaginationPrevious
                          href="#"
                          onClick={(e) => {
                            e.preventDefault();
                            if (page > 1) setPage(page - 1);
                          }}
                          className={page <= 1 ? "pointer-events-none opacity-50" : ""}
                        />
                      </PaginationItem>

                      {renderPaginationItems(page, totalPages, setPage)}

                      <PaginationItem>
                        <PaginationNext
                          href="#"
                          onClick={(e) => {
                            e.preventDefault();
                            if (page < totalPages) setPage(page + 1);
                          }}
                          className={page >= totalPages ? "pointer-events-none opacity-50" : ""}
                        />
                      </PaginationItem>
                    </PaginationContent>
                  </Pagination>
                </div>
              )}
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
