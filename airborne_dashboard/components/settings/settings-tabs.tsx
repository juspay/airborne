"use client";

import type React from "react";
import Link from "next/link";
import { useParams, usePathname } from "next/navigation";
import { ShieldCheck } from "lucide-react";

import { cn } from "@/lib/utils";

type SettingsTab = {
  /** Route segment under `/settings`, and the folder name of its `page.tsx`. */
  segment: string;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
};

/**
 * The sections of Settings. Adding a section is a one-line change here plus a
 * matching `settings/<segment>/page.tsx` route.
 */
const SETTINGS_TABS: SettingsTab[] = [{ segment: "integrity", label: "Integrity", icon: ShieldCheck }];

const normalize = (value: string) => value.replace(/\/+$/, ""); // strip trailing slash

export function SettingsTabs() {
  const pathname = usePathname();
  const params = useParams<{ orgId: string; appId: string }>();

  const basePath = `/dashboard/${encodeURIComponent(params.orgId)}/${encodeURIComponent(params.appId)}/settings`;
  const tabs = SETTINGS_TABS.map((tab) => ({ ...tab, href: `${basePath}/${tab.segment}` }));

  // Longest-prefix active matching, same idea as the sidebar in shared-layout.
  const current = normalize(pathname);
  const matches = tabs.filter((tab) => {
    const href = normalize(tab.href);
    return current === href || current.startsWith(href + "/");
  });
  const activeHref =
    matches.length > 0 ? matches.reduce((best, tab) => (tab.href.length > best.href.length ? tab : best)).href : null;

  return (
    <nav aria-label="Settings sections" className="flex items-center gap-1 border-b border-border">
      {tabs.map((tab) => {
        const Icon = tab.icon;
        const active = normalize(tab.href) === activeHref;

        return (
          <Link
            key={tab.href}
            href={tab.href}
            aria-current={active ? "page" : undefined}
            className={cn(
              "-mb-px flex items-center gap-2 border-b-2 px-3 py-2 text-sm font-medium transition-colors",
              active
                ? "border-primary text-foreground"
                : "border-transparent text-muted-foreground hover:border-border hover:text-foreground"
            )}
          >
            <Icon className="h-4 w-4" />
            {tab.label}
          </Link>
        );
      })}
    </nav>
  );
}
