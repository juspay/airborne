"use client";

import React, { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Search, Users, Loader2 } from "lucide-react";

interface OrgUser {
  id: string;
  name: string;
  email: string;
  username: string;
  roles?: string[];
}

interface ApplicationAccessInvite {
  userId: string;
  role: string;
}

export interface ApplicationAccessModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (invites: ApplicationAccessInvite[]) => Promise<void>;
  orgUsers: OrgUser[];
  applicationName: string;
  availableRoles?: string[];
  isLoading?: boolean;
}

const DEFAULT_ROLES = ["read", "write", "admin"];

const ROLE_COLORS = {
  admin: "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200",
  write: "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200",
  read: "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200",
};

export function ApplicationAccessModal({
  isOpen,
  onClose,
  onSubmit,
  orgUsers,
  applicationName,
  availableRoles = DEFAULT_ROLES,
  isLoading = false,
}: ApplicationAccessModalProps) {
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedUsers, setSelectedUsers] = useState<Record<string, string>>({});
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Reset state when modal opens/closes
  useEffect(() => {
    if (!isOpen) {
      setSearchTerm("");
      setSelectedUsers({});
    }
  }, [isOpen]);

  // Filter users based on search term
  const filteredUsers = orgUsers.filter(
    (user) =>
      user.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      user.email.toLowerCase().includes(searchTerm.toLowerCase()) ||
      user.username.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const handleUserToggle = (userId: string, checked: boolean) => {
    if (checked) {
      setSelectedUsers((prev) => ({ ...prev, [userId]: "read" })); // Default to read role
    } else {
      setSelectedUsers((prev) => {
        const newSelected = { ...prev };
        delete newSelected[userId];
        return newSelected;
      });
    }
  };

  const handleRoleChange = (userId: string, role: string) => {
    setSelectedUsers((prev) => ({ ...prev, [userId]: role }));
  };

  const handleSelectAll = (checked: boolean) => {
    if (checked) {
      const allUsers = filteredUsers.reduce((acc, user) => ({ ...acc, [user.id]: "read" }), {});
      setSelectedUsers(allUsers);
    } else {
      setSelectedUsers({});
    }
  };

  const handleSubmit = async () => {
    const invites = Object.entries(selectedUsers).map(([userId, role]) => ({
      userId,
      role,
    }));

    if (invites.length === 0) {
      return;
    }

    setIsSubmitting(true);
    try {
      await onSubmit(invites);
      onClose();
    } finally {
      setIsSubmitting(false);
    }
  };

  const selectedCount = Object.keys(selectedUsers).length;
  const isAllSelected = filteredUsers.length > 0 && filteredUsers.every((user) => selectedUsers[user.id]);

  const getRoleBadge = (role: string) => {
    const colorClass = ROLE_COLORS[role as keyof typeof ROLE_COLORS] || "bg-gray-100 text-gray-800";
    return <Badge className={colorClass}>{role.charAt(0).toUpperCase() + role.slice(1)}</Badge>;
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-4xl max-h-[80vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Users className="h-5 w-5" />
            Grant Application Access
          </DialogTitle>
          <DialogDescription>
            Select users from your organization to grant access to <strong>{applicationName}</strong>. You can choose
            different roles for each user.
          </DialogDescription>
        </DialogHeader>

        <div className="flex-1 overflow-hidden flex flex-col gap-4">
          {/* Search and Select All */}
          <div className="flex items-center justify-between gap-4">
            <div className="flex-1">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search users..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-9"
                />
              </div>
            </div>

            <div className="flex items-center space-x-2">
              <Checkbox id="select-all" checked={isAllSelected} onCheckedChange={handleSelectAll} />
              <Label htmlFor="select-all" className="text-sm font-medium">
                Select All ({filteredUsers.length})
              </Label>
            </div>
          </div>

          {/* Users Table */}
          <div className="flex-1 overflow-auto border rounded-lg">
            <Table>
              <TableHeader className="sticky top-0 bg-background">
                <TableRow>
                  <TableHead className="w-12">Select</TableHead>
                  <TableHead>User</TableHead>
                  <TableHead>Email</TableHead>
                  <TableHead>Current Org Roles</TableHead>
                  <TableHead className="w-40">App Role</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {isLoading ? (
                  <TableRow>
                    <TableCell colSpan={5} className="text-center py-8">
                      <div className="flex items-center justify-center gap-2">
                        <Loader2 className="h-4 w-4 animate-spin" />
                        Loading users...
                      </div>
                    </TableCell>
                  </TableRow>
                ) : filteredUsers.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={5} className="text-center py-8 text-muted-foreground">
                      {searchTerm
                        ? "No users match your search."
                        : orgUsers.length === 0
                          ? "All organization users already have access to this application."
                          : "No users found in this organization."}
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredUsers.map((user) => {
                    const isSelected = !!selectedUsers[user.id];
                    const selectedRole = selectedUsers[user.id];

                    return (
                      <TableRow key={user.id}>
                        <TableCell>
                          <Checkbox
                            checked={isSelected}
                            onCheckedChange={(checked) => handleUserToggle(user.id, checked as boolean)}
                          />
                        </TableCell>
                        <TableCell>
                          <div className="font-medium">{user.name}</div>
                          <div className="text-sm text-muted-foreground">@{user.username}</div>
                        </TableCell>
                        <TableCell className="font-mono text-sm">{user.email}</TableCell>
                        <TableCell>
                          <div className="flex gap-1 flex-wrap">
                            {user.roles?.map((role) => getRoleBadge(role)) || (
                              <span className="text-sm text-muted-foreground">No roles</span>
                            )}
                          </div>
                        </TableCell>
                        <TableCell>
                          {isSelected ? (
                            <Select value={selectedRole} onValueChange={(value) => handleRoleChange(user.id, value)}>
                              <SelectTrigger className="w-32">
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                {availableRoles.map((role) => (
                                  <SelectItem key={role} value={role}>
                                    {role.charAt(0).toUpperCase() + role.slice(1)}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          ) : (
                            <span className="text-sm text-muted-foreground">-</span>
                          )}
                        </TableCell>
                      </TableRow>
                    );
                  })
                )}
              </TableBody>
            </Table>
          </div>

          {/* Selected Summary */}
          {selectedCount > 0 && (
            <div className="p-3 bg-muted rounded-lg">
              <div className="text-sm font-medium mb-2">
                Selected {selectedCount} user{selectedCount !== 1 ? "s" : ""}:
              </div>
              <div className="flex flex-wrap gap-2">
                {Object.entries(selectedUsers).map(([userId, role]) => {
                  const user = orgUsers.find((u) => u.id === userId);
                  return (
                    <div key={userId} className="flex items-center gap-2 bg-background rounded px-2 py-1 text-sm">
                      <span>{user?.name}</span>
                      {getRoleBadge(role)}
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={isSubmitting}>
            Cancel
          </Button>
          <Button onClick={handleSubmit} disabled={selectedCount === 0 || isSubmitting}>
            {isSubmitting ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Granting Access...
              </>
            ) : (
              `Grant Access to ${selectedCount} User${selectedCount !== 1 ? "s" : ""}`
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
