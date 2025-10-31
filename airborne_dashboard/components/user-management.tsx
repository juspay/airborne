"use client";
import React, { useMemo } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Search, UserPlus, MoreVertical, Trash2, ArrowRight, Crown } from "lucide-react";
import { useDebouncedValue } from "@/hooks/useDebouncedValue";
import { toastSuccess, toastError } from "@/hooks/use-toast";

export type AccessLevel = "owner" | "admin" | "write" | "read";

export interface User {
  username: string;
  roles: AccessLevel[];
}

export interface UserManagementProps {
  users: User[];
  currentUserOrgAccess: string[];
  currentUserAppAccess?: string[];
  onAddUser: (user: string, access: AccessLevel) => Promise<void>;
  onUpdateUser: (user: string, access: AccessLevel) => Promise<void>;
  onRemoveUser: (user: string) => Promise<void>;
  onTransferOwnership?: (user: string) => Promise<void>;
  onInviteCreated?: () => void; // Callback for when an invitation is created
  title?: string;
  description?: string;
  entityType?: "organisation" | "application";
  hideAddUserButton?: boolean; // New prop to hide the add user button
}

const ACCESS_LEVELS: { value: AccessLevel; label: string; color: string }[] = [
  { value: "owner", label: "Owner", color: "bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200" },
  { value: "admin", label: "Admin", color: "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200" },
  { value: "write", label: "Write", color: "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200" },
  { value: "read", label: "Read", color: "bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-200" },
];

const getAccessLevelRoles = (level: AccessLevel): AccessLevel[] => {
  switch (level) {
    case "owner":
      return ["owner", "admin", "write", "read"];
    case "admin":
      return ["admin", "write", "read"];
    case "write":
      return ["write", "read"];
    case "read":
      return ["read"];
    default:
      return ["read"];
  }
};

export const canUpdateUsers = (
  entityType: "organisation" | "application",
  orgAccess: string[],
  appAccess?: string[]
): boolean => {
  if (entityType === "organisation") {
    return orgAccess.includes("admin");
  }
  if (!appAccess) return false;
  return orgAccess.includes("admin") || (orgAccess.includes("read") && appAccess.includes("admin"));
};
const getHighestAccessLevel = (roles: AccessLevel[]): AccessLevel => {
  const accessHierarchy: AccessLevel[] = ["owner", "admin", "write", "read"];
  for (const level of accessHierarchy) {
    if (roles.includes(level)) {
      return level;
    }
  }
  return "read";
};

