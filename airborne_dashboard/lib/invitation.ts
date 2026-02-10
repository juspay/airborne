import {
  AcceptInviteResponse,
  DeclineInviteResponse,
  InviteDetails,
  ListInvitesResponse,
  ValidateInviteResponse,
} from "@/types/invitation";
import { apiFetch } from "./api";

export async function validateInviteToken(token: string, _authToken?: string): Promise<InviteDetails> {
  try {
    const response = await apiFetch<ValidateInviteResponse>("/organisation/user/invite/validate", {
      method: "POST",
      body: { token },
      requireAuth: false, // Allow validation without authentication
      showErrorToast: false, // We'll handle errors manually
    });

    if (!response.valid) {
      throw new Error("Invalid invite token");
    }

    // Convert backend response to InviteDetails format
    return {
      invite_id: response.invite_id,
      email: response.email,
      organization: response.organization,
      role: response.role,
      status: response.status,
      created_at: response.created_at,
      inviter: response.inviter,
    };
  } catch (error: any) {
    // Handle specific error cases
    if (error.message?.includes("Invalid or expired")) {
      throw new Error("Invite token has expired or is invalid");
    }

    if (error.status === 404) {
      throw new Error("Invalid invite token");
    }

    // Re-throw other errors
    throw error;
  }
}

export async function acceptInvite(inviteId: string, token: string, authToken: string): Promise<AcceptInviteResponse> {
  return apiFetch<AcceptInviteResponse>(`/organisations/user/invite/${inviteId}/accept`, {
    method: "POST",
    body: { token },
    headers: {
      Authorization: `Bearer ${authToken}`,
    },
  });
}

export async function declineInvite(
  inviteId: string,
  token: string,
  authToken: string
): Promise<DeclineInviteResponse> {
  return apiFetch<DeclineInviteResponse>(`/organisations/user/invite/${inviteId}/decline`, {
    method: "POST",
    body: { token },
    headers: {
      Authorization: `Bearer ${authToken}`,
    },
  });
}

export async function listInvites(
  authToken: string,
  orgId: string,
  params?: {
    search?: string;
    status?: string;
    page?: number;
    per_page?: number;
  }
): Promise<ListInvitesResponse> {
  return apiFetch<ListInvitesResponse>("/organisations/user/invite/list", {
    method: "GET",
    query: params,
    showErrorToast: false,
    headers: {
      Authorization: `Bearer ${authToken}`,
      "x-organisation": orgId,
    },
  });
}

// Revoke an invitation
export async function revokeInvite(
  inviteId: string,
  authToken: string,
  orgId: string
): Promise<{ success: boolean; message: string }> {
  return apiFetch<{ success: boolean; message: string }>(`/organisations/user/invite/${inviteId}/revoke`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${authToken}`,
      "x-organisation": orgId,
    },
  });
}

// Send organization invitation
export async function sendOrganizationInvite(
  invite: {
    email: string;
    orgRole: string;
    applications: string[];
  },
  authToken: string,
  orgId: string
): Promise<{ success: boolean; message: string }> {
  return apiFetch<{ success: boolean; message: string }>("/organisations/user/invite", {
    method: "POST",
    body: {
      email: invite.email,
      org_role: invite.orgRole,
      applications: invite.applications,
    },
    headers: {
      Authorization: `Bearer ${authToken}`,
      "x-organisation": orgId,
    },
  });
}

// Send application access invitations
export async function sendApplicationInvites(
  invites: Array<{
    userId: string;
    role: string;
  }>,
  authToken: string,
  orgId: string,
  appId: string
): Promise<{ success: boolean; message: string; invited_count: number }> {
  return apiFetch<{ success: boolean; message: string; invited_count: number }>("/applications/user/invite/grant", {
    method: "POST",
    body: {
      user_invites: invites.map((invite) => ({
        user_id: invite.userId,
        role: invite.role,
      })),
    },
    headers: {
      Authorization: `Bearer ${authToken}`,
      "x-organisation": orgId,
      "x-application": appId,
    },
  });
}
