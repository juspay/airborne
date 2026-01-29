"use client";

import { notFound, useParams } from "next/navigation";
import { useAppContext } from "@/providers/app-context";
import { hasAppAccess } from "@/lib/utils";
import { ReleaseBuilder } from "@/components/release";

export default function CreateReleasePage() {
  const { org, getAppAccess, getOrgAccess, loadingAccess } = useAppContext();
  const params = useParams<{ appId: string }>();

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

  return <ReleaseBuilder mode="create" />;
}
