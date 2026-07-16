"use client";

import { useEffect, type ReactNode } from "react";
import { notFound, useParams } from "next/navigation";
import { useAppContext } from "@/providers/app-context";
import { apiFetch } from "@/lib/api";
import useSWR from "swr";
import { OrganisationsList } from "../page";

export default function ApplicationLayout({ children }: { children: ReactNode }) {
  const { setOrg, token, logout, setApp } = useAppContext();
  const p = useParams<{ orgId: string; appId?: string }>();
  const orgId = typeof p.orgId === "string" ? p.orgId : Array.isArray(p.orgId) ? p.orgId[0] : "";

  const { data, isLoading } = useSWR<OrganisationsList>(token ? "/organisations" : null, (url: string) =>
    apiFetch<OrganisationsList>(url, {}, { token, logout })
  );
  useEffect(() => {
    if (orgId) {
      setOrg(orgId);
      // Clear the app on org-level routes. Keyed off the `appId` route param (nested
      // params merge, so it is set on every /[orgId]/[appId]/* route) rather than a
      // path-segment count, which mistook 4-segment org routes like /users and
      // /webhooks for app routes and left a stale app in context.
      if (!p.appId) {
        setApp(null);
      }
    }
  }, [orgId, setOrg, setApp, p.appId]);

  if (!isLoading && data?.organisations.find((o) => o.name === orgId) === undefined) {
    notFound();
  } else if (!isLoading) {
    setOrg(orgId);
    return <>{children}</>;
  }
}
