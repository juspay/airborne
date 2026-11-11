import type { AppStatus } from "@/lib/control-center/types";
import { overviewStateWarning } from "@/lib/control-center/overview-state";

export function OverviewStateNotice({ app }: { app: AppStatus | null | undefined }) {
  const warning = overviewStateWarning(app);
  if (!warning) return null;
  return (
    <div role="alert" className="md:col-span-4 rounded-md border border-amber-500/40 bg-amber-500/5 p-3 text-sm">
      {warning}
    </div>
  );
}
