"use client";

import { notFound, useParams } from "next/navigation";
import useSWR from "swr";
import { useAppContext } from "@/providers/app-context";
import { apiFetch } from "@/lib/api";
import { ReleaseBuilder } from "@/components/release";
import { ApiReleaseData } from "@/types/release";
import { definePagePermissions, permission } from "@/lib/page-permissions";
import { usePagePermissions } from "@/hooks/use-page-permissions";

const PAGE_AUTHZ = definePagePermissions({
  read_release: permission("release", "read", "app"),
  create_release: permission("release", "create", "app"),
});

export default function CloneReleasePage() {
  const { token, org } = useAppContext();
  const permissions = usePagePermissions(PAGE_AUTHZ);
  const params = useParams<{ appId: string; releaseId: string }>();
  const releaseId = params.releaseId;

  const shouldFetch = Boolean(releaseId && token && org && params.appId);

  const {
    data: releaseData,
    isLoading: releaseLoading,
    error: releaseError,
  } = useSWR(shouldFetch ? ["/releases", releaseId, token, org, params.appId] : null, ([, id, t, o, a]) =>
    apiFetch<ApiReleaseData>(`/releases/${encodeURIComponent(id)}`, {}, { token: t, org: o, app: a })
  );

  if (!permissions.isReady) {
    return (
      <div className="p-6 flex items-center justify-center min-h-screen">
        <p className="text-muted-foreground">Checking access...</p>
      </div>
    );
  }

  const hasAccess = permissions.can("read_release") && permissions.can("create_release");

  if (!hasAccess) {
    notFound();
  }

  if (releaseLoading) {
    return (
      <div className="p-6 flex items-center justify-center min-h-screen">
        <div className="text-center">
          <div className="animate-spin inline-block h-8 w-8 border-4 border-current border-t-transparent text-muted-foreground rounded-full mb-4" />
          <p className="text-muted-foreground">Loading release data for cloning...</p>
        </div>
      </div>
    );
  }

  if (releaseError) {
    return (
      <div className="p-6 flex items-center justify-center min-h-screen">
        <div className="text-center text-destructive">
          <p>Failed to load release data for cloning.</p>
        </div>
      </div>
    );
  }

  if (!releaseData) {
    return (
      <div className="p-6 flex items-center justify-center min-h-screen">
        <div className="text-center text-destructive">
          <p>Release data not found. Unable to clone.</p>
        </div>
      </div>
    );
  }

  return <ReleaseBuilder mode="clone" releaseId={releaseId} initialData={releaseData} />;
}
