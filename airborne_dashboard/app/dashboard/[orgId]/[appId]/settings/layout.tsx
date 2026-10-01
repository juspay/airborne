import type { ReactNode } from "react";

import { SettingsTabs } from "@/components/settings/settings-tabs";

export default function SettingsLayout({ children }: { children: ReactNode }) {
  return (
    <div className="container mx-auto p-6">
      <div className="mb-6">
        <h1 className="text-3xl font-bold font-[family-name:var(--font-space-grotesk)] text-balance">Settings</h1>
        <p className="text-muted-foreground mt-2">Configure how this application is secured and delivered</p>
      </div>

      <SettingsTabs />

      <div className="mt-6">{children}</div>
    </div>
  );
}
