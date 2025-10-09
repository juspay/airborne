"use client";

import { useEffect, type ReactNode } from "react";
import { useParams, usePathname } from "next/navigation";
import { useAppContext } from "@/providers/app-context";

export default function ApplicationLayout({ children }: { children: ReactNode }) {
  const { setOrg, setApp } = useAppContext();
  const p = useParams<{ orgId: string }>();
  const pathname = usePathname();
  const orgId = typeof p.orgId === "string" ? p.orgId : Array.isArray(p.orgId) ? p.orgId[0] : "";

  useEffect(() => {
    if (orgId) {
      setOrg(orgId);
      if (!(pathname.split("/").length > 3)) {
        setApp(null);
      }
    }
  }, [orgId, setOrg, setApp, pathname]);

  return <>{children}</>;
}
