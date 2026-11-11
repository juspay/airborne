// The words of the rollback dialogs: what changes for devices and when, in the order a frightened person reads them.
// Kept out of the component so the claims can be checked: nothing here says devices recovered.

import type { Platform, RollbackAction } from "./types";

/** When devices move. Devices poll for a release; one that already runs the bad package only changes after that. */
export function whenDevicesMove(to: string): string {
  return `Devices get ${to} on their next update check. A device already running the bad release switches after that check, and may need an app restart.`;
}

/** "v1", or what to call a package that is not numbered (the bundled code, or one the preview did not name). */
function pkgName(version: number | null | undefined, fallback: string): string {
  if (version === undefined || version === null) return fallback;
  return version === 0 ? "the code bundled in the app" : `v${version}`;
}

/** The first sentence of a rollback dialog: who ends up on what. */
export function rollbackHeadline(action: RollbackAction | null, to: number | null | undefined): string {
  if (action === "discarded") return "This release is discarded before it starts. Nothing changes for devices.";
  const target = pkgName(to, "the previous release");
  return `Everyone in reach returns to ${target}.`;
}

/** What the server does, and when devices notice, for a rollback somebody is about to confirm. */
export function rollbackDirectBody(action: RollbackAction | null, from: number, to: number | null | undefined): string {
  const when = whenDevicesMove(pkgName(to, "the previous release"));
  switch (action) {
    case "discarded":
      return "";
    case "rereleased":
      return `Airborne makes a new release of ${pkgName(to, "the previous package")} for the same reach and makes it live, replacing v${from}, then checks that it took full effect. ${when} This cannot be resumed.`;
    case "concluded_control":
      return `v${from} stops being offered straight away. ${when} This cannot be resumed; to try v${from} again, create a new release.`;
    default:
      return "";
  }
}

/** The same, for a request that waits for a checker. Nothing changes until they approve. */
export function rollbackRequestBody(action: RollbackAction | null, to: number | null | undefined): string {
  const target = pkgName(to, "the previous release");
  switch (action) {
    case "discarded":
      return "Nothing changes now. The release is discarded when a different checker approves.";
    default:
      return `Nothing changes now. When a different checker approves, everyone in reach returns to ${target}. ${whenDevicesMove(target)}`;
  }
}

/** What the person did, in words that name the effect rather than the server's enum. */
export function rollbackActionLabel(action: RollbackAction | string | null | undefined): string {
  switch (action) {
    case "rereleased":
      return "Re-released the previous package as a new release";
    case "concluded_control":
      return "Returned traffic to the live package";
    case "discarded":
      return "Discarded before it started";
    default:
      return "Rolled back";
  }
}

/** The result line. A rollback changes what the server serves; whether devices booted it is a separate fact. */
export function serverNowServes(version: number | null | undefined): string {
  if (version === undefined || version === null) return "Server now serves the previous release.";
  return version === 0 ? "Server now serves the code bundled in the app." : `Server now serves v${version}.`;
}

export const DEVICE_BOOT_UNCONFIRMED = "Device boot unconfirmed.";

/** One line to prefill the reason box from the flag. The person edits or replaces it. */
export function reasonFromFlag(flag: {
  status: "seems_bad" | "suspicious_reports";
  failureRate: number | undefined;
  row: { package_version: number | string; boot_started: number; platform: string };
}): string {
  const pct = flag.failureRate === undefined ? null : `${Math.round(flag.failureRate * 100)}%`;
  const platform = { ios: "iOS ", web: "Web ", android: "Android " }[flag.row.platform] ?? "";
  const where = `${flag.row.boot_started} ${platform}device${flag.row.boot_started === 1 ? "" : "s"}`;
  const v = `v${flag.row.package_version}`;
  return pct === null
    ? `Boot failures reported on ${v} (${where}; unverified reports).`
    : flag.status === "seems_bad"
      ? `${pct} of ${where} failed a boot on ${v} (unverified reports).`
      : `Failures up on ${v}: ${pct} of ${where} failed a boot (unverified reports).`;
}

/** An example for the reason box that fits the application, not an Android phone on a web app. */
export function reasonPlaceholder(platform: Platform | null, emergency: boolean): string {
  if (emergency) return "e.g. payments failing for everyone since 02:10, see INC-4821; no second checker awake";
  switch (platform) {
    case "android":
      return "e.g. crash on launch for Android 14 reported in #incidents";
    case "ios":
      return "e.g. crash on launch on iOS 17 reported in #incidents";
    case "web":
      return "e.g. the checkout page fails to load after this release, reported in #incidents";
    default:
      return "e.g. crashes on launch, reported in #incidents";
  }
}
