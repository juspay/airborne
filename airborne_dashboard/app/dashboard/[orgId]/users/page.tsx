"use client";
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
  read_users: permission("organisation_user", "read", "org"),
  create_user: permission("organisation_user", "create", "org"),
  update_user: permission("organisation_user", "update", "org"),
  delete_user: permission("organisation_user", "delete", "org"),
  transfer_ownership: permission("organisation_user", "transfer", "org"),
  read_roles: permission("organisation_role", "read", "org"),
  create_roles: permission("organisation_role", "create", "org"),
});

export default function OrganisationUsersPage() {
  const { token, org, updateOrgs } = useAppContext();
  const permissions = usePagePermissions(PAGE_AUTHZ);
  const canReadRoles = permissions.can("read_roles");
  const canCreateRoles = permissions.can("create_roles");
  const { data, error, mutate } = useSWR<OrgUsers>(token && org ? "/organisations/user/list" : null, (url: string) =>
    apiFetch<any>(url, {}, { token, org })
  );
  const { data: roleData, mutate: mutateRoles } = useSWR<RoleListResponse>(
    token && org && canReadRoles ? "/organisations/user/roles/list" : null,
    (url: string) => apiFetch<RoleListResponse>(url, {}, { token, org })
  );
  const { data: permissionData } = useSWR<PermissionListResponse>(
    token && org && canReadRoles ? "/organisations/user/permissions/list" : null,
    (url: string) => apiFetch<PermissionListResponse>(url, {}, { token, org })
  );

  const addUser = async (user: string, access: AccessLevel) => {
    await apiFetch("/organisations/user/create", { method: "POST", body: { user, access } }, { token, org });
    mutate();
    updateOrgs();
  };

  const updateUser = async (user: string, access: AccessLevel) => {
    await apiFetch("/organisations/user/update", { method: "POST", body: { user, access } }, { token, org });
    mutate();
    updateOrgs();
  };

  const removeUser = async (user: string) => {
    await apiFetch("/organisations/user/remove", { method: "POST", body: { user } }, { token, org });
    mutate();
    updateOrgs();
  };

  const transferOwnership = async (user: string) => {
    await apiFetch("/organisations/user/transfer-ownership", { method: "POST", body: { user } }, { token, org });
    mutate();
    updateOrgs();
  };

  const upsertRole = async (role: string, permissions: string[]) => {
    await apiFetch("/organisations/user/roles/upsert", { method: "POST", body: { role, permissions } }, { token, org });
    mutateRoles();
  };

  if (error) {
    return <div className="p-6">Error loading users</div>;
  }

  if (permissions.isReady && !permissions.can("read_users")) {
    return <div className="p-6">You do not have permission to view organisation users.</div>;
  }

  return (
    <div className="container mx-auto p-6">
      <UserManagement
        users={data?.users || []}
        canAddUser={permissions.can("create_user")}
        canUpdateUser={permissions.can("update_user")}
        canRemoveUser={permissions.can("delete_user")}
        canTransferOwnership={permissions.can("transfer_ownership")}
        canManageRoles={canCreateRoles}
        onAddUser={addUser}
        onUpdateUser={updateUser}
        onRemoveUser={removeUser}
        onTransferOwnership={transferOwnership}
        onCreateRole={canCreateRoles ? upsertRole : undefined}
        roles={roleData?.roles || []}
        availablePermissions={permissionData?.permissions || []}
        title="Organisation Users"
        description="Manage users and their access levels for this organisation"
        entityType="organisation"
      />
    </div>
  );
}
