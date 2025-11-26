"use client";

import { type ReactNode } from "react";
import { notFound, useParams } from "next/navigation";
import { useAppContext } from "@/providers/app-context";
import { apiFetch } from "@/lib/api";
import useSWR from "swr";
import { OrganisationsList } from "../page";

export default function ApplicationLayout({ children }: { children: ReactNode }) {
  const { setOrg, token, logout } = useAppContext();
  const p = useParams<{ orgId: string }>();
  const orgId = typeof p.orgId === "string" ? p.orgId : Array.isArray(p.orgId) ? p.orgId[0] : "";

  const { data, isLoading } = useSWR<OrganisationsList>(token ? "/organisations" : null, (url: string) =>
    apiFetch<OrganisationsList>(url, {}, { token, logout })
  );

  if (!isLoading && data?.organisations.find((o) => o.name === orgId) === undefined) {
    notFound();
  } else if (!isLoading) {
    setOrg(orgId);
    return <>{children}</>;
  }
}
