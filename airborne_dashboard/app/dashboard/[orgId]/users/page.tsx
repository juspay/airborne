"use client";
import React, { useState } from "react";
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
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Bot, Copy, Check, Download, Trash2, Plus, RefreshCw, AlertTriangle } from "lucide-react";
import { toastSuccess } from "@/hooks/use-toast";

type OrgUsers = { users: User[] };
type RoleListResponse = { roles: RoleOption[] };
type PermissionListResponse = { permissions: PermissionOption[] };

interface ServiceAccount {
  client_id: string;
  name: string;
  email: string;
  description: string;
  created_by: string;
  created_at: string;
}

interface ServiceAccountListResponse {
  data: ServiceAccount[];
}

interface CreateServiceAccountResponse {
  client_id: string;
  client_secret: string;
  email: string;
  name: string;
}

interface RotateServiceAccountResponse {
  client_id: string;
  client_secret: string;
}

const PAGE_AUTHZ = definePagePermissions({
  read_users: permission("organisation_user", "read", "org"),
  create_user: permission("organisation_user", "create", "org"),
  update_user: permission("organisation_user", "update", "org"),
  delete_user: permission("organisation_user", "delete", "org"),
  transfer_ownership: permission("organisation_user", "transfer", "org"),
  read_roles: permission("organisation_role", "read", "org"),
  create_roles: permission("organisation_role", "create", "org"),
  create_service_account: permission("service_account", "create", "org"),
  read_service_account: permission("service_account", "read", "org"),
  delete_service_account: permission("service_account", "delete", "org"),
});

