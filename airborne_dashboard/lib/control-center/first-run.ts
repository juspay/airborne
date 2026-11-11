// The first-run checklist, read from what the server reports about an organisation. A step is ticked because
// the overview says it happened, never because someone clicked: an app exists, a device has reported, a release is live.

import { telemetryAvailability, telemetrySummary } from "./telemetry";
import type { AppStatus, OverviewOrganisation } from "./types";

/** `unknown`: the server cannot say (telemetry off or unreadable), so the step is neither ticked nor failed. */
export type StepState = "done" | "next" | "todo" | "unknown";

export interface FirstRunProgress {
  app: StepState;
  device: StepState;
  release: StepState;
  /** Every step done. */
  complete: boolean;
  /** An app to link the later steps to: the first one, or none yet. */
  firstApp: string | undefined;
  firstRelease?: { id: string; version: number };
}

export function orgApps(org: OverviewOrganisation): AppStatus[] {
  return [...org.groups.flatMap((g) => g.members), ...org.ungrouped];
}

/** True when a device has reported anything about any of these apps in the window. */
function deviceSeen(apps: AppStatus[]): boolean {
  return apps.some(
    (a) =>
      Boolean(a.first_device_seen_at) ||
      (telemetrySummary(a.telemetry)?.releases ?? []).some((r) => r.reporting_devices > 0)
  );
}

/** Whether the server can say anything about devices at all: at least one app reports, readably. */
function canSeeDevices(apps: AppStatus[]): boolean {
  return apps.some((a) => {
    const availability = telemetryAvailability(a.telemetry);
    return "first_device_seen_at" in a || availability === "reporting" || availability === "silent";
  });
}

export function firstRunProgress(org: OverviewOrganisation): FirstRunProgress {
  const apps = orgApps(org);
  const hasApp = apps.length > 0;
  const seen = deviceSeen(apps);
  const live = apps.some((a) => a.live.length > 0);
  const raw = {
    app: hasApp ? "done" : "todo",
    device: seen ? "done" : hasApp && !canSeeDevices(apps) ? "unknown" : "todo",
    release: live ? "done" : "todo",
  } as const;
  // The next step is the first one not done, so the person always has one place to go.
  const order = ["app", "device", "release"] as const;
  const nextKey = order.find((k) => raw[k] !== "done");
  const step = (k: (typeof order)[number]): StepState => (k === nextKey && raw[k] !== "unknown" ? "next" : raw[k]);
  return {
    app: step("app"),
    device: step("device"),
    release: step("release"),
    complete: raw.app === "done" && raw.device === "done" && raw.release === "done",
    firstApp: apps[0]?.application,
    firstRelease: apps[0]?.active[0]
      ? { id: apps[0].active[0].release_id, version: apps[0].active[0].package_version }
      : undefined,
  };
}

export type FirstRunMemory = "active" | "dismissed" | null;

/**
 * Whether to draw the checklist. An organisation with a release already live and no memory of ever showing the
 * checklist is established, so it never sees one. A finished checklist is drawn once more, as the finished state,
 * for an organisation that watched it start.
 */
export function firstRunView(progress: FirstRunProgress, memory: FirstRunMemory): "checklist" | "finished" | "none" {
  if (memory === "dismissed") return "none";
  if (progress.complete) return memory === "active" ? "finished" : "none";
  if (progress.release === "done" && memory !== "active") return "none";
  return "checklist";
}
