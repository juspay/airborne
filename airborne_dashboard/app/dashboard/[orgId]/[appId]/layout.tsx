"use client";

import { useLayoutEffect, type ReactNode } from "react";
import { useParams } from "next/navigation";
import { useAppContext } from "@/providers/app-context";

export default function ApplicationLayout({ children }: { children: ReactNode }) {
  const { setApp } = useAppContext();
  const p = useParams<{ appId: string }>();
  const appId = typeof p.appId === "string" ? p.appId : Array.isArray(p.appId) ? p.appId[0] : "";

  useLayoutEffect(() => {
    if (appId) setApp(appId);
  }, [appId, setApp]);

  return <>{children}</>;
}
