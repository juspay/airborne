"use client";
import { useEffect, useRef } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { apiFetch } from "@/lib/api";
import { useApp } from "@/providers/app-context";

export default function OAuthCallback() {
  const params = useSearchParams();
  const router = useRouter();
  const { setToken, setUser } = useApp();

  const processedCode = useRef(false);

  useEffect(() => {
    const code = params.get("code");
    const state = params.get("state") || undefined;
    if (!code && !processedCode.current) return;
    processedCode.current = true;
    (async () => {
      try {
        const oauthAction = localStorage.getItem("oauthAction") || "login";

        // Determine the correct endpoint based on the action
        const endpoint = oauthAction === "signup" ? "/users/oauth/signup" : "/users/oauth/login";
        const res = await apiFetch<{ user_id: string; user_token: any }>(endpoint, {
          method: "POST",
          body: { code, state },
        });
        console.log("token exchange", oauthAction, res);
        setToken(res.user_token?.access_token || "");
        setUser({ user_id: res.user_id, name: "" }); // OAuth users will get name from API response
        window.location.replace("/dashboard");
      } catch (e: any) {
        console.log("Google Callback Error", e);
        // Error toast will be shown automatically by apiFetch
        router.replace("/login");
      }
    })();
  }, []);

  return <div className="p-6">Completing sign-in...</div>;
}
