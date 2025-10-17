"use client";
import useSWR from "swr";
import { apiFetch } from "@/lib/api";
import { useAppContext } from "@/providers/app-context";
import { UserManagement, type AccessLevel, type User } from "@/components/user-management";

type OrgUsers = { users: User[] };

export default function ApplicationUsersPage() {
  const { token, org, app, getAppAccess, getOrgAccess, updateOrgs } = useAppContext();
  const { data, error, mutate } = useSWR<OrgUsers>(
    token && org ? "/organisations/applications/user/list" : null,
    (url: string) => apiFetch<any>(url, {}, { token, org, app })
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

  if (error) {
    return <div className="p-6">Error loading users</div>;
  }

  return (
    <div className="container mx-auto p-6">
      <UserManagement
        users={data?.users || []}
        currentUserAppAccess={getAppAccess(org, app)}
        currentUserOrgAccess={getOrgAccess(org)}
        onAddUser={addUser}
        onUpdateUser={updateUser}
        onRemoveUser={removeUser}
        title="Application Users"
        description="Manage users and their access levels for this application"
        entityType="application"
      />
    </div>
  );
}