export function UserManagement({
  users,
  currentUserOrgAccess,
  currentUserAppAccess,
  onAddUser,
  onUpdateUser,
  onRemoveUser,
  onTransferOwnership,
  onInviteCreated,
  title = "User Management",
  description = "Manage users and their access levels",
  entityType = "organisation",
  hideAddUserButton = false,
}: UserManagementProps) {
  const [search, setSearch] = React.useState("");
  const debouncedSearch = useDebouncedValue(search, 500);
  const [isAddDialogOpen, setIsAddDialogOpen] = React.useState(false);
  const [newUser, setNewUser] = React.useState("");
  const [newUserAccess, setNewUserAccess] = React.useState<AccessLevel>("read");
  const [isConfirmDialogOpen, setIsConfirmDialogOpen] = React.useState(false);
  const [userToRemove, setUserToRemove] = React.useState<string | null>(null);
  const [isTransferDialogOpen, setIsTransferDialogOpen] = React.useState(false);
  const [userToTransfer, setUserToTransfer] = React.useState<string | null>(null);
  const [isInviting, setIsInviting] = React.useState(false);

  const canUpdate = canUpdateUsers(entityType, currentUserOrgAccess, currentUserAppAccess);
  const filteredUsers = useMemo(() => {
    return users.filter((u) => u.username.toLowerCase().includes(search.toLowerCase()));
  }, [users, debouncedSearch]);

  const handleAddUser = async () => {
    if (!newUser.trim()) return;

    setIsInviting(true);
    try {
      await onAddUser(newUser.trim(), newUserAccess);
      setNewUser("");
      setNewUserAccess("read");
      setIsAddDialogOpen(false);

      // Show success toast
      toastSuccess("Invitation Sent", `Successfully sent invitation to ${newUser.trim()} with ${newUserAccess} access`);

      // Notify parent component that an invitation was created
      onInviteCreated?.();
    } catch (error: any) {
      console.error("Failed to add user:", error);

      // Show error toast
      toastError("Failed to Send Invitation", error?.message || "Could not send invitation. Please try again.");
    } finally {
      setIsInviting(false);
    }
  };

  const handleUpdateAccess = async (user: string, newAccess: AccessLevel) => {
    try {
      await onUpdateUser(user, newAccess);
    } catch (error) {
      console.error("Failed to update user access:", error);
    }
  };

  const handleTransferOwnership = async (user: string) => {
    setUserToTransfer(user);
    setIsTransferDialogOpen(true);
  };

  const confirmTransferOwnership = async () => {
    if (!userToTransfer || !onTransferOwnership) return;

    try {
      await onTransferOwnership(userToTransfer);
      setIsTransferDialogOpen(false);
      setUserToTransfer(null);
    } catch (error) {
      console.error("Failed to transfer ownership:", error);
    }
  };

  const cancelTransferOwnership = () => {
    setIsTransferDialogOpen(false);
    setUserToTransfer(null);
  };

  const handleRemoveUser = async (user: string) => {
    setUserToRemove(user);
    setIsConfirmDialogOpen(true);
  };

  const confirmRemoveUser = async () => {
    if (!userToRemove) return;

    try {
      await onRemoveUser(userToRemove);
      setIsConfirmDialogOpen(false);
      setUserToRemove(null);
    } catch (error) {
      console.error("Failed to remove user:", error);
    }
  };

  const allowedAccessLevels: AccessLevel[] = ["admin", "write", "read"];

  const cancelRemoveUser = () => {
    setIsConfirmDialogOpen(false);
    setUserToRemove(null);
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>{title}</CardTitle>
              <p className="text-sm text-muted-foreground mt-1">{description}</p>
            </div>
            {canUpdate && !hideAddUserButton && (
              <Dialog open={isAddDialogOpen} onOpenChange={setIsAddDialogOpen}>
                <DialogTrigger asChild>
                  <Button>
                    <UserPlus className="h-4 w-4 mr-2" />
                    Add User
                  </Button>
                </DialogTrigger>
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>Invite user to Organisation</DialogTitle>
                  </DialogHeader>
                  <div className="space-y-4">
                    <div>
                      <label className="text-sm font-medium">Email</label>
                      <Input placeholder="Enter email" value={newUser} onChange={(e) => setNewUser(e.target.value)} />
                    </div>
                    <div>
                      <label className="text-sm font-medium">Access Level</label>
                      <Select value={newUserAccess} onValueChange={(value: AccessLevel) => setNewUserAccess(value)}>
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {allowedAccessLevels.map((level) => {
                            const config = ACCESS_LEVELS.find((l) => l.value === level)!;
                            const roles = getAccessLevelRoles(level);
                            return (
                              <SelectItem key={level} value={level}>
                                <div className="flex items-center gap-2">
                                  <Badge variant="secondary" className={config.color}>
                                    {config.label}
                                  </Badge>
                                  <span className="text-xs text-muted-foreground">({roles.join(", ")})</span>
                                </div>
                              </SelectItem>
                            );
                          })}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="flex justify-end gap-2">
                      <Button variant="outline" onClick={() => setIsAddDialogOpen(false)} disabled={isInviting}>
                        Cancel
                      </Button>
                      <Button onClick={handleAddUser} disabled={!newUser.trim() || isInviting}>
                        {isInviting ? "Sending..." : "Invite"}
                      </Button>
                    </div>
                  </div>
                </DialogContent>
              </Dialog>
            )}
          </div>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col space-y-4 h-full">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search users..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-10"
              />
            </div>

            <div className="flex-1 overflow-y-auto pr-2 space-y-2 max-h-[calc(100vh-250px)]">
              {filteredUsers.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  {search ? "No users found matching your search." : "No users found."}
                </div>
              ) : (
                filteredUsers.map((user) => {
                  const userHighestLevel = getHighestAccessLevel(user.roles);
                  const availableAccessLevels = allowedAccessLevels.filter((level) => level !== userHighestLevel);

                  return (
                    <div
                      key={user.username}
                      className="flex items-center justify-between p-4 border rounded-lg hover:bg-muted/50 transition-colors"
                    >
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 bg-primary/10 rounded-full flex items-center justify-center">
                          <span className="text-sm font-medium text-primary">
                            {user.username.charAt(0).toUpperCase()}
                          </span>
                        </div>
                        <div>
                          <p className="font-medium">{user.username}</p>
                          <div className="flex gap-1 flex-wrap">
                            {user.roles.map((role) => {
                              const config = ACCESS_LEVELS.find((l) => l.value === role)!;
                              return (
                                <Badge key={role} variant="secondary" className={config.color}>
                                  {config.label}
                                </Badge>
                              );
                            })}
                          </div>
                        </div>
                      </div>

                      {canUpdate && !user.roles.includes("owner") && (
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="sm">
                              <MoreVertical className="h-4 w-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end" className="w-80 bg-white dark:bg-[#111115]">
                            {entityType === "organisation" && currentUserOrgAccess.includes("owner") ? (
                              <DropdownMenuItem
                                onClick={() => handleTransferOwnership(user.username)}
                                className="flex-col cursor-pointer items-start p-3 hover:!bg-gray-100 dark:hover:!bg-[#1c1c21] border-b border-gray-200 dark:border-gray-700"
                              >
                                <div className="flex items-center gap-2 w-full">
                                  <div className="w-8 h-8 bg-purple-100 dark:bg-purple-900 rounded-full flex items-center justify-center">
                                    <svg
                                      className="w-4 h-4 text-purple-600 dark:text-purple-300"
                                      fill="none"
                                      stroke="currentColor"
                                      viewBox="0 0 24 24"
                                    >
                                      <path
                                        strokeLinecap="round"
                                        strokeLinejoin="round"
                                        strokeWidth={2}
                                        d="M9 12l2 2 4-4M7.835 4.697a3.42 3.42 0 001.946-.806 3.42 3.42 0 014.438 0 3.42 3.42 0 001.946.806 3.42 3.42 0 013.138 3.138 3.42 3.42 0 00.806 1.946 3.42 3.42 0 010 4.438 3.42 3.42 0 00-.806 1.946 3.42 3.42 0 01-3.138 3.138 3.42 3.42 0 00-1.946.806 3.42 3.42 0 01-4.438 0 3.42 3.42 0 00-1.946-.806 3.42 3.42 0 01-3.138-3.138 3.42 3.42 0 00-.806-1.946 3.42 3.42 0 010-4.438 3.42 3.42 0 00.806-1.946 3.42 3.42 0 013.138-3.138z"
                                      />
                                    </svg>
                                  </div>
                                  <div className="flex-1">
                                    <span className="text-sm font-medium text-gray-900 dark:text-[#edeef5]">
                                      Transfer Ownership
                                    </span>
                                    <p className="text-xs text-muted-foreground dark:text-[#8d8e9b] mt-1">
                                      Make {user.username} the new owner of this organisation
                                    </p>
                                  </div>
                                </div>
                              </DropdownMenuItem>
                            ) : null}
                            {availableAccessLevels.map((level) => {
                              const config = ACCESS_LEVELS.find((l) => l.value === level)!;
                              const newRoles = getAccessLevelRoles(level);
                              return (
                                <DropdownMenuItem
                                  key={level}
                                  onClick={() => handleUpdateAccess(user.username, level)}
                                  className="flex-col cursor-pointer items-start p-3 hover:!bg-gray-100 dark:hover:!bg-[#1c1c21]"
                                >
                                  <div className="flex items-center gap-2 w-full">
                                    <Badge variant="secondary" className={config.color}>
                                      {config.label}
                                    </Badge>
                                    <span className="text-sm text-gray-900 dark:text-[#edeef5]">
                                      Set access to {config.label}
                                    </span>
                                  </div>
                                  <div className="flex items-center gap-2 mt-2 text-xs text-muted-foreground dark:text-[#8d8e9b]">
                                    <div className="flex gap-1">
                                      {user.roles.map((role) => {
                                        const config = ACCESS_LEVELS.find((l) => l.value === role)!;
                                        return (
                                          <Badge key={role} variant="outline" className="text-xs h-5">
                                            {config.label}
                                          </Badge>
                                        );
                                      })}
                                    </div>
                                    <ArrowRight className="h-3 w-3" />
                                    <div className="flex gap-1">
                                      {newRoles.map((role) => {
                                        const config = ACCESS_LEVELS.find((l) => l.value === role)!;
                                        return (
                                          <Badge key={role} variant="outline" className="text-xs h-5">
                                            {config.label}
                                          </Badge>
                                        );
                                      })}
                                    </div>
                                  </div>
                                </DropdownMenuItem>
                              );
                            })}
                            <DropdownMenuItem
                              onClick={() => handleRemoveUser(user.username)}
                              className="text-destructive focus:text-destructive hover:!bg-gray-100 dark:hover:!bg-[#1c1c21] cursor-pointer"
                            >
                              <Trash2 className="h-4 w-4 mr-2" />
                              Remove User
                            </DropdownMenuItem>
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

      <Dialog open={isConfirmDialogOpen} onOpenChange={setIsConfirmDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Confirm User Removal</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">
              Are you sure you want to remove <strong>{userToRemove}</strong> from this {entityType}? This action cannot
              be undone and the user will lose all access immediately.
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
            <div className="p-4 bg-amber-50 dark:bg-amber-900/20 rounded-lg border border-amber-200 dark:border-amber-800">
              <div className="flex items-start gap-3">
                <svg
                  className="w-5 h-5 text-amber-600 dark:text-amber-400 mt-0.5 flex-shrink-0"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L4.082 16.5c-.77.833.192 2.5 1.732 2.5z"
                  />
                </svg>
                <div>
                  <h4 className="font-semibold text-amber-800 dark:text-amber-200">
                    Warning: This action is irreversible
                  </h4>
                  <p className="text-sm text-amber-700 dark:text-amber-300 mt-1">
                    This will permanently transfer ownership to another user.
                  </p>
                </div>
              </div>
            </div>

            <div className="space-y-3">
              <p className="text-sm text-muted-foreground">
                You are about to transfer ownership of this {entityType} to{" "}
                <strong className="text-foreground">{userToTransfer}</strong>.
              </p>

              <div className="space-y-2">
                <h4 className="text-sm font-medium">What will happen:</h4>
                <ul className="text-sm text-muted-foreground space-y-1 ml-4">
                  <li className="flex items-start gap-2">
                    <span className="text-xs mt-1">•</span>
                    <span>
                      <strong>{userToTransfer}</strong> will become the new owner
                    </span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="text-xs mt-1">•</span>
                    <span>You will lose all owner privileges</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="text-xs mt-1">•</span>
                    <span>Your access level will be changed to admin</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="text-xs mt-1">•</span>
                    <span>This action cannot be undone</span>
                  </li>
                </ul>
              </div>
            </div>
            <div className="flex justify-end gap-2 pt-2">
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

      <Card>
        <CardHeader>
          <CardTitle className="text-sm">Access Level Hierarchy</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
            <div className="space-y-3">
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <Badge
                    variant="secondary"
                    className="bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200"
                  >
                    Owner
                  </Badge>
                  <span>Can manage all users</span>
                </div>
                <div className="text-xs text-muted-foreground ml-2">Includes: Admin, Write, Read access</div>
              </div>
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <Badge variant="secondary" className="bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200">
                    Admin
                  </Badge>
                  <span>Can manage non-owner users</span>
                </div>
                <div className="text-xs text-muted-foreground ml-2">Includes: Admin, Write, Read access</div>
              </div>
            </div>
            <div className="space-y-3">
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <Badge
                    variant="secondary"
                    className="bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200"
                  >
                    Write
                  </Badge>
                  <span>Cannot manage other users</span>
                </div>
                <div className="text-xs text-muted-foreground ml-2">Includes: Write, Read access</div>
              </div>
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <Badge variant="secondary" className="bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-200">
                    Read
                  </Badge>
                  <span>Cannot manage other users</span>
                </div>
                <div className="text-xs text-muted-foreground ml-2">Includes: Read access only</div>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
