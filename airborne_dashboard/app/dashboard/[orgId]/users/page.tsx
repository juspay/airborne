"use client";
import useSWR from "swr";
import { apiFetch } from "@/lib/api";
import { useAppContext } from "@/providers/app-context";
import UsersLoading from "@/app/users/loading";
import { UserManagement, type AccessLevel, type User } from "@/components/user-management";

type OrgUsers = { users: User[] };

export default function OrganisationUsersPage() {
  const { token, org, getOrgAccess, updateOrgs } = useAppContext();
  const { data, isLoading, error, mutate } = useSWR<OrgUsers>(
    token && org ? "/organisations/user/list" : null,
    (url: string) => apiFetch<any>(url, {}, { token, org })
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

  if (isLoading) {
    return <UsersLoading />;
  }

  if (error) {
    return <div className="p-6">Error loading users</div>;
  }

  return (
    <div className="container mx-auto p-6">
      <UserManagement
        users={data?.users || []}
        currentUserOrgAccess={getOrgAccess(org)}
        onAddUser={addUser}
        onUpdateUser={updateUser}
        onRemoveUser={removeUser}
        onTransferOwnership={transferOwnership}
        title="Organisation Users"
        description="Manage users and their access levels for this organisation"
        entityType="organisation"
      />
    </div>
  );
}
