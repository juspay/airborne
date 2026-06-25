"use client";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Skeleton } from "@/components/ui/skeleton";
import { Rocket, ArrowLeft, Calendar, BookOpen, Terminal, ArrowRight, ExternalLink } from "lucide-react";
import Link from "next/link";
import { notFound, useParams, useRouter } from "next/navigation";
import { useAppContext } from "@/providers/app-context";
import useSWR from "swr";
import { apiFetch, ErrorName } from "@/lib/api";
import { ApiRelease } from "./releases/page";
import { definePagePermissions, permission } from "@/lib/page-permissions";
import { usePagePermissions } from "@/hooks/use-page-permissions";

const PAGE_AUTHZ = definePagePermissions({
  read_releases: permission("release", "read", "app"),
  create_release: permission("release", "create", "app"),
});

// Documentation served by the Airborne server under /docs (see airborne_docs/).
const DOCS = {
  integrateReactNative: "/docs/guides/integrate-react-native",
  integrateExpo: "/docs/guides/integrate-react-native-expo",
  cli: "/docs/react-native-cli/getting-started",
  createRelease: "/docs/guides/create-and-target-a-release",
};

const GETTING_STARTED_STEPS = [
  {
    key: "integrate",
    icon: BookOpen,
    title: "Integrate the SDK",
    description: "Add Airborne to your app so it boots from an over-the-air bundle.",
    links: [
      { label: "React Native", href: DOCS.integrateReactNative },
      { label: "Expo", href: DOCS.integrateExpo },
    ],
  },
  {
    key: "bundle",
    icon: Terminal,
    title: "Bundle & upload",
    description: "Use the airborne-devkit CLI to bundle your app, upload files, and cut a package.",
    links: [{ label: "CLI guide", href: DOCS.cli }],
  },
  {
    key: "release",
    icon: Rocket,
    title: "Create a release",
    description: "Pick a package, target it by dimension or app version, then ramp the rollout.",
    links: [{ label: "Releasing guide", href: DOCS.createRelease }],
  },
];