function ServiceAccountCredentialsDisplay({
  clientId,
  clientSecret,
  name,
  email,
  organisation,
}: {
  clientId: string;
  clientSecret: string;
  name?: string;
  email?: string;
  organisation?: string;
}) {
  const [copiedField, setCopiedField] = useState<string | null>(null);

  const copyToClipboard = async (value: string, field: string) => {
    await navigator.clipboard.writeText(value);
    setCopiedField(field);
    setTimeout(() => setCopiedField(null), 2000);
  };

  const downloadAsJson = () => {
    const tokenEndpoint = `${window.location.origin}/api/token/issue`;
    const data = {
      type: "service_account",
      name: name || undefined,
      email: email || undefined,
      organisation: organisation || undefined,
      client_id: clientId,
      client_secret: clientSecret,
      token_endpoint: tokenEndpoint,
    };
    const blob = new Blob([JSON.stringify(data, null, 2)], {
      type: "application/json",
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${name || "service-account"}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-4">
      <Alert variant="destructive">
        <AlertTriangle className="h-4 w-4" />
        <AlertDescription>Save the client secret now. It will not be shown again.</AlertDescription>
      </Alert>

      <div className="space-y-3">
        <div>
          <label className="text-sm font-medium text-muted-foreground">Client ID</label>
          <div className="flex items-center gap-2 mt-1">
            <code className="flex-1 rounded bg-muted px-3 py-2 text-sm font-mono break-all">{clientId}</code>
            <Button variant="outline" size="sm" onClick={() => copyToClipboard(clientId, "id")}>
              {copiedField === "id" ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
            </Button>
          </div>
        </div>
        <div>
          <label className="text-sm font-medium text-muted-foreground">Client Secret</label>
          <div className="flex items-center gap-2 mt-1">
            <code className="flex-1 rounded bg-muted px-3 py-2 text-sm font-mono break-all">{clientSecret}</code>
            <Button variant="outline" size="sm" onClick={() => copyToClipboard(clientSecret, "secret")}>
              {copiedField === "secret" ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
            </Button>
          </div>
        </div>
      </div>

      <Button variant="outline" className="w-full" onClick={downloadAsJson}>
        <Download className="h-4 w-4 mr-2" />
        Download as JSON
      </Button>
    </div>
  );
}

function ServiceAccountsSection({
  canCreate,
  canDelete,
  token,
  org,
}: {
  canCreate: boolean;
  canDelete: boolean;
  token: string | null;
  org: string | null;
}) {
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [isRotateDialogOpen, setIsRotateDialogOpen] = useState(false);
  const [newCredentials, setNewCredentials] = useState<CreateServiceAccountResponse | null>(null);
  const [rotatedCredentials, setRotatedCredentials] = useState<RotateServiceAccountResponse | null>(null);
  const [accountToDelete, setAccountToDelete] = useState<ServiceAccount | null>(null);
  const [accountToRotate, setAccountToRotate] = useState<ServiceAccount | null>(null);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [role, setRole] = useState("read");
  const [isCreating, setIsCreating] = useState(false);

  const { data, mutate } = useSWR<ServiceAccountListResponse>(
    token && org ? "/service-accounts" : null,
    (url: string) => apiFetch<ServiceAccountListResponse>(url, {}, { token, org })
  );

  const handleCreate = async () => {
    if (!name.trim()) return;
    setIsCreating(true);
    try {
      const result = await apiFetch<CreateServiceAccountResponse>(
        "/service-accounts",
        { method: "POST", body: { name: name.trim(), description, role } },
        { token, org }
      );
      setNewCredentials(result);
      mutate();
      toastSuccess("Service Account Created", `Service account '${result.name}' created successfully`);
    } catch {
      // Error handled by apiFetch
    } finally {
      setIsCreating(false);
    }
  };

  const handleDelete = async () => {
    if (!accountToDelete) return;
    try {
      await apiFetch(`/service-accounts/${accountToDelete.client_id}`, { method: "DELETE" }, { token, org });
      mutate();
      setIsDeleteDialogOpen(false);
      setAccountToDelete(null);
      toastSuccess("Service Account Deleted", `Service account '${accountToDelete.name}' has been deleted`);
    } catch {
      // Error handled by apiFetch
    }
  };

  const handleRotate = async () => {
    if (!accountToRotate) return;
    try {
      const result = await apiFetch<RotateServiceAccountResponse>(
        `/service-accounts/${accountToRotate.client_id}/rotate`,
        { method: "POST" },
        { token, org }
      );
      setRotatedCredentials(result);
      toastSuccess("Credentials Rotated", `New credentials generated for '${accountToRotate.name}'`);
    } catch {
      // Error handled by apiFetch
    }
  };

  const resetCreateDialog = () => {
    setIsCreateDialogOpen(false);
    setNewCredentials(null);
    setName("");
    setDescription("");
    setRole("read");
  };

  const resetRotateDialog = () => {
    setIsRotateDialogOpen(false);
    setRotatedCredentials(null);
    setAccountToRotate(null);
  };

  const accounts = data?.data ?? [];

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle>Service Accounts</CardTitle>
            <p className="text-sm text-muted-foreground mt-1">
              Manage service accounts for programmatic access to this organisation
            </p>
          </div>
          {canCreate && (
            <Dialog
              open={isCreateDialogOpen}
              onOpenChange={(open) => {
                if (!open) resetCreateDialog();
                else setIsCreateDialogOpen(true);
              }}
            >
              <DialogTrigger asChild>
                <Button>
                  <Plus className="h-4 w-4 mr-2" />
                  Create Service Account
                </Button>
              </DialogTrigger>
              <DialogContent className="max-w-lg">
                <DialogHeader>
                  <DialogTitle>{newCredentials ? "Service Account Created" : "Create Service Account"}</DialogTitle>
                </DialogHeader>

                {newCredentials ? (
                  <div className="space-y-4">
                    <ServiceAccountCredentialsDisplay
                      clientId={newCredentials.client_id}
                      clientSecret={newCredentials.client_secret}
                      name={newCredentials.name}
                      email={newCredentials.email}
                      organisation={org ?? undefined}
                    />
                    <p className="text-sm text-muted-foreground">
                      Email: <code className="text-xs bg-muted px-1 py-0.5 rounded">{newCredentials.email}</code>
                    </p>
                    <div className="flex justify-end">
                      <Button onClick={resetCreateDialog}>Done</Button>
                    </div>
                  </div>
                ) : (
                  <div className="space-y-4">
                    <div>
                      <label className="text-sm font-medium">Name</label>
                      <Input
                        className="mt-2"
                        placeholder="e.g. ci-deploy"
                        value={name}
                        onChange={(e) => setName(e.target.value)}
                      />
                      <p className="text-xs text-muted-foreground mt-1">
                        Lowercase letters, numbers, hyphens, and underscores only
                      </p>
                    </div>
                    <div>
                      <label className="text-sm font-medium">Description (optional)</label>
                      <Input
                        className="mt-2"
                        placeholder="e.g. CI/CD pipeline access"
                        value={description}
                        onChange={(e) => setDescription(e.target.value)}
                      />
                    </div>
                    <div>
                      <label className="text-sm font-medium">Role</label>
                      <Select value={role} onValueChange={setRole}>
                        <SelectTrigger className="mt-2">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="admin">Admin</SelectItem>
                          <SelectItem value="write">Write</SelectItem>
                          <SelectItem value="read">Read</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="flex justify-end gap-2">
                      <Button variant="outline" onClick={resetCreateDialog}>
                        Cancel
                      </Button>
                      <Button onClick={handleCreate} disabled={!name.trim() || isCreating}>
                        {isCreating ? "Creating..." : "Create"}
                      </Button>
                    </div>
                  </div>
                )}
              </DialogContent>
            </Dialog>
          )}
        </div>
      </CardHeader>
      <CardContent>
        <div className="space-y-2">
          {accounts.length === 0 ? (
            <div className="py-8 text-center text-muted-foreground">No service accounts found.</div>
          ) : (
            accounts.map((account) => (
              <div
                key={account.client_id}
                className="flex items-center justify-between rounded-lg border p-4 transition-colors hover:bg-muted/50"
              >
                <div className="flex items-center gap-3">
                  <div className="h-8 w-8 rounded-full bg-orange-100 dark:bg-orange-900 flex items-center justify-center">
                    <Bot className="h-4 w-4 text-orange-600 dark:text-orange-300" />
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <p className="font-medium">{account.name}</p>
                      <Badge
                        variant="outline"
                        className="text-xs bg-orange-50 text-orange-700 border-orange-200 dark:bg-orange-950 dark:text-orange-300 dark:border-orange-800"
                      >
                        Service Account
                      </Badge>
                    </div>
                    <p className="text-xs text-muted-foreground">{account.email}</p>
                    {account.description && (
                      <p className="text-xs text-muted-foreground mt-0.5">{account.description}</p>
                    )}
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <span className="text-xs text-muted-foreground">
                    Created {new Date(account.created_at).toLocaleDateString()}
                  </span>
                  {canCreate && (
                    <Button
                      variant="ghost"
                      size="sm"
                      title="Rotate credentials"
                      onClick={() => {
                        setAccountToRotate(account);
                        setRotatedCredentials(null);
                        setIsRotateDialogOpen(true);
                      }}
                    >
                      <RefreshCw className="h-4 w-4" />
                    </Button>
                  )}
                  {canDelete && (
                    <Button
                      variant="ghost"
                      size="sm"
                      className="text-destructive hover:text-destructive"
                      title="Delete service account"
                      onClick={() => {
                        setAccountToDelete(account);
                        setIsDeleteDialogOpen(true);
                      }}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  )}
                </div>
              </div>
            ))
          )}
        </div>
      </CardContent>

      {/* Delete confirmation dialog */}
      <Dialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete Service Account</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">
              Are you sure you want to delete the service account <strong>{accountToDelete?.name}</strong>? This will
              revoke all access immediately. This action cannot be undone.
            </p>
            <div className="flex justify-end gap-2">
              <Button
                variant="outline"
                onClick={() => {
                  setIsDeleteDialogOpen(false);
                  setAccountToDelete(null);
                }}
              >
                Cancel
              </Button>
              <Button variant="destructive" onClick={handleDelete}>
                <Trash2 className="h-4 w-4 mr-2" />
                Delete
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Rotate credentials dialog */}
      <Dialog
        open={isRotateDialogOpen}
        onOpenChange={(open) => {
          if (!open) resetRotateDialog();
        }}
      >
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>{rotatedCredentials ? "New Credentials" : "Rotate Credentials"}</DialogTitle>
          </DialogHeader>
          {rotatedCredentials ? (
            <div className="space-y-4">
              <ServiceAccountCredentialsDisplay
                clientId={rotatedCredentials.client_id}
                clientSecret={rotatedCredentials.client_secret}
                name={accountToRotate?.name}
                email={accountToRotate?.email}
                organisation={org ?? undefined}
              />
              <div className="flex justify-end">
                <Button onClick={resetRotateDialog}>Done</Button>
              </div>
            </div>
          ) : (
            <div className="space-y-4">
              <p className="text-sm text-muted-foreground">
                This will generate new credentials for <strong>{accountToRotate?.name}</strong>. The old credentials
                will stop working immediately.
              </p>
              <div className="flex justify-end gap-2">
                <Button variant="outline" onClick={resetRotateDialog}>
                  Cancel
                </Button>
                <Button onClick={handleRotate}>
                  <RefreshCw className="h-4 w-4 mr-2" />
                  Rotate
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </Card>
  );
}

export default function OrganisationUsersPage() {
  const { token, org, updateOrgs } = useAppContext();
  const permissions = usePagePermissions(PAGE_AUTHZ);
  const canReadRoles = permissions.can("read_roles");
  const canCreateRoles = permissions.can("create_roles");
  const canManageServiceAccounts = permissions.can("create_service_account") || permissions.can("read_service_account");

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

  // Filter out service account users from the regular users list
  const regularUsers = (data?.users || []).filter(
    (user) => !user.username.endsWith("@service-account.airborne.juspay.in")
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
    <div className="container mx-auto p-6 space-y-6">
      <UserManagement
        users={regularUsers}
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

      {canManageServiceAccounts && (
        <ServiceAccountsSection
          canCreate={permissions.can("create_service_account")}
          canDelete={permissions.can("delete_service_account")}
          token={token}
          org={org}
        />
      )}
    </div>
  );
}
