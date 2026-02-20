"use client";

import { notFound, useParams } from "next/navigation";
import useSWR from "swr";
import { useAppContext } from "@/providers/app-context";
import { apiFetch } from "@/lib/api";
import { hasAppAccess } from "@/lib/utils";
import { ReleaseBuilder } from "@/components/release";
import { ApiReleaseData } from "@/types/release";

export default function EditReleasePage() {
  const { token, org, getAppAccess, getOrgAccess, loadingAccess } = useAppContext();
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

  if (loadingAccess) {
    return (
      <div className="p-6 flex items-center justify-center min-h-screen">
        <p className="text-muted-foreground">Checking access...</p>
      </div>
    );
  }

  const hasAccess = hasAppAccess(getOrgAccess(org), getAppAccess(org, params.appId), "write");

  if (!hasAccess) {
    notFound();
  }

  if (releaseError) {
    return (
      <div className="p-6 flex items-center justify-center min-h-screen">
        <div className="text-center text-destructive">
          <p>Failed to load release data for editing.</p>
        </div>
      </div>
    );
  }

  if (releaseLoading) {
    return (
      <div className="p-6 flex items-center justify-center min-h-screen">
        <div className="text-center">
          <div className="animate-spin inline-block h-8 w-8 border-4 border-current border-t-transparent text-muted-foreground rounded-full mb-4" />
          <p className="text-muted-foreground">Loading release data for editing...</p>
        </div>
      </div>
    );
  }

  if (!releaseData) {
    return (
      <div className="p-6 flex items-center justify-center min-h-screen">
        <div className="text-center text-destructive">
          <p>Release data not found. Unable to edit.</p>
        </div>
      </div>
    );
  }

  return <ReleaseBuilder mode="edit" releaseId={releaseId} initialData={releaseData} />;
}
