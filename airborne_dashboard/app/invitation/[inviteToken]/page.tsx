"use client";

import type React from "react";
import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { AlertCircle, Mail, Building, UserCheck, UserX, Loader2 } from "lucide-react";
import Link from "next/link";
import Image from "next/image";
import {
  validateInviteToken as apiValidateInviteToken,
  acceptInvite as apiAcceptInvite,
  declineInvite as apiDeclineInvite,
} from "@/lib/invitation";
import { useAppContext } from "@/providers/app-context";
import { toastSuccess, toastError } from "@/hooks/use-toast";
import { useRouter, useParams } from "next/navigation";
import { Alert, AlertDescription } from "@/components/ui/alert";

interface InviteDetails {
  invite_id: string;
  email: string;
  organization: string;
  role: string;
  status: string;
  created_at: string;
  inviter?: string;
}

type InviteStatus = "loading" | "valid" | "invalid" | "expired" | "accepted" | "permission_denied";

export default function InvitationPage() {
  const router = useRouter();
  const params = useParams();
  const { user, token, updateOrgs, config } = useAppContext();
  const [inviteStatus, setInviteStatus] = useState<InviteStatus>("loading");
  const [inviteDetails, setInviteDetails] = useState<InviteDetails | null>(null);
  const [isAccepting, setIsAccepting] = useState(false);
  const [isRejecting, setIsRejecting] = useState(false);

  const inviteToken = params?.inviteToken as string;

  useEffect(() => {
    if (!inviteToken) {
      setInviteStatus("invalid");
      return;
    }

    // Always validate the token first, regardless of auth status
    validateInviteToken();
  }, [inviteToken, token, user]);

  const validateInviteToken = async () => {
    try {
      const details = await apiValidateInviteToken(inviteToken, token || undefined);

      // For authenticated users, check if the invite is for their email
      if (token && user && details.email !== user.name) {
        setInviteStatus("permission_denied");
        return;
      }

      setInviteStatus("valid");
      setInviteDetails(details);
    } catch (error: any) {
      console.error("Invite validation error:", error);

      if (error.message?.includes("expired")) {
        setInviteStatus("expired");
      } else if (error.message?.includes("Invalid")) {
        setInviteStatus("invalid");
      } else if (error.status === 404) {
        setInviteStatus("invalid");
      } else {
        setInviteStatus("invalid");
      }
    }
  };

  const handleAcceptInvite = async () => {
    if (!inviteToken || !token || !inviteDetails?.invite_id) return;

    setIsAccepting(true);
    try {
      const response = await apiAcceptInvite(inviteDetails.invite_id, inviteToken, token);

      toastSuccess("Invitation Accepted", response.message);

      // Refresh organizations list before redirecting
      await updateOrgs();

      // Redirect to dashboard or organization page
      router.push("/dashboard");
    } catch (error: any) {
      console.error("Accept invite error:", error);
      toastError("Failed to Accept", error.message || "Could not accept invitation");
    } finally {
      setIsAccepting(false);
    }
  };

  const handleDeclineInvite = async () => {
    if (!inviteToken || !token || !inviteDetails?.invite_id) return;

    setIsRejecting(true);
    try {
      const response = await apiDeclineInvite(inviteDetails.invite_id, inviteToken, token);

      toastSuccess("Invitation Declined", response.message);

      // Redirect to dashboard
      router.push("/dashboard");
    } catch (error: any) {
      console.error("Decline invite error:", error);
      toastError("Failed to Decline", error.message || "Could not decline invitation");
    } finally {
      setIsRejecting(false);
    }
  };

  const getRoleColor = (role: string) => {
    switch (role.toLowerCase()) {
      case "admin":
        return "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200";
      case "write":
        return "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200";
      case "read":
        return "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200";
      default:
        return "bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-200";
    }
  };

  // Loading state
  if (inviteStatus === "loading") {
    return (
      <div className="min-h-screen bg-gradient-to-br from-background via-background to-primary/5 flex items-center justify-center p-4">
        <Card className="w-full max-w-md">
          <CardContent className="flex flex-col items-center justify-center py-12">
            <Loader2 className="h-8 w-8 animate-spin text-primary mb-4" />
            <p className="text-muted-foreground">Validating invitation...</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Error states
  if (inviteStatus === "invalid" || inviteStatus === "expired" || inviteStatus === "permission_denied") {
    return (
      <div className="min-h-screen bg-gradient-to-br from-background via-background to-primary/5 flex items-center justify-center p-4">
        <Card className="w-full max-w-md">
          <CardHeader className="text-center">
            <div className="mx-auto mb-4 h-12 w-12 rounded-full bg-destructive/10 flex items-center justify-center">
              <AlertCircle className="h-6 w-6 text-destructive" />
            </div>
            <CardTitle className="text-xl">
              {inviteStatus === "expired" && "Invitation Expired"}
              {inviteStatus === "invalid" && "Invalid Invitation"}
              {inviteStatus === "permission_denied" && "Access Denied"}
            </CardTitle>
            <CardDescription>
              {inviteStatus === "expired" && "This invitation link has expired and is no longer valid."}
              {inviteStatus === "invalid" && "This invitation link is invalid or has already been used."}
              {inviteStatus === "permission_denied" && "This invitation is not for your account."}
            </CardDescription>
          </CardHeader>
          <CardContent className="text-center">
            <Button asChild variant="outline">
              <Link href="/dashboard">Go to Dashboard</Link>
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Feature not available
  if (config?.organisation_invite_enabled === false) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-background via-background to-primary/5 flex items-center justify-center p-4">
        <Card className="w-full max-w-md">
          <CardHeader className="text-center">
            <div className="mx-auto mb-4 h-12 w-12 rounded-full bg-destructive/10 flex items-center justify-center">
              <AlertCircle className="h-6 w-6 text-destructive" />
            </div>
            <CardTitle className="text-xl">Not available</CardTitle>
            <CardDescription>
              The resource you were requesting for is not available due to configuration settings.
            </CardDescription>
          </CardHeader>
          <CardContent className="text-center">
            <Button asChild variant="outline">
              <Link href="/dashboard">Go to Dashboard</Link>
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Already accepted state
  if (inviteStatus === "accepted") {
    return (
      <div className="min-h-screen bg-gradient-to-br from-background via-background to-primary/5 flex items-center justify-center p-4">
        <Card className="w-full max-w-md">
          <CardHeader className="text-center">
            <div className="mx-auto mb-4 h-12 w-12 rounded-full bg-green-100 dark:bg-green-900 flex items-center justify-center">
              <UserCheck className="h-6 w-6 text-green-600 dark:text-green-400" />
            </div>
            <CardTitle className="text-xl">Already accepted</CardTitle>
            <CardDescription>This invitation is already accepted.</CardDescription>
          </CardHeader>
          <CardContent className="text-center">
            <Button asChild>
              <Link href="/dashboard">Go to Dashboard</Link>
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Valid invite - show accept/decline UI
  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-background to-primary/5 flex items-center justify-center p-4">
      <div className="w-full max-w-lg">
        {/* Header with logo */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center gap-3 mb-4">
            <div className="h-16 rounded-xl flex items-center justify-center">
              <Image
                src="/airborne-logo-light.svg"
                alt="Airborne Logo"
                width={32}
                height={14}
                className="w-32 text-primary-foreground dark:hidden"
              />
              <Image
                src="/airborne-logo-dark.svg"
                alt="Airborne Logo"
                width={32}
                height={14}
                className="w-32 text-primary-foreground hidden dark:block"
              />
            </div>
          </div>
        </div>

        <Card className="border-0 shadow-lg">
          <CardHeader className="text-center pb-4">
            <div className="mx-auto mb-4 h-16 w-16 rounded-full bg-primary/10 flex items-center justify-center">
              <Building className="h-8 w-8 text-primary" />
            </div>
            <CardTitle className="text-2xl font-[family-name:var(--font-space-grotesk)]">
              Organization Invitation
            </CardTitle>
            <CardDescription className="text-base">You&rsquo;ve been invited to join an organization</CardDescription>
          </CardHeader>

          <CardContent className="space-y-6">
            {/* Invitation Details */}
            <div className="space-y-4">
              <Alert>
                <Mail className="h-4 w-4" />
                <AlertDescription>
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-muted-foreground">Organization:</span>
                      <span className="font-semibold">{inviteDetails?.organization}</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-muted-foreground">Role:</span>
                      <Badge className={getRoleColor(inviteDetails?.role || "")}>{inviteDetails?.role}</Badge>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-muted-foreground">Invited email:</span>
                      <span className="font-mono text-sm">{inviteDetails?.email}</span>
                    </div>
                  </div>
                </AlertDescription>
              </Alert>

              {/* Role Description */}
              <div className="text-sm text-muted-foreground bg-muted/50 rounded-lg p-4">
                <p className="font-medium mb-2">This role will give you:</p>
                <ul className="space-y-1">
                  {inviteDetails?.role === "admin" && (
                    <>
                      <li>• Full administrative access</li>
                      <li>• Manage users and permissions</li>
                      <li>• Create and manage applications</li>
                      <li>• Access to all organization features</li>
                    </>
                  )}
                  {inviteDetails?.role === "write" && (
                    <>
                      <li>• Create and edit applications</li>
                      <li>• Manage deployments and releases</li>
                      <li>• View analytics and reports</li>
                      <li>• Collaborate with team members</li>
                    </>
                  )}
                  {inviteDetails?.role === "read" && (
                    <>
                      <li>• View applications and data</li>
                      <li>• Access analytics and reports</li>
                      <li>• Download deployment artifacts</li>
                      <li>• View team activity</li>
                    </>
                  )}
                </ul>
              </div>
            </div>

            <Separator />

            {/* Action buttons */}
            {token && user ? (
              // Authenticated user - show accept/decline buttons
              <div className="flex flex-col sm:flex-row gap-3">
                <Button onClick={handleAcceptInvite} disabled={isAccepting || isRejecting} className="flex-1 h-11">
                  {isAccepting ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Accepting...
                    </>
                  ) : (
                    <>
                      <UserCheck className="mr-2 h-4 w-4" />
                      Accept Invitation
                    </>
                  )}
                </Button>

                <Button
                  variant="outline"
                  onClick={handleDeclineInvite}
                  disabled={isAccepting || isRejecting}
                  className="flex-1 h-11"
                >
                  {isRejecting ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Declining...
                    </>
                  ) : (
                    <>
                      <UserX className="mr-2 h-4 w-4" />
                      Decline
                    </>
                  )}
                </Button>
              </div>
            ) : (
              // Non-authenticated user - show login/register options
              <div className="space-y-4">
                <div className="text-center text-sm text-muted-foreground">
                  <p>To accept this invitation, you need to sign in or create an account.</p>
                </div>
                <div className="flex flex-col sm:flex-row gap-3">
                  <Button asChild className="flex-1 h-11">
                    <Link
                      href={`/login?invite_token=${inviteToken}&email=${encodeURIComponent(inviteDetails?.email || "")}&redirect_to=${encodeURIComponent(`/invitation/${inviteToken}`)}`}
                    >
                      Sign In
                    </Link>
                  </Button>

                  <Button asChild variant="outline" className="flex-1 h-11">
                    <Link
                      href={`/register?invite_token=${inviteToken}&redirect_to=${encodeURIComponent(`/invitation/${inviteToken}`)}`}
                    >
                      Create Account
                    </Link>
                  </Button>
                </div>
              </div>
            )}

            {/* Footer */}
            {token && user && (
              <div className="text-center text-sm text-muted-foreground">
                <p>
                  Not {user?.name}?{" "}
                  <Link href="/login" className="text-primary hover:underline">
                    Sign in with a different account
                  </Link>
                </p>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
