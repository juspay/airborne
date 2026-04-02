"use client";

import type React from "react";
import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { Checkbox } from "@/components/ui/checkbox";
import { Mail, Lock, Eye, EyeOff } from "lucide-react";
import Link from "next/link";
import Image from "next/image";
import { apiFetch } from "@/lib/api";
import { GENERIC_OIDC_PROVIDER, resolveOidcProviders } from "@/lib/oidc-providers";
import { useAppContext } from "@/providers/app-context";
import { useRouter } from "next/navigation";

export default function LoginPage() {
  const [name, setName] = useState(""); // API expects "name"
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [rememberMe, setRememberMe] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const { setToken, setUser, setOrg: setOrganisation, setApp: setApplication, token, config } = useAppContext();
  const router = useRouter();
  const configuredOidcProviders = resolveOidcProviders(config?.enabled_oidc_idps);
  const oidcLoginEnabled =
    config?.oidc_login_enabled ?? config?.google_signin_enabled ?? configuredOidcProviders.length > 0;
  const oidcProviders = oidcLoginEnabled
    ? configuredOidcProviders.length > 0
      ? configuredOidcProviders
      : [GENERIC_OIDC_PROVIDER]
    : [];
  const passwordLoginEnabled = config?.password_login_enabled ?? true;
  const registrationEnabled = config?.registration_enabled ?? false;

  useEffect(() => {
    if (token && token != "") {
      console.log("Nav to dashboard effect", token);
      router.replace("/dashboard");
    }
  }, [token, router]);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    try {
      const res = await apiFetch<any>("/users/login", {
        method: "POST",
        body: { name, password },
      });
      const token = res?.user_token?.access_token || "";
      setToken(token);
      setUser({ user_id: res?.user_id, name, is_super_admin: res?.is_super_admin || false });
      // default org/app selection from response if present
      const org = res?.organisations?.[0]?.name || "";
      const app = res?.organisations?.[0]?.applications?.[0]?.application || "";
      if (org) setOrganisation(org);
      if (app) setApplication(app);
      // if(res?.user_token?.access_token) window.location.href = "/dashboard"
    } catch (err: any) {
      console.log("Login Error", err);
      // Error toast will be shown automatically by apiFetch
    } finally {
      setIsLoading(false);
    }
  };

  const handleOidcLogin = async (idp?: string) => {
    setIsLoading(true);
    try {
      const data = await apiFetch<{ auth_url: string; state?: string }>(
        "/users/oauth/url",
        idp ? { query: { idp } } : {}
      );
      if (data?.auth_url) {
        localStorage.setItem("oauthAction", "login");
        window.location.href = data.auth_url;
      } else {
        throw new Error("OAuth URL not available");
      }
    } catch (e: any) {
      console.log("OIDC Login Error", e);
      setIsLoading(false);
      // Error toast will be shown automatically by apiFetch
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-background to-primary/5 flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        {/* Logo and Brand */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center gap-3 mb-4">
            <div className="h-20 rounded-xl flex items-center justify-center">
              <Image
                src="/airborne-logo-light.svg"
                alt="Airborne Logo"
                width={28}
                height={12}
                className="w-28 mr-2 text-primary-foreground dark:hidden"
              />
              <Image
                src="/airborne-logo-dark.svg"
                alt="Airborne Logo"
                width={28}
                height={12}
                className="w-28 mr-2 text-primary-foreground hidden dark:block"
              />
            </div>
          </div>
          <h1 className="text-2xl font-bold font-[family-name:var(--font-space-grotesk)] text-balance mb-2">
            Welcome back
          </h1>
          <p className="text-muted-foreground">Sign in to your account to continue</p>
        </div>

        <Card className="border-0 shadow-lg">
          <CardHeader className="space-y-1 pb-4">
            <CardTitle className="text-xl font-[family-name:var(--font-space-grotesk)]">Sign in</CardTitle>
            <CardDescription>Enter your credentials to access your account</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Google Sign In */}
            {oidcProviders.length > 0 && (
              <>
                {oidcProviders.map((provider) => (
                  <Button
                    key={provider.id || "oidc"}
                    variant="outline"
                    className="w-full h-11 bg-transparent"
                    onClick={() => handleOidcLogin(provider.id || undefined)}
                    disabled={isLoading}
                  >
                    <provider.Icon className="mr-2 h-4 w-4" />
                    {`Continue with ${provider.label}`}
                  </Button>
                ))}
                {passwordLoginEnabled && (
                  <div className="relative">
                    <div className="absolute inset-0 flex items-center">
                      <Separator className="w-full" />
                    </div>
                    <div className="relative flex justify-center text-xs uppercase">
                      <span className="bg-card px-2 text-muted-foreground">Or continue with</span>
                    </div>
                  </div>
                )}
              </>
            )}

            {/* Email/Password Form */}
            {passwordLoginEnabled && (
              <form onSubmit={handleLogin} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="name">Username</Label>
                  <div className="relative">
                    <Mail className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input
                      id="name"
                      placeholder="e.g. alice"
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      className="pl-10"
                      required
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="password">Password</Label>
                  <div className="relative">
                    <Lock className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input
                      id="password"
                      type={showPassword ? "text" : "password"}
                      placeholder="Enter your password"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      className="pl-10 pr-10"
                      required
                    />
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      className="absolute right-0 top-0 h-full px-3 py-2 hover:bg-transparent"
                      onClick={() => setShowPassword(!showPassword)}
                    >
                      {showPassword ? (
                        <EyeOff className="h-4 w-4 text-muted-foreground" />
                      ) : (
                        <Eye className="h-4 w-4 text-muted-foreground" />
                      )}
                    </Button>
                  </div>
                </div>

                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-2">
                    <Checkbox
                      id="remember"
                      checked={rememberMe}
                      onCheckedChange={(checked) => setRememberMe(checked as boolean)}
                    />
                    <Label htmlFor="remember" className="text-sm font-normal">
                      Remember me
                    </Label>
                  </div>
                  {registrationEnabled && (
                    <Link href="/register" className="text-sm text-primary hover:underline">
                      Create account
                    </Link>
                  )}
                </div>

                <Button type="submit" className="w-full h-11" disabled={isLoading}>
                  {isLoading ? "Signing in..." : "Sign in"}
                </Button>
              </form>
            )}

            {registrationEnabled && (
              <div className="text-center text-sm">
                <span className="text-muted-foreground">Don&#39;t have an account? </span>
                <Link href="/register" className="text-primary hover:underline font-medium">
                  Sign up
                </Link>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Footer */}
        <div className="text-center mt-8 text-xs text-muted-foreground">
          <p>
            By signing in, you agree to our{" "}
            <Link href="/terms-of-use" className="hover:underline">
              Terms of Use
            </Link>{" "}
            and{" "}
            <Link href="/privacy-policy" className="hover:underline">
              Privacy Policy
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}
