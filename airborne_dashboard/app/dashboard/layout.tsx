"use client";

import type { ReactNode } from "react";
import { Suspense, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAppContext } from "@/providers/app-context";
import SharedLayout from "@/components/shared-layout";

export default function DashboardLayout({ children }: { children: ReactNode }) {
  const { loading, token } = useAppContext();
  const router = useRouter();

  useEffect(() => {
    if (!token && !loading) router.replace("/login");
  }, [token, loading]);

  if (!token) return null;

  return (
    // useSearchParams (the scope) reads the URL on the client; the boundary keeps static pages buildable.
    <Suspense fallback={null}>
      <SharedLayout>
        <div className="bg-background">{children}</div>
      </SharedLayout>
    </Suspense>
  );
}
