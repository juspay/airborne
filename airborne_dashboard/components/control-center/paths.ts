export const CC_ROOT = "/dashboard/control-center";

export function groupPath(org: string, groupId: string): string {
  return `${CC_ROOT}/${encodeURIComponent(org)}/groups/${encodeURIComponent(groupId)}`;
}

/** The application's own Control Center page: serving policy, approvals, live and rolling-out state. */
export function appPath(org: string, app: string): string {
  return `${CC_ROOT}/${encodeURIComponent(org)}/apps/${encodeURIComponent(app)}`;
}

export function releasePath(org: string, app: string, releaseId: string): string {
  return `${CC_ROOT}/${encodeURIComponent(org)}/apps/${encodeURIComponent(app)}/releases/${encodeURIComponent(releaseId)}`;
}

export function classicAppPath(org: string, app: string): string {
  return `/dashboard/${encodeURIComponent(org)}/${encodeURIComponent(app)}/releases`;
}

export function classicReleasePath(org: string, app: string, releaseId: string): string {
  return `/dashboard/${encodeURIComponent(org)}/${encodeURIComponent(app)}/releases/${encodeURIComponent(releaseId)}`;
}

export function classicNewReleasePath(org: string, app: string): string {
  return `/dashboard/${encodeURIComponent(org)}/${encodeURIComponent(app)}/releases/create`;
}

/** The organisation-wide approval queue. */
export const APPROVALS_PATH = `${CC_ROOT}/approvals`;

export function requestPath(org: string, app: string, requestId: string): string {
  return `${CC_ROOT}/${encodeURIComponent(org)}/apps/${encodeURIComponent(app)}/requests/${encodeURIComponent(requestId)}`;
}

export function approvalPolicyPath(org: string, app: string): string {
  return `${CC_ROOT}/${encodeURIComponent(org)}/apps/${encodeURIComponent(app)}/approval-policy`;
}

/** Applications page includes the permissioned Create application dialog. */
export function createAppPath(org: string): string {
  return `/dashboard/${encodeURIComponent(org)}`;
}
