"use client";

import React, { useEffect, useMemo, useState } from "react";
import { ArrowRight, Crown, MoreVertical, Search, Trash2, UserPlus } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useDebouncedValue } from "@/hooks/useDebouncedValue";

export type AccessLevel = string;

export interface User {
  username: string;
  roles: string[];
}

export interface PermissionOption {
  key: string;
  resource: string;
  action: string;
}

export interface RoleOption {
  role: string;
  is_system?: boolean;
  permissions?: PermissionOption[];
}

export interface UserManagementProps {
  users: User[];
  canAddUser?: boolean;
  canUpdateUser?: boolean;
  canRemoveUser?: boolean;
  canTransferOwnership?: boolean;
  canManageRoles?: boolean;
  onAddUser: (user: string, access: AccessLevel) => Promise<void>;
  onUpdateUser: (user: string, access: AccessLevel) => Promise<void>;
  onRemoveUser: (user: string) => Promise<void>;
  onTransferOwnership?: (user: string) => Promise<void>;
  onCreateRole?: (role: string, permissions: string[]) => Promise<void>;
  roles?: RoleOption[];
  availablePermissions?: PermissionOption[];
  availableUsers?: string[];
  title?: string;
  description?: string;
  entityType?: "organisation" | "application";
}

const SYSTEM_ROLE_ORDER = ["owner", "admin", "write", "read"];

const getRoleRank = (role: string): number => {
  const idx = SYSTEM_ROLE_ORDER.indexOf(role);
  return idx === -1 ? 99 : idx;
};

const getRoleMeta = (role: string) => {
  switch (role) {
    case "owner":
      return { label: "Owner", color: "bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200" };
    case "admin":
      return { label: "Admin", color: "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200" };
    case "write":
      return { label: "Write", color: "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200" };
    case "read":
      return { label: "Read", color: "bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-200" };
    default:
      return {
        label: role
          .split(/[_-]/)
          .filter(Boolean)
          .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
          .join(" "),
        color: "bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-200",
      };
  }
};

const getPrimaryRole = (roles: string[]): string | null => {
  if (!roles.length) return null;
  const sorted = [...roles].sort((left, right) => {
    const rankDiff = getRoleRank(left) - getRoleRank(right);
    if (rankDiff !== 0) return rankDiff;
    return left.localeCompare(right);
  });
  return sorted[0] ?? null;
};

const defaultRoleFrom = (roleValues: string[]): string => {
  if (roleValues.includes("read")) return "read";
  return roleValues[0] ?? "read";
};

const isValidRoleKey = (value: string): boolean => /^[a-z_]+$/.test(value);

