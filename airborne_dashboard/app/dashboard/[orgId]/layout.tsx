"use client";

import { useEffect, type ReactNode } from "react";
import { useParams } from "next/navigation";
import { useAppContext } from "@/providers/app-context";

export default function ApplicationLayout({ children }: { children: ReactNode }) {
  const { setOrg } = useAppContext();
  const p = useParams<{ orgId: string }>();
  const orgId = typeof p.orgId === "string" ? p.orgId : Array.isArray(p.orgId) ? p.orgId[0] : "";

  useEffect(() => {
    if (orgId) setOrg(orgId);
  }, [orgId, setOrg]);

  return <>{children}</>;
}
