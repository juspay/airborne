"use client";

import React, { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import {
  Pagination,
  PaginationContent,
  PaginationEllipsis,
  PaginationItem,
  PaginationLink,
  PaginationNext,
  PaginationPrevious,
} from "@/components/ui/pagination";
import {
  Search,
  Mail,
  MoreVertical,
  Trash2,
  RefreshCw,
  Clock,
  CheckCircle,
  XCircle,
  UserPlus,
  Users,
} from "lucide-react";
import { useDebouncedValue } from "@/hooks/useDebouncedValue";
import { ListInvitesResponse } from "@/types/invitation";
import { formatDistanceToNow, parseISO } from "date-fns";
import { ApplicationAccessModal } from "./application-access-modal";
import { OrganizationAccessModal } from "./organization-access-modal";

// Types for the new modal data
interface OrgUser {
  id: string;
  name: string;
  email: string;
  username: string;
  roles?: string[];
}

interface Application {
  id: string;
  name: string;
  description?: string;
}

export interface InviteManagementProps {
  data: ListInvitesResponse | undefined;
  onRevokeInvite: (inviteId: string) => Promise<void>;
  onRefresh: () => void;
  onSearchChange?: (search: string) => void;
  onStatusFilterChange?: (status: string) => void;
  onPageChange?: (page: number) => void;
  searchTerm?: string;
  statusFilter?: string;
  isLoading?: boolean;

  // New props for the modals
  showInviteButtons?: boolean;
  entityType?: "organization" | "application";

  // For Organization Access Modal
  organizationName?: string;
  applications?: Application[];
  onOrganizationInvite?: (invite: {
    email: string;
    orgRole: string;
    applications: { name: string; level: string }[];
  }) => Promise<void>;

  // For Application Access Modal
  applicationName?: string;
  orgUsers?: OrgUser[];
  availableRoles?: string[];
  onApplicationInvite?: (invites: { userId: string; role: string }[]) => Promise<void>;

  // Loading states
  isLoadingOrgUsers?: boolean;
  isLoadingApplications?: boolean;
}

const ROLE_COLORS = {
  admin: "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200",
  write: "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200",
  read: "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200",
};

const STATUS_CONFIG = {
  pending: {
    icon: Clock,
    color: "bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200",
    label: "Pending",
  },
  accepted: {
    icon: CheckCircle,
    color: "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200",
    label: "Accepted",
  },
  declined: {
    icon: XCircle,
    color: "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200",
    label: "Declined",
  },
  expired: {
    icon: XCircle,
    color: "bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-200",
    label: "Expired",
  },
};

export function InviteManagement({
  data,
  onRevokeInvite,
  onRefresh,
  onSearchChange,
  onStatusFilterChange,
  onPageChange,
  searchTerm = "",
  statusFilter = "all",
  isLoading,
  showInviteButtons = false,
  entityType = "organization",
  organizationName,
  applications = [],
  onOrganizationInvite,
  applicationName,
  orgUsers = [],
  availableRoles,
  onApplicationInvite,
  isLoadingOrgUsers = false,
  isLoadingApplications = false,
}: InviteManagementProps) {
  const [isRevoking, setIsRevoking] = useState<string | null>(null);
  const [localSearchTerm, setLocalSearchTerm] = useState(searchTerm);

  // Modal states
  const [isOrgAccessModalOpen, setIsOrgAccessModalOpen] = useState(false);
  const [isAppAccessModalOpen, setIsAppAccessModalOpen] = useState(false);

  const invites = data?.invites || [];
  const pagination = data?.pagination;

  // Debounce the search term to avoid excessive API calls
  const debouncedSearchTerm = useDebouncedValue(localSearchTerm, 300);

  // Effect to call the parent callback when debounced value changes
  React.useEffect(() => {
    if (debouncedSearchTerm !== searchTerm) {
      onSearchChange?.(debouncedSearchTerm);
    }
  }, [debouncedSearchTerm, onSearchChange, searchTerm]);

  // Sync local state when prop changes (e.g., when resetting from parent)
  React.useEffect(() => {
    if (searchTerm !== localSearchTerm) {
      setLocalSearchTerm(searchTerm);
    }
  }, [searchTerm]);

  const handleRevokeInvite = async (inviteId: string) => {
    setIsRevoking(inviteId);
    try {
      await onRevokeInvite(inviteId);
    } finally {
      setIsRevoking(null);
    }
  };

  // Modal handlers
  const handleOrganizationInvite = async (invite: {
    email: string;
    orgRole: string;
    applications: { name: string; level: string }[];
  }) => {
    if (onOrganizationInvite) {
      await onOrganizationInvite(invite);
      onRefresh(); // Refresh the invites list
    }
  };

  const handleApplicationInvite = async (invites: { userId: string; role: string }[]) => {
    if (onApplicationInvite) {
      await onApplicationInvite(invites);
      onRefresh(); // Refresh the invites list
    }
  };

  const getStatusBadge = (status: string) => {
    const config = STATUS_CONFIG[status as keyof typeof STATUS_CONFIG] || STATUS_CONFIG.pending;
    const Icon = config.icon;

    return (
      <Badge className={config.color}>
        <Icon className="h-3 w-3 mr-1" />
        {config.label}
      </Badge>
    );
  };

  const getRoleBadge = (role: string) => {
    const colorClass = ROLE_COLORS[role as keyof typeof ROLE_COLORS] || "bg-gray-100 text-gray-800";

    return <Badge className={colorClass}>{role.charAt(0).toUpperCase() + role.slice(1)}</Badge>;
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <Mail className="h-5 w-5" />
              Invitations
            </CardTitle>
            <p className="text-sm text-muted-foreground mt-1">
              {entityType === "organization"
                ? "Manage organization invitations and their status"
                : "Manage application invitations and their status"}
            </p>
          </div>
          <div className="flex items-center gap-2">
            {showInviteButtons && (
              <>
                {entityType === "organization" ? (
                  <Button onClick={() => setIsOrgAccessModalOpen(true)} size="sm">
                    <UserPlus className="h-4 w-4 mr-2" />
                    Invite to Organization
                  </Button>
                ) : (
                  <Button onClick={() => setIsAppAccessModalOpen(true)} size="sm">
                    <Users className="h-4 w-4 mr-2" />
                    Grant App Access
                  </Button>
                )}
              </>
            )}
            <Button variant="outline" size="sm" onClick={onRefresh} disabled={isLoading}>
              <RefreshCw className={`h-4 w-4 mr-2 ${isLoading ? "animate-spin" : ""}`} />
              Refresh
            </Button>
          </div>
        </div>
      </CardHeader>

      <CardContent className="space-y-4">
        {/* Filters */}
        <div className="flex flex-col sm:flex-row gap-4">
          <div className="flex-1">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search invitations..."
                value={localSearchTerm}
                onChange={(e) => setLocalSearchTerm(e.target.value)}
                className="max-w-sm pl-10"
              />
            </div>
          </div>

          <Select value={statusFilter} onValueChange={onStatusFilterChange}>
            <SelectTrigger className="w-full sm:w-48">
              <SelectValue placeholder="Filter by status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Status</SelectItem>
              <SelectItem value="pending">Pending</SelectItem>
              <SelectItem value="accepted">Accepted</SelectItem>
              <SelectItem value="declined">Declined</SelectItem>
              <SelectItem value="expired">Expired</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* Invitations Table */}
        <div className="border rounded-lg">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Email</TableHead>
                <TableHead>Role</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Invited</TableHead>
                <TableHead className="w-[50px]">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {invites.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={5} className="text-center py-8 text-muted-foreground">
                    {debouncedSearchTerm || statusFilter !== "all"
                      ? "No invitations match the current filters."
                      : "No invitations found."}
                  </TableCell>
                </TableRow>
              ) : (
                invites.map((invite) => (
                  <TableRow key={invite.id}>
                    <TableCell className="font-mono text-sm">{invite.email}</TableCell>
                    <TableCell>{getRoleBadge(invite.role)}</TableCell>
                    <TableCell>{getStatusBadge(invite.status)}</TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {formatDistanceToNow(parseISO(invite.created_at), { addSuffix: true })}
                    </TableCell>
                    <TableCell>
                      {invite.status === "pending" && (
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button
                              variant="ghost"
                              size="sm"
                              className="h-8 w-8 p-0"
                              disabled={isRevoking === invite.id}
                            >
                              <MoreVertical className="h-4 w-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem
                              onClick={() => handleRevokeInvite(invite.id)}
                              className="text-destructive focus:text-destructive"
                              disabled={isRevoking === invite.id}
                            >
                              {isRevoking === invite.id ? (
                                <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                              ) : (
                                <Trash2 className="h-4 w-4 mr-2" />
                              )}
                              Revoke Invitation
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      )}
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>

        {/* Summary and Pagination */}
        <div className="pt-4 border-t space-y-4">
          <div className="flex items-center justify-between">
            <div className="text-sm text-muted-foreground">
              {pagination ? (
                pagination.total_items > 0 ? (
                  <>
                    Showing {(pagination.current_page - 1) * pagination.per_page + 1}-
                    {Math.min(pagination.current_page * pagination.per_page, pagination.total_items)} of{" "}
                    {pagination.total_items} invitations
                  </>
                ) : (
                  <>No invitations</>
                )
              ) : (
                <>Showing {invites.length} invitations</>
              )}
            </div>
            <div className="flex items-center gap-2">
              <Button onClick={onRefresh} variant="outline" size="sm">
                <RefreshCw className="h-4 w-4 mr-2" />
                Refresh
              </Button>
            </div>
          </div>

          {pagination && pagination.total_pages > 1 && (
            <div className="flex justify-center">
              <Pagination>
                <PaginationContent>
                  <PaginationItem>
                    <PaginationPrevious
                      onClick={() => onPageChange?.(Math.max(1, pagination.current_page - 1))}
                      className={pagination.current_page <= 1 ? "pointer-events-none opacity-50" : "cursor-pointer"}
                    />
                  </PaginationItem>
                  {Array.from({ length: pagination.total_pages }, (_, i) => i + 1)
                    .filter((page) => {
                      const current = pagination.current_page;
                      return (
                        page === 1 || page === pagination.total_pages || (page >= current - 1 && page <= current + 1)
                      );
                    })
                    .map((page, index, pages) => (
                      <React.Fragment key={page}>
                        {index > 0 && pages[index - 1] < page - 1 && (
                          <PaginationItem key={`ellipsis-${page}`}>
                            <PaginationEllipsis />
                          </PaginationItem>
                        )}
                        <PaginationItem>
                          <PaginationLink
                            onClick={() => onPageChange?.(page)}
                            isActive={page === pagination.current_page}
                            className="cursor-pointer"
                          >
                            {page}
                          </PaginationLink>
                        </PaginationItem>
                      </React.Fragment>
                    ))}
                  <PaginationItem>
                    <PaginationNext
                      onClick={() => onPageChange?.(Math.min(pagination.total_pages, pagination.current_page + 1))}
                      className={
                        pagination.current_page >= pagination.total_pages
                          ? "pointer-events-none opacity-50"
                          : "cursor-pointer"
                      }
                    />
                  </PaginationItem>
                </PaginationContent>
              </Pagination>
            </div>
          )}
        </div>
      </CardContent>

      {/* Organization Access Modal */}
      <OrganizationAccessModal
        isOpen={isOrgAccessModalOpen}
        onClose={() => setIsOrgAccessModalOpen(false)}
        onSubmit={handleOrganizationInvite}
        applications={applications}
        organizationName={organizationName || ""}
        isLoading={isLoadingApplications}
      />

      {/* Application Access Modal */}
      <ApplicationAccessModal
        isOpen={isAppAccessModalOpen}
        onClose={() => setIsAppAccessModalOpen(false)}
        onSubmit={handleApplicationInvite}
        orgUsers={orgUsers}
        applicationName={applicationName || ""}
        availableRoles={availableRoles}
        isLoading={isLoadingOrgUsers}
      />
    </Card>
  );
}
