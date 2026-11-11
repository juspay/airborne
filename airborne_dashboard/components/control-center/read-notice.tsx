import { AlertTriangle } from "lucide-react";
import type { OverviewOrganisation } from "@/lib/control-center/types";
import { ErrorState } from "./states";

/**
 * An organisation whose read was cut short says so where its applications are listed. A shorter list is not a quieter
 * organisation: a missing application could be the one that is failing.
 */
export function OrgReadNotice({ org }: { org: OverviewOrganisation }) {
  if (!org.authorization_error && !org.groups_error) return null;
  return (
    <p
      role="status"
      className="flex items-start gap-2 rounded-md border border-amber-500/30 bg-amber-500/5 px-3 py-2 text-xs text-amber-900 dark:text-amber-200"
    >
      <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden />
      <span>
        {org.authorization_error
          ? `Some applications in ${org.name} may be missing: a permission check did not finish. Refresh before relying on this list.`
          : `Groups in ${org.name} could not be read, so applications may be listed as ungrouped. Refresh before relying on this list.`}
      </span>
    </p>
  );
}

/**
 * What a page shows when the read that would have listed its contents was cut short and nothing came back: the notices
 * and Retry, and nothing else. No count, empty state or checklist is drawn from a read that did not finish, because
 * each of them would contradict the notice.
 */
export function UnconfirmedRead({
  orgs,
  title,
  message,
  onRetry,
}: {
  orgs: OverviewOrganisation[];
  title: string;
  message: string;
  onRetry: () => void;
}) {
  return (
    <>
      {orgs.map((o) => (
        <OrgReadNotice key={o.name} org={o} />
      ))}
      <ErrorState title={title} message={message} onRetry={onRetry} />
    </>
  );
}
