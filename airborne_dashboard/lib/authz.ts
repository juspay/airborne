import { apiFetch } from "@/lib/api";

export type AuthzScope = "org" | "app" | "auto";

export interface PermissionCatalogItem {
  key: string;
  resource: string;
  action: string;
  scope: AuthzScope;
}

export interface PermissionCatalogResponse {
  permissions: PermissionCatalogItem[];
}

export interface PermissionCheckRequest {
  resource: string;
  action: string;
  scope?: AuthzScope;
}

export interface PermissionCheckResult {
  key: string;
  resource: string;
  action: string;
  scope: AuthzScope;
  allowed: boolean;
}

export interface EnforceBatchResponse {
  results: PermissionCheckResult[];
}

export async function fetchPermissionCatalog(
  ctx: { token?: string | null; org?: string | null; app?: string | null },
  scope?: AuthzScope
): Promise<PermissionCatalogResponse> {
  return apiFetch<PermissionCatalogResponse>("/authz/catalog", { query: { scope } }, ctx);
}

export async function enforcePermissionsBatch(
  ctx: { token?: string | null; org?: string | null; app?: string | null },
  checks: PermissionCheckRequest[]
): Promise<EnforceBatchResponse> {
  return apiFetch<EnforceBatchResponse>(
    "/authz/me/enforce-batch",
    { method: "POST", body: { checks }, showErrorToast: false },
    ctx
  );
}

export function toPermissionDecisionMap(results: PermissionCheckResult[]): Record<string, boolean> {
  const output: Record<string, boolean> = {};
  for (const entry of results) {
    output[`${entry.scope}:${entry.key}`] = entry.allowed;
  }
  return output;
}
