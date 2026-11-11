"use client";

import Link from "next/link";
import { Button } from "@/components/ui/button";
import { useAppContext } from "@/providers/app-context";
import { scopedHref } from "@/lib/control-center/scope";

/**
 * Where to go from a scope that was not found. When the organisation in it is real, the way back is that
 * organisation (the main button); showing everything is always there too. When the organisation is not real either,
 * showing everything is the only way back.
 */
export function NotFoundActions({ org, base }: { org?: string; base: string }) {
  const { organisations } = useAppContext();
  const orgValid = Boolean(org) && organisations.some((o) => o.name === org);
  return (
    <div className="flex flex-wrap items-center justify-center gap-2">
      {orgValid && org && (
        <Button asChild variant="outline" size="sm">
          <Link href={scopedHref(base, { org })}>Back to {org}</Link>
        </Button>
      )}
      <Button asChild variant={orgValid ? "ghost" : "outline"} size="sm">
        <Link href={base}>Show all organisations</Link>
      </Button>
    </div>
  );
}
