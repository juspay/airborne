import type { AuthzScope, PermissionCheckRequest } from "@/lib/authz";

export type PagePermissionDefinition = PermissionCheckRequest & {
  label?: string;
};

export type PagePermissionMap<K extends string = string> = Record<K, PagePermissionDefinition>;

export function definePagePermissions<K extends string>(permissions: PagePermissionMap<K>): PagePermissionMap<K> {
  return permissions;
}

export function permission(resource: string, action: string, scope: AuthzScope = "auto"): PagePermissionDefinition {
  return { resource, action, scope };
}
