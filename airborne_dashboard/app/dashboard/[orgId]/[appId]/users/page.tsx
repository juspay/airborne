"use client";
import { useParams } from "next/navigation";
import useSWR from "swr";
import { apiFetch } from "@/lib/api";
import { useAppContext } from "@/providers/app-context";
import {
  UserManagement,
  type AccessLevel,
  type PermissionOption,
  type RoleOption,
  type User,
} from "@/components/user-management";
import { definePagePermissions, permission } from "@/lib/page-permissions";
import { usePagePermissions } from "@/hooks/use-page-permissions";

type OrgUsers = { users: User[] };
type RoleListResponse = { roles: RoleOption[] };
type PermissionListResponse = { permissions: PermissionOption[] };

const PAGE_AUTHZ = definePagePermissions({
  read_users: permission("application_user", "read", "app"),
  create_user: permission("application_user", "create", "app"),
  update_user: permission("application_user", "update", "app"),
  delete_user: permission("application_user", "delete", "app"),
  read_roles: permission("application_role", "read", "app"),
  create_roles: permission("application_role", "create", "app"),
});

export default function ApplicationUsersPage() {
  const { token, org, app: contextApp, updateOrgs } = useAppContext();
  // The address names the application. The context only learns it a moment after load, and a request sent before
  // that goes out without `x-application` and is refused, so the page never asks until it knows which one.
  const routeApp = useParams<{ appId?: string }>()?.appId;
  const app = routeApp ? decodeURIComponent(routeApp) : contextApp;
  const permissions = usePagePermissions(PAGE_AUTHZ);
  const canReadRoles = permissions.can("read_roles");
  const canCreateRoles = permissions.can("create_roles");
  const { data, error, mutate } = useSWR<OrgUsers>(
    token && org && app ? ["/organisations/applications/user/list", org, app] : null,
    ([url]: [string, string, string]) => apiFetch<any>(url, {}, { token, org, app })
  );
  const { data: roleData, mutate: mutateRoles } = useSWR<RoleListResponse>(
    token && org && app && canReadRoles ? ["/organisations/applications/user/roles/list", org, app] : null,
    ([url]: [string, string, string]) => apiFetch<RoleListResponse>(url, {}, { token, org, app })
  );
  const { data: permissionData } = useSWR<PermissionListResponse>(
    token && org && app && canReadRoles ? ["/organisations/applications/user/permissions/list", org, app] : null,
    ([url]: [string, string, string]) => apiFetch<PermissionListResponse>(url, {}, { token, org, app })
  );
  const { data: orgUsersData } = useSWR<OrgUsers>(token && org ? "/organisations/user/list" : null, (url: string) =>
    apiFetch<OrgUsers>(url, {}, { token, org })
  );

  const addUser = async (user: string, access: AccessLevel) => {
    await apiFetch(
      "/organisations/applications/user/create",
      { method: "POST", body: { user, access } },
      { token, org, app }
    );
    mutate();
    updateOrgs();
  };

  const updateUser = async (user: string, access: AccessLevel) => {
    await apiFetch(
      "/organisations/applications/user/update",
      { method: "POST", body: { user, access } },
      { token, org, app }
    );
    mutate();
    updateOrgs();
  };

  const removeUser = async (user: string) => {
    await apiFetch("/organisations/applications/user/remove", { method: "POST", body: { user } }, { token, org, app });
    mutate();
    updateOrgs();
  };

  const upsertRole = async (role: string, permissions: string[]) => {
    await apiFetch(
      "/organisations/applications/user/roles/upsert",
      { method: "POST", body: { role, permissions } },
      { token, org, app }
    );
    mutateRoles();
  };

  if (error) {
    return <div className="p-6">Error loading users</div>;
  }

  if (permissions.isReady && !permissions.can("read_users")) {
    return <div className="p-6">You do not have permission to view application users.</div>;
  }

  return (
    <div className="container mx-auto p-6">
      <UserManagement
        users={data?.users || []}
        canAddUser={permissions.can("create_user")}
        canUpdateUser={permissions.can("update_user")}
        canRemoveUser={permissions.can("delete_user")}
        canManageRoles={canCreateRoles}
        onAddUser={addUser}
        onUpdateUser={updateUser}
        onRemoveUser={removeUser}
        onCreateRole={canCreateRoles ? upsertRole : undefined}
        roles={roleData?.roles || []}
        availablePermissions={permissionData?.permissions || []}
        availableUsers={orgUsersData?.users?.map((user) => user.username) || []}
        title="Application Users"
        description="Manage users and their access levels for this application"
        entityType="application"
      />
    </div>
  );
}
