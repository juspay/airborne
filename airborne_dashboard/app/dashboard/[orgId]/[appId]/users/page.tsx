"use client";
import { useState } from "react";
import useSWR from "swr";
import { apiFetch } from "@/lib/api";
import { useAppContext } from "@/providers/app-context";
import { canUpdateUsers, UserManagement, type AccessLevel, type User } from "@/components/user-management";
import { ApplicationAccessModal } from "@/components/application-access-modal";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Users, Building2 } from "lucide-react";
import { toastSuccess, toastError } from "@/hooks/use-toast";
import { useRouter } from "next/navigation";

type OrgUsers = { users: User[] };

export default function ApplicationUsersPage() {
  const { token, org, app, getAppAccess, getOrgAccess, updateOrgs } = useAppContext();
  const router = useRouter();
  const [isAppAccessModalOpen, setIsAppAccessModalOpen] = useState(false);

  // Application users data
  const { data, isLoading, error, mutate } = useSWR<OrgUsers>(
    token && org ? "/organisations/applications/user/list" : null,
    (url: string) => apiFetch<any>(url, {}, { token, org, app })
  );

  // Organization users data (for the application access modal)
  const { data: orgUsersData, isLoading: orgUsersLoading } = useSWR<OrgUsers>(
    token && org ? "/organisations/user/list" : null,
    (url: string) => apiFetch<any>(url, {}, { token, org })
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

  // Handle application access invites (grant access to existing org users)
  const handleApplicationInvite = async (invites: { userId: string; role: string }[]) => {
    try {
      // Call the API for each user in parallel
      const promises = invites.map((invite) =>
        apiFetch(
          "/organisations/applications/user/create",
          {
            method: "POST",
            body: {
              user: invite.userId,
              access: invite.role as AccessLevel,
            },
          },
          { token, org, app }
        )
      );

      const results = await Promise.allSettled(promises);
      const failures = results.filter((r) => r.status === "rejected");
      const successes = results.filter((r) => r.status === "fulfilled");

      if (failures.length === 0) {
        toastSuccess(
          "Access Granted",
          `Successfully granted ${app} access to ${invites.length} user${invites.length !== 1 ? "s" : ""}`
        );
      } else if (successes.length > 0) {
        toastError("Partial Success", `Granted access to ${successes.length} user(s), but ${failures.length} failed`);
      } else {
        throw new Error("All access grants failed");
      }

      setIsAppAccessModalOpen(false); // Close the modal
      mutate(); // Refresh the users list
      updateOrgs(); // Update organizations data
    } catch (error: any) {
      console.error("Failed to grant application access:", error);
      toastError("Failed to Grant Access", error.message || "Could not grant application access");
    }
  };

  // Handle redirect to organization users page
  const handleRedirectToOrgUsers = () => {
    router.push(`/dashboard/${org}/users`);
  };

  if (isLoading) {
    return (
      <>
        <div className="p-6">Loading users...</div>
      </>
    );
  }

  if (error) {
    return <div className="p-6">Error loading users</div>;
  }

  // Prepare org users for the application access modal (exclude users already in app)
  const currentAppUsernames = new Set((data?.users || []).map((user) => user.username));
  const orgUsers =
    orgUsersData?.users
      ?.filter((user) => !currentAppUsernames.has(user.username)) // Filter out existing app users
      ?.map((user) => ({
        id: user.username,
        name: user.username,
        email: user.username, // Assuming username is email for now
        username: user.username,
        roles: user.roles,
      })) || [];

  const canUpdateAppUsers = canUpdateUsers("application", getOrgAccess(org), getAppAccess(org, app));
  const canUpdateOrgUsers = canUpdateUsers("organisation", getOrgAccess(org), getAppAccess(org, app));

  return (
    <div className="container mx-auto p-6 space-y-6">
      {/* Add User to Application Card */}
      {(canUpdateAppUsers || canUpdateOrgUsers) && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Users className="h-5 w-5" />
              Grant Application Access
            </CardTitle>
            <p className="text-sm text-muted-foreground">
              Add existing organization members to this application (excluding current app users)
            </p>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex flex-col sm:flex-row gap-3 sm:justify-start">
              {canUpdateAppUsers && (
                <Button onClick={() => setIsAppAccessModalOpen(true)} size="sm" disabled={orgUsers.length === 0}>
                  <Users className="h-4 w-4 mr-2" />
                  Add User to Application
                </Button>
              )}
              {canUpdateOrgUsers && (
                <Button variant="outline" onClick={handleRedirectToOrgUsers} size="sm">
                  <Building2 className="h-4 w-4 mr-2" />
                  Add someone to organisation
                </Button>
              )}
            </div>
            {canUpdateAppUsers && (
              <p className="text-xs text-muted-foreground">
                {orgUsers.length === 0
                  ? "All organization users already have access to this application. Use 'Add someone to organisation' to invite new users."
                  : `${orgUsers.length} organization member${orgUsers.length !== 1 ? "s" : ""} available to add to this application.`}
              </p>
            )}
          </CardContent>
        </Card>
      )}

      {/* Current Application Users */}
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
        hideAddUserButton={true}
      />

      {/* Application Access Modal */}
      <ApplicationAccessModal
        isOpen={isAppAccessModalOpen}
        onClose={() => setIsAppAccessModalOpen(false)}
        onSubmit={handleApplicationInvite}
        orgUsers={orgUsers}
        applicationName={app || ""}
        availableRoles={["read", "write", "admin"]}
        isLoading={orgUsersLoading}
      />
    </div>
  );
}