export default function ApplicationDetailPage() {
  const { token, org, app } = useAppContext();
  const permissions = usePagePermissions(PAGE_AUTHZ);
  const params = useParams<{ appId: string }>();
  const appId = typeof params.appId === "string" ? params.appId : Array.isArray(params.appId) ? params.appId[0] : "";
  // Use appId from URL params in SWR key to ensure we fetch for the correct app when navigating
  const { data, error } = useSWR(token && org && appId ? ["/releases/list", appId] : null, async () =>
    apiFetch<any>("/releases/list", { query: { page: 1, count: 5 } }, { token, org, app: appId })
  );

  if (error && error.name === ErrorName.Forbidden) {
    notFound();
  }
  if (permissions.isReady && !permissions.can("read_releases")) {
    notFound();
  }

  const releases: ApiRelease[] = data?.data || [];
  const isLoading = !data && !error;
  const hasReleases = releases.length > 0;
  const canCreate = permissions.can("create_release");
  const createReleaseHref = `/dashboard/${encodeURIComponent(org || "")}/${encodeURIComponent(app || "")}/releases/create`;

  const router = useRouter();

  return (
    <div className="min-h-screen bg-background">
      <div className="flex">
        {/* Main Content */}
        <main className="flex-1 p-6">
          {/* Page Header */}
          <div className="flex items-center gap-4 mb-8">
            <Button variant="ghost" size="sm" asChild>
              <Link href={"/dashboard/" + encodeURIComponent(org || "")}>
                <ArrowLeft className="h-4 w-4" />
              </Link>
            </Button>
            <div className="flex-1">
              <div className="flex items-center gap-3 mb-2">
                <h1 className="text-3xl font-bold font-[family-name:var(--font-space-grotesk)]">{app}</h1>
              </div>
            </div>
            {canCreate && hasReleases && (
              <div className="flex gap-2">
                <Button asChild>
                  <Link href={createReleaseHref}>
                    <Rocket className="h-4 w-4 mr-2" />
                    Create Release
                  </Link>
                </Button>
              </div>
            )}
          </div>

          {isLoading ? (
            // Loading state
            <div className="mt-6 space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
                <Skeleton className="h-24 w-full rounded-xl" />
                <Skeleton className="h-24 w-full rounded-xl" />
              </div>
              <Skeleton className="h-64 w-full rounded-xl" />
            </div>
          ) : !hasReleases ? (
            // Empty state: no releases yet — guide the user to integrate & ship.
            <Card className="mt-6 border-dashed">
              <CardContent className="p-8 md:p-12">
                <div className="mx-auto max-w-3xl text-center">
                  <div className="mx-auto mb-5 flex h-14 w-14 items-center justify-center rounded-2xl bg-primary/10">
                    <Rocket className="h-7 w-7 text-primary" />
                  </div>
                  <h2 className="text-2xl font-bold font-[family-name:var(--font-space-grotesk)]">
                    {"You haven't released via Airborne yet"}
                  </h2>
                  <p className="mt-2 text-muted-foreground">
                    {
                      "Once you integrate the Airborne SDK and ship your first over-the-air release, your deployments and their status will show up here — here's how to get going."
                    }
                  </p>
                </div>

                <div className="mx-auto mt-8 grid max-w-4xl gap-4 md:grid-cols-3">
                  {GETTING_STARTED_STEPS.map((step, index) => (
                    <div key={step.key} className="rounded-xl border bg-card p-5 text-left">
                      <div className="mb-3 flex items-center gap-3">
                        <span className="flex h-7 w-7 items-center justify-center rounded-full bg-primary text-sm font-bold text-primary-foreground">
                          {index + 1}
                        </span>
                        <step.icon className="h-5 w-5 text-muted-foreground" />
                      </div>
                      <h3 className="font-semibold">{step.title}</h3>
                      <p className="mt-1 text-sm text-muted-foreground">{step.description}</p>
                      <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1">
                        {step.links.map((link) => (
                          <a
                            key={link.href}
                            href={link.href}
                            target="_blank"
                            rel="noreferrer"
                            className="inline-flex items-center gap-1 text-sm font-medium text-primary hover:underline"
                          >
                            {link.label}
                            <ExternalLink className="h-3 w-3" />
                          </a>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>

                <div className="mx-auto mt-8 flex max-w-4xl flex-col items-center justify-center gap-3 sm:flex-row">
                  {canCreate && (
                    <Button asChild size="lg">
                      <Link href={createReleaseHref}>
                        <Rocket className="mr-2 h-4 w-4" />
                        Create your first release
                      </Link>
                    </Button>
                  )}
                  <Button asChild variant="outline" size="lg">
                    <a href={DOCS.integrateReactNative} target="_blank" rel="noreferrer">
                      <BookOpen className="mr-2 h-4 w-4" />
                      Read the integration guide
                      <ArrowRight className="ml-2 h-4 w-4" />
                    </a>
                  </Button>
                </div>
              </CardContent>
            </Card>
          ) : (
            // Has releases: stats + recent releases.
            <>
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
                          {new Date(releases[0].created_at || "").toLocaleDateString()}
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
                          onClick={() =>
                            router.push(
                              `/dashboard/${encodeURIComponent(org || "")}/${encodeURIComponent(app || "")}/releases/${encodeURIComponent(r.id)}`
                            )
                          }
                          className="cursor-pointer hover:bg-muted "
                        >
                          <TableCell className="font-mono text-sm">
                            <div className="block w-full h-full">{r.id}</div>
                          </TableCell>

                          <TableCell className="text-muted-foreground">
                            <div className="block w-full h-full">{r.package?.version ?? "—"}</div>
                          </TableCell>

                          <TableCell>
                            <div className="block w-full h-full">
                              <Badge variant="outline">{r?.experiment?.status || "—"}</Badge>
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
                </CardContent>
              </Card>
            </>
          )}
        </main>
      </div>
    </div>
  );
}
