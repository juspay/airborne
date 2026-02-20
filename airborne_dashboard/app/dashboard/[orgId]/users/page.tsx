"use client";
import { useState } from "react";
import useSWR from "swr";
import { apiFetch } from "@/lib/api";
import { listInvites, revokeInvite } from "@/lib/invitation";
import { useAppContext } from "@/providers/app-context";
import { UserManagement, type AccessLevel, type User } from "@/components/user-management";
import { InviteManagement } from "@/components/invite-management";
import { OrganizationAccessModal } from "@/components/organization-access-modal";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Users, Mail, UserPlus } from "lucide-react";
import { toastSuccess, toastError } from "@/hooks/use-toast";

type OrgUsers = { users: User[] };

export default function OrganisationUsersPage() {
  const { token, org, getOrgAccess, updateOrgs, organisations, config } = useAppContext();
  const [activeTab, setActiveTab] = useState("users");
  const [isOrgAccessModalOpen, setIsOrgAccessModalOpen] = useState(false);

  // Get applications for the current organization
  const currentOrgData = organisations.find((o) => o.name === org);
  const availableApplications =
    currentOrgData?.applications.map((app) => ({
      id: app.application,
      name: app.application,
      description: `Application: ${app.application}`,
    })) || [];

  // Invitation state
  const [inviteSearchTerm, setInviteSearchTerm] = useState("");
  const [inviteStatusFilter, setInviteStatusFilter] = useState("all");
  const [invitePage, setInvitePage] = useState(1);
  const [inviteLimit] = useState(10);

  // Users data
  const {
    data: usersData,
    isLoading: usersLoading,
    error: usersError,
    mutate: mutateUsers,
  } = useSWR<OrgUsers>(token && org ? "/organisations/user/list" : null, (url: string) =>
    apiFetch<any>(url, {}, { token, org })
  );

  // Invitations data with pagination and filters
  const {
    data: invitesData,
    isLoading: invitesLoading,
    error: invitesError,
    mutate: mutateInvites,
  } = useSWR(
    token && org ? `invites-${org}-${invitePage}-${inviteLimit}-${inviteSearchTerm}-${inviteStatusFilter}` : null,
    () =>
      listInvites(token!, org!, {
        page: invitePage,
        per_page: inviteLimit,
        search: inviteSearchTerm || undefined,
        status: inviteStatusFilter !== "all" ? inviteStatusFilter : undefined,
      }),
    {
      refreshInterval: 30000, // Refresh every 30 seconds
    }
  );

  const addUser = async (user: string, access: AccessLevel) => {
    await apiFetch("/organisations/user/invite", { method: "POST", body: { user, access } }, { token, org });
    mutateUsers();
    updateOrgs();
  };

  const updateUser = async (user: string, access: AccessLevel) => {
    await apiFetch("/organisations/user/update", { method: "POST", body: { user, access } }, { token, org });
    mutateUsers();
    updateOrgs();
  };

  const removeUser = async (user: string) => {
    await apiFetch("/organisations/user/remove", { method: "POST", body: { user } }, { token, org });
    mutateUsers();
    updateOrgs();
  };

  const transferOwnership = async (user: string) => {
    await apiFetch("/organisations/user/transfer-ownership", { method: "POST", body: { user } }, { token, org });
    mutateUsers();
    updateOrgs();
  };

  const handleRevokeInvite = async (inviteId: string) => {
    try {
      await revokeInvite(inviteId, token!, org!);
      toastSuccess("Invitation Revoked", "The invitation has been successfully revoked");
      mutateInvites();
    } catch (error: any) {
      toastError("Failed to Revoke", error.message || "Could not revoke the invitation");
    }
  };

  // Handle invitation search with debouncing
  const handleInviteSearchChange = (search: string) => {
    setInviteSearchTerm(search);
    setInvitePage(1); // Reset to first page when searching
  };

  // Handle status filter change
  const handleInviteStatusFilterChange = (status: string) => {
    setInviteStatusFilter(status);
    setInvitePage(1); // Reset to first page when filtering
  };

  // Handle page change
  const handleInvitePageChange = (page: number) => {
    setInvitePage(page);
  };

  // Handle organization invites (new functionality)
  const handleOrganizationInvite = async (invite: {
    email: string;
    orgRole: string;
    applications: { name: string; level: string }[];
  }) => {
    try {
      // Call the invite API with applications field matching backend structure
      await apiFetch(
        config?.organisation_invite_enabled ? "/organisations/user/invite" : "/organisations/user/create",
        {
          method: "POST",
          body: {
            user: invite.email,
            access: invite.orgRole as AccessLevel,
            applications: invite.applications, // ApplicationAccess array with name and level
          },
        },
        { token, org }
      );

      toastSuccess(
        config?.organisation_invite_enabled ? "User Invited" : "User Added",
        `Successfully ${config?.organisation_invite_enabled ? "invited" : "added"} ${invite.email} to the organization with access to ${invite.applications.length} application${invite.applications.length !== 1 ? "s" : ""}`
      );

      setIsOrgAccessModalOpen(false); // Close the modal
      mutateUsers(); // Refresh the users list
      mutateInvites(); // Refresh the invites list
      updateOrgs(); // Update organizations data
    } catch (error: any) {
      console.error(`Failed to ${config?.organisation_invite_enabled ? "invite" : "add"} user to organization:`, error);
      toastError(
        `Failed to ${config?.organisation_invite_enabled ? "invite" : "add"} User`,
        error.message ||
          `Could not ${config?.organisation_invite_enabled ? "invite" : "add"} the user to the organization`
      );
    }
  };

  // Check user permissions
  const currentUserAccess = getOrgAccess(org);
  const canManageInvites = currentUserAccess.includes("admin") || currentUserAccess.includes("owner");

  if (usersLoading) {
    return <div className="p-6">Loading...</div>;
  }

  if (usersError) {
    return <div className="p-6">Error loading users</div>;
  }

  return (
    <div className="container mx-auto p-6 space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold font-[family-name:var(--font-space-grotesk)]">Organization Management</h1>
        <p className="text-muted-foreground">Manage users, roles, and invitations for your organization</p>
      </div>

      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <TabsList
          className={`grid w-full grid-cols-2 lg:w-[400px] ${!config?.organisation_invite_enabled ? "hidden" : ""}`}
        >
          <TabsTrigger value="users" className="flex items-center gap-2">
            <Users className="h-4 w-4" />
            Users
            {usersData?.users && usersData.users.length > 0 && (
              <span className="ml-1 text-xs bg-blue-100 text-blue-800 px-2 py-0.5 rounded-full font-medium">
                {usersData.users.length}
              </span>
            )}
          </TabsTrigger>
          {config?.organisation_invite_enabled && (
            <TabsTrigger value="invitations" className="flex items-center gap-2">
              <Mail className="h-4 w-4" />
              Invitations
              {invitesData?.pagination && invitesData.pagination.total_items > 0 && (
                <span className="ml-1 text-xs bg-blue-100 text-blue-800 px-2 py-0.5 rounded-full font-medium">
                  {invitesData.pagination.total_items}
                </span>
              )}
            </TabsTrigger>
          )}
        </TabsList>

        <TabsContent value="users" className="mt-6">
          {usersLoading ? (
            <>Loading...</>
          ) : usersError ? (
            <Card>
              <CardContent className="pt-6">
                <div className="text-center text-muted-foreground">Error loading users. Please try again.</div>
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-6">
              {/* Invite to Organization Section */}
              {canManageInvites && (
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <UserPlus className="h-5 w-5" />
                      Add New Users
                    </CardTitle>
                    <CardDescription>Add new users to this organization with application access</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <Button onClick={() => setIsOrgAccessModalOpen(true)}>
                      <UserPlus className="h-4 w-4 mr-2" />
                      Add User to Organisation
                    </Button>
                  </CardContent>
                </Card>
              )}

              {/* Organization Users Management */}
              <UserManagement
                users={usersData?.users || []}
                currentUserOrgAccess={currentUserAccess}
                onAddUser={addUser}
                onUpdateUser={updateUser}
                onRemoveUser={removeUser}
                onTransferOwnership={transferOwnership}
                onInviteCreated={() => mutateInvites()}
                title="Organization Users"
                description="Manage users and their access levels for this organization"
                entityType="organisation"
                hideAddUserButton={true}
              />
            </div>
          )}
        </TabsContent>

        {config?.organisation_invite_enabled && (
          <TabsContent value="invitations" className="mt-6">
            {!canManageInvites ? (
              <Card>
                <CardHeader>
                  <CardTitle>Access Restricted</CardTitle>
                  <CardDescription>You need admin or owner permissions to manage invitations.</CardDescription>
                </CardHeader>
              </Card>
            ) : invitesLoading ? (
              <Card>
                <CardContent className="pt-6">
                  <div className="text-center text-muted-foreground">Loading invitations...</div>
                </CardContent>
              </Card>
            ) : invitesError ? (
              <Card>
                <CardContent className="pt-6">
                  <div className="text-center text-muted-foreground">Error loading invitations. Please try again.</div>
                </CardContent>
              </Card>
            ) : (
              <InviteManagement
                data={invitesData}
                onRevokeInvite={handleRevokeInvite}
                onRefresh={() => mutateInvites()}
                onSearchChange={handleInviteSearchChange}
                onStatusFilterChange={handleInviteStatusFilterChange}
                onPageChange={handleInvitePageChange}
                searchTerm={inviteSearchTerm}
                statusFilter={inviteStatusFilter}
                isLoading={invitesLoading}
                showInviteButtons={false}
                entityType="organization"
                organizationName={org || ""}
                applications={availableApplications}
              />
            )}
          </TabsContent>
        )}
      </Tabs>

      {/* Organization Access Modal */}
      <OrganizationAccessModal
        isOpen={isOrgAccessModalOpen}
        onClose={() => setIsOrgAccessModalOpen(false)}
        onSubmit={handleOrganizationInvite}
        applications={availableApplications}
        organizationName={org || ""}
      />
    </div>
  );
}
