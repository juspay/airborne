"use client";

import { useEffect } from "react";
import { notFound } from "next/navigation";
import { useAppContext } from "@/providers/app-context";
import { hasAppAccess } from "@/lib/utils";
import { ReleaseBuilder } from "@/components/release";

export default function CreateReleasePage() {
  const { org, app, getAppAccess, getOrgAccess, loadingAccess } = useAppContext();

  useEffect(() => {
    if (!loadingAccess && !hasAppAccess(getOrgAccess(org), getAppAccess(org, app))) {
      notFound();
    }
  }, [loadingAccess, org, app, getOrgAccess, getAppAccess]);

  return <ReleaseBuilder mode="create" />;
}
