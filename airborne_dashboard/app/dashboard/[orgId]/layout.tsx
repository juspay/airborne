"use client";

import { useEffect, type ReactNode } from "react";
import { notFound, useParams, usePathname } from "next/navigation";
import { useAppContext } from "@/providers/app-context";
import { apiFetch } from "@/lib/api";
import useSWR from "swr";
import { OrganisationsList } from "../page";

export default function ApplicationLayout({ children }: { children: ReactNode }) {
  const { setOrg, token, logout, setApp } = useAppContext();
  const p = useParams<{ orgId: string }>();
  const pathname = usePathname();
  const orgId = typeof p.orgId === "string" ? p.orgId : Array.isArray(p.orgId) ? p.orgId[0] : "";

  const { data, isLoading } = useSWR<OrganisationsList>(token ? "/organisations" : null, (url: string) =>
    apiFetch<OrganisationsList>(url, {}, { token, logout })
  );
  useEffect(() => {
    if (orgId) {
      setOrg(orgId);
      if (!(pathname.split("/").length > 3)) {
        setApp(null);
      }
    }
  }, [orgId, setOrg, setApp, pathname]);

  if (!isLoading && data?.organisations.find((o) => o.name === orgId) === undefined) {
    notFound();
  } else if (!isLoading) {
    setOrg(orgId);
    return <>{children}</>;
  }
}
