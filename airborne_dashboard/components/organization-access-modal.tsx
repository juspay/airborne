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
import { Mail, Building2, Loader2, CheckCircle2 } from "lucide-react";
import { useAppContext } from "@/providers/app-context";

interface Application {
  id: string;
  name: string;
  description?: string;
}

interface ApplicationAccess {
  name: string;
  level: string;
}

interface OrganizationAccessInvite {
  email: string;
  orgRole: string;
  applications: ApplicationAccess[];
}

export interface OrganizationAccessModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (invite: OrganizationAccessInvite) => Promise<void>;
  applications: Application[];
  organizationName: string;
  isLoading?: boolean;
}

export function OrganizationAccessModal({
  isOpen,
  onClose,
  onSubmit,
  applications,
  organizationName,
  isLoading = false,
}: OrganizationAccessModalProps) {
  const { config } = useAppContext();
  const [email, setEmail] = useState("");
  const [selectedApplications, setSelectedApplications] = useState<Set<string>>(new Set());
  const [applicationRoles, setApplicationRoles] = useState<Record<string, string>>({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [emailError, setEmailError] = useState("");

  // Reset state when modal opens/closes
  useEffect(() => {
    if (!isOpen) {
      setEmail("");
      setSelectedApplications(new Set());
      setApplicationRoles({});
      setEmailError("");
    }
  }, [isOpen]);

  // Email validation
  const validateEmail = (email: string) => {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!email) {
      return "Email is required";
    }
    if (!emailRegex.test(email)) {
      return "Please enter a valid email address";
    }
    return "";
  };

  const handleEmailChange = (value: string) => {
    setEmail(value);
    const error = validateEmail(value);
    setEmailError(error);
  };

  const handleApplicationToggle = (applicationId: string, checked: boolean) => {
    const newSelected = new Set(selectedApplications);
    const newRoles = { ...applicationRoles };

    if (checked) {
      newSelected.add(applicationId);
      newRoles[applicationId] = "read"; // Default role
    } else {
      newSelected.delete(applicationId);
      delete newRoles[applicationId];
    }

    setSelectedApplications(newSelected);
    setApplicationRoles(newRoles);
  };

  const handleRoleChange = (applicationId: string, role: string) => {
    setApplicationRoles((prev) => ({ ...prev, [applicationId]: role }));
  };

  const handleSelectAllApps = (checked: boolean) => {
    if (checked) {
      const allAppIds = applications.map((app) => app.id);
      setSelectedApplications(new Set(allAppIds));

      // Set default role for all applications
      const defaultRoles: Record<string, string> = {};
      allAppIds.forEach((appId) => {
        defaultRoles[appId] = "read";
      });
      setApplicationRoles(defaultRoles);
    } else {
      setSelectedApplications(new Set());
      setApplicationRoles({});
    }
  };

  const handleSubmit = async () => {
    const emailValidationError = validateEmail(email);
    if (emailValidationError) {
      setEmailError(emailValidationError);
      return;
    }

    const invite: OrganizationAccessInvite = {
      email: email.trim(),
      orgRole: "read", // Fixed to read as per requirements
      applications: Array.from(selectedApplications).map((appId) => {
        const app = applications.find((a) => a.id === appId);
        return {
          name: app?.name || appId,
          level: applicationRoles[appId] || "read",
        };
      }),
    };

    setIsSubmitting(true);
    try {
      await onSubmit(invite);
      onClose();
    } catch (e: any) {
      console.error(`Error sending ${config?.organisation_invite_enabled ? "invite" : "add"}:`, e);
      setEmailError(
        e?.message || `An error occurred while sending the ${config?.organisation_invite_enabled ? "invite" : "add"}.`
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  const selectedCount = selectedApplications.size;
  const isAllSelected = applications.length > 0 && applications.every((app) => selectedApplications.has(app.id));
  const canSubmit = email && !emailError && !isSubmitting;

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-2xl max-h-[80vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Building2 className="h-5 w-5" />
            {config?.organisation_invite_enabled ? "Invite" : "Add"} User to Organization
          </DialogTitle>
          <DialogDescription>
            {config?.organisation_invite_enabled ? "Invite" : "Add"} a new user to <strong>{organizationName}</strong>{" "}
            with read-only organization access. Select which applications they should have access to. You can change
            access levels later.
          </DialogDescription>
        </DialogHeader>

        <div className="flex-1 overflow-hidden flex flex-col gap-6">
          {/* Email Input */}
          <div className="space-y-2">
            <Label htmlFor="email">Email Address</Label>
            <div className="relative">
              <Mail className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                id="email"
                type="email"
                placeholder="user@example.com"
                value={email}
                onChange={(e) => handleEmailChange(e.target.value)}
                className={`pl-9 ${emailError ? "border-red-500" : ""}`}
                disabled={isSubmitting}
              />
            </div>
            {emailError && <p className="text-sm text-red-500">{emailError}</p>}
          </div>

          {/* Organization Role Info */}
          <div className="p-4 bg-muted rounded-lg">
            <div className="flex items-center justify-between">
              <div>
                <h4 className="text-sm font-medium">Organization Role</h4>
                <p className="text-sm text-muted-foreground">
                  The user will be granted read-only access to the organization
                </p>
              </div>
              <Badge className="bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200">Read</Badge>
            </div>
          </div>

          {/* Application Selection */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <Label className="text-sm font-medium">Application Access</Label>
              <div className="flex items-center space-x-2">
                <Checkbox id="select-all-apps" checked={isAllSelected} onCheckedChange={handleSelectAllApps} />
                <Label htmlFor="select-all-apps" className="text-sm font-medium">
                  Select All ({applications.length})
                </Label>
              </div>
            </div>

            {/* Applications List */}
            <div className="flex-1 overflow-auto border rounded-lg max-h-60">
              {isLoading ? (
                <div className="p-8 text-center">
                  <div className="flex items-center justify-center gap-2">
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Loading applications...
                  </div>
                </div>
              ) : applications.length === 0 ? (
                <div className="p-8 text-center text-muted-foreground">
                  No applications available in this organization.
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-12">Select</TableHead>
                      <TableHead>Application</TableHead>
                      <TableHead>Description</TableHead>
                      <TableHead className="w-32">Role</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {applications.map((app) => {
                      const isSelected = selectedApplications.has(app.id);

                      return (
                        <TableRow key={app.id}>
                          <TableCell>
                            <Checkbox
                              checked={isSelected}
                              onCheckedChange={(checked) => handleApplicationToggle(app.id, checked as boolean)}
                            />
                          </TableCell>
                          <TableCell>
                            <div className="flex items-center gap-2">
                              <div className="font-medium">{app.name}</div>
                              {isSelected && <CheckCircle2 className="h-4 w-4 text-green-600" />}
                            </div>
                          </TableCell>
                          <TableCell className="text-sm text-muted-foreground">
                            {app.description || "No description available"}
                          </TableCell>
                          <TableCell>
                            {isSelected ? (
                              <Select
                                value={applicationRoles[app.id] || "read"}
                                onValueChange={(value) => handleRoleChange(app.id, value)}
                              >
                                <SelectTrigger className="w-28">
                                  <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                  <SelectItem value="read">Read</SelectItem>
                                  <SelectItem value="write">Write</SelectItem>
                                  <SelectItem value="admin">Admin</SelectItem>
                                </SelectContent>
                              </Select>
                            ) : (
                              <span className="text-sm text-muted-foreground">-</span>
                            )}
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              )}
            </div>

            {/* Selected Applications Summary */}
            {selectedCount > 0 && (
              <div className="p-3 bg-muted rounded-lg">
                <div className="text-sm font-medium mb-2">
                  Selected {selectedCount} application{selectedCount !== 1 ? "s" : ""}:
                </div>
                <div className="flex flex-wrap gap-2">
                  {Array.from(selectedApplications).map((appId) => {
                    const app = applications.find((a) => a.id === appId);
                    const role = applicationRoles[appId] || "read";
                    return (
                      <div
                        key={appId}
                        className="flex items-center gap-1 bg-background rounded px-2 py-1 text-sm border"
                      >
                        <span className="font-medium">{app?.name}</span>
                        <span className="text-muted-foreground">-</span>
                        <Badge variant="secondary" className="text-xs px-1 py-0 h-4">
                          {role}
                        </Badge>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={isSubmitting}>
            Cancel
          </Button>
          <Button onClick={handleSubmit} disabled={!canSubmit}>
            {isSubmitting ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                {config?.organisation_invite_enabled ? "Sending Invite..." : "Adding User..."}
              </>
            ) : config?.organisation_invite_enabled ? (
              "Send Invite"
            ) : (
              "Add User"
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
