"use client";

import { useEffect } from "react";
import { notFound, useParams } from "next/navigation";
import useSWR from "swr";
import { useAppContext } from "@/providers/app-context";
import { apiFetch } from "@/lib/api";
import { hasAppAccess } from "@/lib/utils";
import { ReleaseBuilder } from "@/components/release";
import { ApiReleaseData } from "@/types/release";

export default function CloneReleasePage() {
  const { token, org, app, getAppAccess, getOrgAccess, loadingAccess } = useAppContext();
  const params = useParams<{ appId: string; releaseId: string }>();
  const releaseId = params.releaseId;

  // Fetch the release data for cloning
  const { data: releaseData, isLoading: releaseLoading } = useSWR(
    releaseId && token && org && params.appId ? ["/releases", releaseId, token, org, params.appId] : null,
    ([, id, t, o, a]) =>
      apiFetch<ApiReleaseData>(`/releases/${encodeURIComponent(id)}`, {}, { token: t, org: o, app: a })
  );

  useEffect(() => {
    if (!loadingAccess && !hasAppAccess(getOrgAccess(org), getAppAccess(org, app))) {
      notFound();
    }
  }, [loadingAccess, org, app, getOrgAccess, getAppAccess]);

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

  return <ReleaseBuilder mode="clone" releaseId={releaseId} initialData={releaseData} />;
}
