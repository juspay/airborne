"use client";
import { useEffect, useRef } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { apiFetch } from "@/lib/api";
import { useApp } from "@/providers/app-context";

const actionToEndpoint: Record<string, string> = {
  signup: "/users/oauth/signup",
  login: "/users/oauth/login",
  generate_pat: "/token/oauth",
};

// Login/Signup response shape
type OAuthUserResponse = {
  user_id: string;
  user_token: { access_token: string };
  username: string;
  is_super_admin: boolean;
  organisations: {
    name: string;
    applications: { application: string }[];
  }[];
};

// PAT generation response shape
type OAuthPatResponse = {
  client_id: string;
  client_secret: string;
};

export default function OAuthCallback() {
  const params = useSearchParams();
  const router = useRouter();
  const { setToken, setUser, token, org, app, setOrg, setApp, loading } = useApp();
  const processedCode = useRef(false);

  useEffect(() => {
    const code = params.get("code");
    const state = params.get("state") || undefined;
    const oauthAction = localStorage.getItem("oauthAction") || "login";

    // Wait for org/app to be loaded only for generate_pat
    if (oauthAction === "generate_pat") {
      if (loading || !token || !org || !app) return; // Wait for session to be fully loaded
    }

    if (!code || processedCode.current) return;
    processedCode.current = true;

    (async () => {
      try {
        const endpoint = actionToEndpoint[oauthAction] ?? "/users/oauth/login";

        const res = await apiFetch<OAuthUserResponse | OAuthPatResponse>(
          endpoint,
          {
            method: "POST",
            body: { code, state },
          },
          { token, org, app }
        );

        localStorage.removeItem("oauthAction");

        if (oauthAction === "generate_pat") {
          const { client_id, client_secret } = res as OAuthPatResponse;

          router.replace(
            `/dashboard/${encodeURIComponent(org || "")}/${encodeURIComponent(app || "")}/token?client_id=${encodeURIComponent(
              client_id
            )}&client_secret=${encodeURIComponent(client_secret)}`
          );
          return;
        }

        // normal login/signup flow
        const userRes = res as OAuthUserResponse;
        setToken(userRes.user_token?.access_token || "");
        setUser({ user_id: userRes.user_id, name: userRes.username, is_super_admin: userRes.is_super_admin });
        const organisation = userRes.organisations?.[0]?.name || "";
        const application = userRes.organisations?.[0]?.applications?.[0]?.application || "";
        setOrg(organisation);
        setApp(application);

        window.location.replace("/dashboard");
      } catch (e) {
        console.log("Google Callback Error", e);
        router.replace("/login");
      }
    })();
  }, [loading, token, org, app]); // Include all dependencies to re-run when session loads

  return <div className="p-6">Completing sign-in...</div>;
}
