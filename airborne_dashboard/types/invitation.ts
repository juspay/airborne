export interface InviteDetails {
  email: string;
  organization: string;
  role: string;
  status: string;
  created_at: string;
  inviter?: string;
}

export interface ValidateInviteResponse {
  valid: boolean;
  email: string;
  organization: string;
  role: string;
  status: string;
  created_at: string;
  inviter?: string;
}

export interface AcceptInviteResponse {
  success: boolean;
  message: string;
  organization: string;
  role: string;
}

// List invitations for an organization
export interface ListInvitesResponse {
  invites: InviteListItem[];
  pagination: {
    current_page: number;
    per_page: number;
    total_items: number;
    total_pages: number;
  };
}

export interface InviteListItem {
  id: string;
  email: string;
  role: string;
  status: string;
  created_at: string;
}

// New types for the enhanced invitation system
export interface OrganizationInviteRequest {
  email: string;
  orgRole: string;
  applications: string[];
}

export interface ApplicationInviteRequest {
  userId: string;
  role: string;
}

export interface InviteResponse {
  success: boolean;
  message: string;
}

export interface ApplicationInviteResponse extends InviteResponse {
  invited_count: number;
}
