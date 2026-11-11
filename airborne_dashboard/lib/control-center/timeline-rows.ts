// Which events of a release timeline are rows. A request leaves several events (requested, approved, executed) but
// is one thing to read: its row is the request and where it stands now.

import type { ReleaseEvent, ReleaseEventAction } from "./types";

/** The request status each request event leaves the request in. */
export const REQUEST_EVENT_STATUS: Partial<Record<ReleaseEventAction, string>> = {
  requested: "pending",
  approved: "executing",
  executed: "executed",
  failed: "failed",
  rejected: "rejected",
  cancelled: "cancelled",
  expired: "expired",
  stale: "stale",
};

/** The id of the request an event belongs to, or null for any other event. */
export function requestIdOf(ev: ReleaseEvent): string | null {
  const id = ev.payload?.id;
  return REQUEST_EVENT_STATUS[ev.action] && typeof id === "string" && id ? id : null;
}

/** Newest first in, newest first out: keeps the newest event of each request and drops its older ones. */
export function oneRowPerRequest(newestFirst: ReleaseEvent[]): ReleaseEvent[] {
  const seen = new Set<string>();
  return newestFirst.filter((ev) => {
    const id = requestIdOf(ev);
    if (!id) return true;
    if (seen.has(id)) return false;
    seen.add(id);
    return true;
  });
}
