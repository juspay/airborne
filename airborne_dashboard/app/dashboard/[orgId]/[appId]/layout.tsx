"use client";

import { type ReactNode } from "react";
import { notFound, useParams } from "next/navigation";
import { useAppContext } from "@/providers/app-context";
import useSWR from "swr";
import { apiFetch, ErrorName } from "@/lib/api";

export default function ApplicationLayout({ children }: { children: ReactNode }) {
  const { token, org, setApp } = useAppContext();
  const p = useParams<{ appId: string }>();
  const appId = typeof p.appId === "string" ? p.appId : Array.isArray(p.appId) ? p.appId[0] : "";

  const queryParams = {
    page: 1,
    count: 1,
  };

  const { error, isLoading } = useSWR(token && org && appId ? ["/releases/list", queryParams] : null, async () =>
    apiFetch<any>("/releases/list", { query: queryParams }, { token, org, app: appId })
  );

  if (error && error.name === ErrorName.Forbidden) {
    notFound();
  } else if (!isLoading) {
    setApp(appId);
    return <>{children}</>;
  }
}
