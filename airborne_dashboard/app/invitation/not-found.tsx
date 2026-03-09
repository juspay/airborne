"use client";

import type React from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { AlertCircle } from "lucide-react";
import Link from "next/link";
import Image from "next/image";

export default function InvitationNotFound() {
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
            <div className="mx-auto mb-4 h-16 w-16 rounded-full bg-destructive/10 flex items-center justify-center">
              <AlertCircle className="h-8 w-8 text-destructive" />
            </div>
            <CardTitle className="text-2xl font-[family-name:var(--font-space-grotesk)]">
              Invitation Not Found
            </CardTitle>
            <CardDescription className="text-base">
              The invitation you&rsquo;re looking for doesn&rsquo;t exist or has been removed.
            </CardDescription>
          </CardHeader>

          <CardContent className="space-y-6 text-center">
            <div className="text-sm text-muted-foreground space-y-2">
              <p>This invitation link may be:</p>
              <ul className="text-left max-w-sm mx-auto space-y-1">
                <li>• Invalid or malformed</li>
                <li>• Already used or accepted</li>
                <li>• Expired or revoked</li>
                <li>• From an older system version</li>
              </ul>
            </div>

            <div className="flex flex-col sm:flex-row gap-3 justify-center">
              <Button asChild>
                <Link href="/dashboard">Go to Dashboard</Link>
              </Button>

              <Button asChild variant="outline">
                <Link href="/login">Sign In</Link>
              </Button>
            </div>

            <div className="text-center text-sm text-muted-foreground">
              <p>
                Need help?{" "}
                <Link href="mailto:superposition@juspay.in" className="text-primary hover:underline">
                  Contact support
                </Link>
              </p>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