export function UserManagement({
  users,
  canAddUser = false,
  canUpdateUser = false,
  canRemoveUser = false,
  canTransferOwnership = false,
  canManageRoles = false,
  onAddUser,
  onUpdateUser,
  onRemoveUser,
  onTransferOwnership,
  onCreateRole,
  roles = [],
  availablePermissions = [],
  availableUsers = [],
  title = "User Management",
  description = "Manage users and their access levels",
  entityType = "organisation",
}: UserManagementProps) {
  const [search, setSearch] = useState("");
  const debouncedSearch = useDebouncedValue(search, 500);
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const [isUserPickerOpen, setIsUserPickerOpen] = useState(false);
  const [newUser, setNewUser] = useState("");
  const [newUserAccess, setNewUserAccess] = useState("read");
  const [isConfirmDialogOpen, setIsConfirmDialogOpen] = useState(false);
  const [userToRemove, setUserToRemove] = useState<string | null>(null);
  const [isTransferDialogOpen, setIsTransferDialogOpen] = useState(false);
  const [userToTransfer, setUserToTransfer] = useState<string | null>(null);
  const [roleName, setRoleName] = useState("");
  const [editingRoleKey, setEditingRoleKey] = useState<string | null>(null);
  const [permissionSearch, setPermissionSearch] = useState("");
  const [selectedPermissions, setSelectedPermissions] = useState<Set<string>>(new Set());

  const canManageAnyUserAction =
    canUpdateUser || canRemoveUser || (entityType === "organisation" && canTransferOwnership);
  const canEditRoles = Boolean(onCreateRole && canManageRoles);
  const hasRoleTab = roles.length > 0 || canEditRoles;
  const hasOrgUserPicker = entityType === "application" && availableUsers.length > 0;

  const filteredUsers = useMemo(() => {
    return users.filter((user) => user.username.toLowerCase().includes(debouncedSearch.toLowerCase()));
  }, [users, debouncedSearch]);

  const roleValues = useMemo(() => {
    const dynamic = roles.map((entry) => entry.role).filter((role) => role && role !== "owner");
    if (dynamic.length > 0) {
      return dynamic.sort((left, right) => {
        const rankDiff = getRoleRank(left) - getRoleRank(right);
        if (rankDiff !== 0) return rankDiff;
        return left.localeCompare(right);
      });
    }
    return ["admin", "write", "read"];
  }, [roles]);

  useEffect(() => {
    if (!roleValues.includes(newUserAccess)) {
      setNewUserAccess(defaultRoleFrom(roleValues));
    }
  }, [newUserAccess, roleValues]);

  const filteredRolePermissions = useMemo(() => {
    if (!permissionSearch.trim()) return availablePermissions;
    const query = permissionSearch.toLowerCase();
    return availablePermissions.filter(
      (permission) =>
        permission.key.toLowerCase().includes(query) ||
        permission.resource.toLowerCase().includes(query) ||
        permission.action.toLowerCase().includes(query)
    );
  }, [availablePermissions, permissionSearch]);

  const normalizedRoleName = roleName.trim().toLowerCase();
  const roleKeyError =
    normalizedRoleName.length > 0 && !isValidRoleKey(normalizedRoleName)
      ? "Role key can only contain lowercase letters (a-z) and underscore (_)."
      : null;

  const handleAddUser = async () => {
    const targetUser = hasOrgUserPicker ? newUser : newUser.trim();
    if (!targetUser) return;

    await onAddUser(targetUser, newUserAccess);
    setNewUser("");
    setNewUserAccess(defaultRoleFrom(roleValues));
    setIsAddDialogOpen(false);
  };

  const handleUpdateAccess = async (user: string, access: AccessLevel) => {
    await onUpdateUser(user, access);
  };

  const handleRemoveUser = (user: string) => {
    setUserToRemove(user);
    setIsConfirmDialogOpen(true);
  };

  const confirmRemoveUser = async () => {
    if (!userToRemove) return;
    await onRemoveUser(userToRemove);
    setIsConfirmDialogOpen(false);
    setUserToRemove(null);
  };

  const cancelRemoveUser = () => {
    setIsConfirmDialogOpen(false);
    setUserToRemove(null);
  };

  const handleTransferOwnership = (user: string) => {
    setUserToTransfer(user);
    setIsTransferDialogOpen(true);
  };

  const confirmTransferOwnership = async () => {
    if (!userToTransfer || !onTransferOwnership) return;
    await onTransferOwnership(userToTransfer);
    setIsTransferDialogOpen(false);
    setUserToTransfer(null);
  };

  const cancelTransferOwnership = () => {
    setIsTransferDialogOpen(false);
    setUserToTransfer(null);
  };

  const togglePermission = (key: string) => {
    setSelectedPermissions((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };

  const handleCreateRole = async () => {
    if (!onCreateRole) return;
    if (!normalizedRoleName || roleKeyError || selectedPermissions.size === 0) return;
    await onCreateRole(normalizedRoleName, Array.from(selectedPermissions));
    setEditingRoleKey(null);
    setRoleName("");
    setPermissionSearch("");
    setSelectedPermissions(new Set());
  };

  const beginEditRole = (role: RoleOption) => {
    const existingPermissions = role.permissions?.map((permission) => permission.key) ?? [];
    setEditingRoleKey(role.role);
    setRoleName(role.role);
    setPermissionSearch("");
    setSelectedPermissions(new Set(existingPermissions));
  };

  const resetRoleEditor = () => {
    setEditingRoleKey(null);
    setRoleName("");
    setPermissionSearch("");
    setSelectedPermissions(new Set());
  };

  const usersContent = (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle>{title}</CardTitle>
            <p className="text-sm text-muted-foreground mt-1">{description}</p>
          </div>
          {canAddUser && (
            <Dialog open={isAddDialogOpen} onOpenChange={setIsAddDialogOpen}>
              <DialogTrigger asChild>
                <Button>
                  <UserPlus className="h-4 w-4 mr-2" />
                  Add User
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Add New User</DialogTitle>
                </DialogHeader>
                <div className="space-y-4">
                  <div>
                    <label className="text-sm font-medium">User</label>
                    {hasOrgUserPicker ? (
                      <Popover open={isUserPickerOpen} onOpenChange={setIsUserPickerOpen}>
                        <PopoverTrigger asChild>
                          <Button variant="outline" className="w-full justify-start mt-2 font-normal">
                            {newUser || "Select user from organisation"}
                          </Button>
                        </PopoverTrigger>
                        <PopoverContent className="p-0 w-[380px]">
                          <Command>
                            <CommandInput placeholder="Search users..." />
                            <CommandList>
                              <CommandEmpty>No users found.</CommandEmpty>
                              <CommandGroup>
                                {availableUsers.map((user) => (
                                  <CommandItem
                                    key={user}
                                    value={user}
                                    onSelect={(selected) => {
                                      setNewUser(selected);
                                      setIsUserPickerOpen(false);
                                    }}
                                  >
                                    {user}
                                  </CommandItem>
                                ))}
                              </CommandGroup>
                            </CommandList>
                          </Command>
                        </PopoverContent>
                      </Popover>
                    ) : (
                      <Input
                        className="mt-2"
                        placeholder="Enter user email"
                        value={newUser}
                        onChange={(event) => setNewUser(event.target.value)}
                      />
                    )}
                  </div>
                  <div>
                    <label className="text-sm font-medium">Role</label>
                    <Select value={newUserAccess} onValueChange={setNewUserAccess}>
                      <SelectTrigger className="mt-2">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {roleValues.map((role) => {
                          const meta = getRoleMeta(role);
                          return (
                            <SelectItem key={role} value={role}>
                              <div className="flex items-center gap-2">
                                <Badge variant="secondary" className={meta.color}>
                                  {meta.label}
                                </Badge>
                                <span className="text-xs text-muted-foreground">{role}</span>
                              </div>
                            </SelectItem>
                          );
                        })}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="flex justify-end gap-2">
                    <Button variant="outline" onClick={() => setIsAddDialogOpen(false)}>
                      Cancel
                    </Button>
                    <Button onClick={handleAddUser} disabled={!newUser || !newUserAccess}>
                      Add User
                    </Button>
                  </div>
                </div>
              </DialogContent>
            </Dialog>
          )}
        </div>
      </CardHeader>
      <CardContent>
        <div className="flex flex-col space-y-4">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 transform text-muted-foreground" />
            <Input
              className="pl-10"
              placeholder="Search users..."
              value={search}
              onChange={(event) => setSearch(event.target.value)}
            />
          </div>

          <div className="space-y-2 max-h-[calc(100vh-250px)] overflow-y-auto pr-2">
            {filteredUsers.length === 0 ? (
              <div className="py-8 text-center text-muted-foreground">
                {search ? "No users found matching your search." : "No users found."}
              </div>
            ) : (
              filteredUsers.map((user) => {
                const primaryRole = getPrimaryRole(user.roles);
                const availableRoleUpdates = roleValues.filter((role) => role !== primaryRole);

                return (
                  <div
                    key={user.username}
                    className="flex items-center justify-between rounded-lg border p-4 transition-colors hover:bg-muted/50"
                  >
                    <div className="flex items-center gap-3">
                      <div className="h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center">
                        <span className="text-sm font-medium text-primary">
                          {user.username.charAt(0).toUpperCase()}
                        </span>
                      </div>
                      <div>
                        <p className="font-medium">{user.username}</p>
                        <div className="flex flex-wrap gap-1">
                          {user.roles.map((role) => {
                            const meta = getRoleMeta(role);
                            return (
                              <Badge key={role} variant="secondary" className={meta.color}>
                                {meta.label}
                              </Badge>
                            );
                          })}
                        </div>
                      </div>
                    </div>

                    {canManageAnyUserAction && !user.roles.includes("owner") && (
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="sm">
                            <MoreVertical className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end" className="w-80 bg-white dark:bg-[#111115]">
                          {entityType === "organisation" && canTransferOwnership && (
                            <DropdownMenuItem
                              onClick={() => handleTransferOwnership(user.username)}
                              className="flex-col items-start cursor-pointer border-b border-gray-200 p-3 hover:!bg-gray-100 dark:border-gray-700 dark:hover:!bg-[#1c1c21]"
                            >
                              <div className="flex w-full items-center gap-2">
                                <div className="h-8 w-8 rounded-full bg-purple-100 flex items-center justify-center dark:bg-purple-900">
                                  <Crown className="h-4 w-4 text-purple-600 dark:text-purple-300" />
                                </div>
                                <div className="flex-1">
                                  <span className="text-sm font-medium text-gray-900 dark:text-[#edeef5]">
                                    Transfer Ownership
                                  </span>
                                  <p className="mt-1 text-xs text-muted-foreground dark:text-[#8d8e9b]">
                                    Make {user.username} the new owner of this organisation
                                  </p>
                                </div>
                              </div>
                            </DropdownMenuItem>
                          )}
                          {canUpdateUser &&
                            availableRoleUpdates.map((role) => {
                              const meta = getRoleMeta(role);
                              return (
                                <DropdownMenuItem
                                  key={role}
                                  onClick={() => handleUpdateAccess(user.username, role)}
                                  className="flex-col items-start cursor-pointer p-3 hover:!bg-gray-100 dark:hover:!bg-[#1c1c21]"
                                >
                                  <div className="flex w-full items-center gap-2">
                                    <Badge variant="secondary" className={meta.color}>
                                      {meta.label}
                                    </Badge>
                                    <span className="text-sm text-gray-900 dark:text-[#edeef5]">
                                      Set role to {meta.label}
                                    </span>
                                  </div>
                                  <div className="mt-2 flex items-center gap-2 text-xs text-muted-foreground dark:text-[#8d8e9b]">
                                    <Badge variant="outline" className="text-xs h-5">
                                      {primaryRole ? getRoleMeta(primaryRole).label : "Current"}
                                    </Badge>
                                    <ArrowRight className="h-3 w-3" />
                                    <Badge variant="outline" className="text-xs h-5">
                                      {meta.label}
                                    </Badge>
                                  </div>
                                </DropdownMenuItem>
                              );
                            })}
                          {canRemoveUser && (
                            <DropdownMenuItem
                              onClick={() => handleRemoveUser(user.username)}
                              className="cursor-pointer text-destructive focus:text-destructive hover:!bg-gray-100 dark:hover:!bg-[#1c1c21]"
                            >
                              <Trash2 className="mr-2 h-4 w-4" />
                              Remove User
                            </DropdownMenuItem>
                          )}
                        </DropdownMenuContent>
                      </DropdownMenu>
                    )}
                  </div>
                );
              })
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );

  const rolesContent = (
    <Card>
      <CardHeader>
        <CardTitle>Roles</CardTitle>
        <p className="text-sm text-muted-foreground">
          Create custom roles by selecting resource-action permissions. System roles are read-only.
        </p>
      </CardHeader>
      <CardContent className="space-y-6">
        {canEditRoles ? (
          <div className="rounded-lg border p-4 space-y-4">
            <div>
              <label className="text-sm font-medium">Role Key</label>
              <Input
                className="mt-2"
                placeholder="e.g. release_manager"
                value={roleName}
                onChange={(event) => setRoleName(event.target.value.toLowerCase())}
                disabled={Boolean(editingRoleKey)}
              />
              {editingRoleKey ? (
                <p className="mt-2 text-xs text-muted-foreground">
                  Editing role <span className="font-mono">{editingRoleKey}</span>. Clear to create a new role key.
                </p>
              ) : null}
              {roleKeyError ? <p className="mt-2 text-xs text-destructive">{roleKeyError}</p> : null}
            </div>
            <div>
              <label className="text-sm font-medium">Permissions</label>
              <Input
                className="mt-2"
                placeholder="Search permissions..."
                value={permissionSearch}
                onChange={(event) => setPermissionSearch(event.target.value)}
              />
              <div className="mt-3 max-h-60 overflow-y-auto rounded border p-2 space-y-2">
                {filteredRolePermissions.length === 0 ? (
                  <div className="text-sm text-muted-foreground p-2">No permissions found.</div>
                ) : (
                  filteredRolePermissions.map((permission) => (
                    <label key={permission.key} className="flex items-start gap-2 rounded p-2 hover:bg-muted/50">
                      <Checkbox
                        checked={selectedPermissions.has(permission.key)}
                        onCheckedChange={() => togglePermission(permission.key)}
                      />
                      <div>
                        <div className="font-medium text-sm">{permission.key}</div>
                        <div className="text-xs text-muted-foreground">
                          {permission.resource} / {permission.action}
                        </div>
                      </div>
                    </label>
                  ))
                )}
              </div>
            </div>
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={resetRoleEditor}>
                Clear
              </Button>
              <Button
                onClick={handleCreateRole}
                disabled={!normalizedRoleName || Boolean(roleKeyError) || selectedPermissions.size === 0}
              >
                {editingRoleKey ? "Update Role" : "Create Role"}
              </Button>
            </div>
          </div>
        ) : null}

        <div className="space-y-2">
          {roles.length === 0 ? (
            <div className="text-sm text-muted-foreground">No roles available.</div>
          ) : (
            roles.map((role) => {
              const meta = getRoleMeta(role.role);
              return (
                <div key={role.role} className="rounded-lg border p-3">
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <Badge variant="secondary" className={meta.color}>
                        {meta.label}
                      </Badge>
                      <span className="text-xs text-muted-foreground">{role.role}</span>
                    </div>
                    <span className="text-xs text-muted-foreground">
                      {role.is_system ? "system" : "custom"} • {role.permissions?.length ?? 0} permissions
                    </span>
                  </div>
                  {!role.is_system && canEditRoles ? (
                    <div className="mt-3 flex justify-end">
                      <Button variant="outline" size="sm" onClick={() => beginEditRole(role)}>
                        Edit
                      </Button>
                    </div>
                  ) : null}
                </div>
              );
            })
          )}
        </div>
      </CardContent>
    </Card>
  );

  return (
    <div className="space-y-6">
      {hasRoleTab ? (
        <Tabs defaultValue="users" className="space-y-4">
          <TabsList>
            <TabsTrigger value="users">Users</TabsTrigger>
            <TabsTrigger value="roles">Roles</TabsTrigger>
          </TabsList>
          <TabsContent value="users">{usersContent}</TabsContent>
          <TabsContent value="roles">{rolesContent}</TabsContent>
        </Tabs>
      ) : (
        usersContent
      )}

      <Dialog open={isConfirmDialogOpen} onOpenChange={setIsConfirmDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Confirm User Removal</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">
              Are you sure you want to remove <strong>{userToRemove}</strong> from this {entityType}? This action cannot
              be undone.
            </p>
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={cancelRemoveUser}>
                Cancel
              </Button>
              <Button variant="destructive" onClick={confirmRemoveUser}>
                <Trash2 className="h-4 w-4 mr-2" />
                Remove User
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={isTransferDialogOpen} onOpenChange={setIsTransferDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Crown className="h-5 w-5 text-purple-600" />
              Transfer Ownership
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">
              You are about to transfer ownership of this {entityType} to{" "}
              <strong className="text-foreground">{userToTransfer}</strong>.
            </p>
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={cancelTransferOwnership}>
                Cancel
              </Button>
              <Button variant="destructive" onClick={confirmTransferOwnership}>
                <Crown className="h-4 w-4 mr-2" />
                Transfer Ownership
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
