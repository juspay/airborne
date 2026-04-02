"use client";

import { notFound } from "next/navigation";
import { ReleaseBuilder } from "@/components/release";
import { definePagePermissions, permission } from "@/lib/page-permissions";
import { usePagePermissions } from "@/hooks/use-page-permissions";

const PAGE_AUTHZ = definePagePermissions({
  create_release: permission("release", "create", "app"),
});

export default function CreateReleasePage() {
  const permissions = usePagePermissions(PAGE_AUTHZ);

  if (!permissions.isReady) {
    return (
      <div className="p-6 flex items-center justify-center min-h-screen">
        <p className="text-muted-foreground">Checking access...</p>
      </div>
    );
  }

  const hasAccess = permissions.can("create_release");

  if (!hasAccess) {
    notFound();
  }

  return <ReleaseBuilder mode="create" />;
}
