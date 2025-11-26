"use client";

import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Home, Plane } from "lucide-react";
import Link from "next/link";
import Image from "next/image";

export default function NotFound() {
  return (
    <div className="min-h-screen w-full flex items-center justify-center bg-gradient-to-br from-background via-background to-muted/20 p-6">
      <Card className="max-w-2xl w-full border-2">
        <CardContent className="px-6 py-16 text-center">
          {/* Animated Airborne Logo */}
          <div className="relative mb-8 inline-block">
            <div className="absolute inset-0 animate-pulse opacity-30 blur-sm">
              <Image
                src="/airborne-logo-light.svg"
                alt="Airborne Logo"
                width={200}
                height={80}
                className="w-48 dark:hidden"
              />
              <Image
                src="/airborne-logo-dark.svg"
                alt="Airborne Logo"
                width={200}
                height={80}
                className="w-48 hidden dark:block"
              />
            </div>
            <div className="relative">
              <Image
                src="/airborne-logo-light.svg"
                alt="Airborne Logo"
                width={200}
                height={80}
                className="w-48 dark:hidden"
              />
              <Image
                src="/airborne-logo-dark.svg"
                alt="Airborne Logo"
                width={200}
                height={80}
                className="w-48 hidden dark:block"
              />
            </div>
          </div>

          {/* 404 Text */}
          <h1 className="text-8xl font-bold font-[family-name:var(--font-space-grotesk)] mb-4 bg-gradient-to-r from-primary via-primary/80 to-primary/60 bg-clip-text text-transparent">
            404
          </h1>

          {/* Main Message */}
          <h2 className="text-3xl font-bold font-[family-name:var(--font-space-grotesk)] mb-4">
            Flight Path Not Found
          </h2>

          <p className="text-lg text-muted-foreground mb-8 max-w-md mx-auto">
            Looks like this airborne route doesn&apos;t exist. The page you&apos;re looking for has taken off to an
            unknown destination.
          </p>

          {/* Action Buttons */}
          <div className="flex flex-col sm:flex-row gap-4 justify-center items-center">
            <Button asChild size="lg" className="min-w-[200px]">
              <Link
                href="/dashboard"
                replace={true}
                onNavigate={() => {
                  window.location.href = "/dashboard";
                }}
              >
                <Home className="mr-2 h-5 w-5" />
                Back to Dashboard
              </Link>
            </Button>
            <Button asChild variant="outline" size="lg" className="min-w-[200px]">
              <Link href="/">
                <Plane className="mr-2 h-5 w-5" />
                Go to Home
              </Link>
            </Button>
          </div>

          {/* Decorative Element */}
          <div className="mt-16 text-sm text-muted-foreground/60">
            <p>Error Code: 404 | Page Not Found</p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
