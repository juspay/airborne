"use client";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Rocket, ArrowLeft, Calendar } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useAppContext } from "@/providers/app-context";
import useSWR from "swr";
import { apiFetch } from "@/lib/api";
import { ApiRelease } from "./releases/page";

export default function ApplicationDetailPage() {
  const { token, org, app } = useAppContext();
  const { data } = useSWR(token && org && app ? ["/releases/list"] : null, async () =>
    apiFetch<any>("/releases/list", {}, { token, org, app })
  );
  const releases: ApiRelease[] = data?.releases || [];

  const router = useRouter();

  return (
    <div className="min-h-screen bg-background">
      <div className="flex">
        {/* Main Content */}
        <main className="flex-1 p-6">
          {/* Page Header */}
          <div className="flex items-center gap-4 mb-8">
            <Button variant="ghost" size="sm" asChild>
              <Link href={"/dashboard/" + org}>
                <ArrowLeft className="h-4 w-4" />
              </Link>
            </Button>
            <div className="flex-1">
              <div className="flex items-center gap-3 mb-2">
                <h1 className="text-3xl font-bold font-[family-name:var(--font-space-grotesk)]">{app}</h1>
              </div>
            </div>
            <div className="flex gap-2">
              <Button asChild>
                <Link href={`/dashboard/${org}/${app}/releases/create`}>
                  <Rocket className="h-4 w-4 mr-2" />
                  Create Release
                </Link>
              </Button>
            </div>
          </div>

          {/* Stats Cards */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mt-6">
            <Card>
              <CardContent className="p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-muted-foreground">Total Releases</p>
                    <p className="text-2xl font-bold">{releases.length}</p>
                  </div>
                  <Rocket className="h-8 w-8 text-muted-foreground" />
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-muted-foreground">Last Deploy</p>
                    <p className="text-lg font-bold">
                      {releases.length > 0 ? new Date(releases[0].created_at || "").toLocaleDateString() : "NA"}
                    </p>
                  </div>
                  <Calendar className="h-8 w-8 text-muted-foreground" />
                </div>
              </CardContent>
            </Card>
          </div>

          <Card className="mt-10">
            <CardHeader>
              <CardTitle className="font-[family-name:var(--font-space-grotesk)]">Recent Releases</CardTitle>
              <CardDescription>Latest deployments and their status</CardDescription>
            </CardHeader>
            <CardContent>
              {releases.length === 0 ? (
                <p className="text-gray-600 dark:text-gray-300 text-center">No release yet</p>
              ) : (
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
                    {releases.slice(0, 5).map((r) => (
                      <TableRow
                        key={r.id}
                        onClick={() => router.push(`/dashboard/${org}/${app}/releases/${encodeURIComponent(r.id)}`)}
                      >
                        <TableCell className="font-mono text-sm">
                          <Link
                            href={`/dashboard/${org}/${app}/releases/${encodeURIComponent(r.id)}`}
                            className="hover:text-primary"
                          >
                            {r.id}
                          </Link>
                        </TableCell>
                        <TableCell className="text-muted-foreground">{r.package?.version ?? "—"}</TableCell>
                        <TableCell>
                          <Badge variant="outline">{r?.experiment?.status || "—"}</Badge>
                        </TableCell>
                        <TableCell className="text-muted-foreground">
                          {r.created_at ? new Date(r.created_at).toLocaleString() : "—"}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </main>
      </div>
    </div>
  );
}
