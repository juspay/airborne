"use client";

import { apiFetch } from "@/lib/api";
import type React from "react";
import { createContext, useContext, useEffect, useMemo, useState } from "react";
import useSWR from "swr";

interface Organisations {
  name: string;
  applications: { application: string; organisation: string; access: string[] }[];
  access: string[];
}
interface OrganisationsList {
  organisations: Organisations[];
}
type User = { name: string; user_id?: string; is_super_admin: boolean } | null;

type AppContextType = {
  loading: boolean;
  token: string | null;
  setToken: (t: string | null) => void;
  org: string | null;
  setOrg: (o: string | null) => void;
  app: string | null;
  setApp: (a: string | null) => void;
  user: User;
  setUser: (u: User) => void;
  /** Clears the local session and returns to /login (used when the API rejects the token). */
  logout: () => void;
  /** User-initiated sign-out: also ends the identity provider session for SSO users. */
  signOut: () => void;
  config: Configuration | null;
  organisations: Organisations[];
  getOrgAccess: (orgName: string | null) => string[];
  getAppAccess: (orgName: string | null, appName: string | null) => string[];
  updateOrgs: () => Promise<OrganisationsList | undefined>;
  loadingAccess: boolean;
};

interface Configuration {
  google_signin_enabled: boolean;
  enabled_oidc_idps?: string[];
  organisation_creation_disabled: boolean;
  authn_provider?: "keycloak" | "oidc" | "okta" | "auth0";
  oidc_login_enabled?: boolean;
  password_login_enabled?: boolean;
  registration_enabled?: boolean;
  /** Identity provider logout URL (server env `OIDC_LOGOUT_URL`). */
  oidc_logout_url?: string | null;
}

const AppContext = createContext<AppContextType | undefined>(undefined);

export const LS_TOKEN = "airborne:token";
export const LS_ORG = "airborne:org";
export const LS_APP = "airborne:app";
export const LS_USER = "airborne:user";
/** How the current session signed in: "oidc" (SSO) or "password". */
export const LS_AUTH_METHOD = "airborne:auth_method";
/** ID token from the SSO sign-in, sent as `id_token_hint` when ending the provider session. */
export const LS_ID_TOKEN = "airborne:id_token";

export type AuthMethod = "oidc" | "password";

/** Records how the session signed in, and the ID token for SSO sign-ins. */
export function setAuthMethod(method: AuthMethod, idToken?: string | null) {
  localStorage.setItem(LS_AUTH_METHOD, method);
  if (method === "oidc" && idToken) localStorage.setItem(LS_ID_TOKEN, idToken);
  else localStorage.removeItem(LS_ID_TOKEN);
}

/**
 * The provider logout URL to send the browser to, with `id_token_hint` added when we have
 * the ID token. The hint proves the request comes from this app, so the provider can end
 * the session without asking "Do you want to log out?" (and providers such as Okta require
 * it). Returns null if the configured URL is not an absolute http(s) URL.
 */
function providerLogoutUrl(configured: string, idToken: string | null): string | null {
  let url: URL;
  try {
    url = new URL(configured);
  } catch {
    return null;
  }
  if (url.protocol !== "http:" && url.protocol !== "https:") return null;
  if (idToken) url.searchParams.set("id_token_hint", idToken);
  return url.toString();
}

export function AppProvider({ children }: { children: React.ReactNode }) {
  const [token, setTokenState] = useState<string | null>(null);
  const [org, setOrgState] = useState<string | null>(null);
  const [app, setAppState] = useState<string | null>(null);
  const [user, setUserState] = useState<User>(null);
  const [loading, setLoading] = useState(true);
  const [config, setConfig] = useState<Configuration | null>(null);
  const fetchConfig = async (): Promise<Configuration | null> => {
    try {
      const res: Configuration = await apiFetch("/dashboard/configuration");
      return res;
    } catch (error) {
      console.error("Failed to fetch dashboard configuration:", error);
      return null;
    }
  };

  const fetchOrganisations = async () => {
    if (!token) return { organisations: [] };
    return await apiFetch<OrganisationsList>("/organisations", {}, { token });
  };

  const { data, mutate, isLoading } = useSWR<OrganisationsList>(token ? "/organisations" : null, fetchOrganisations);

  const organisations = data?.organisations || [];

  useEffect(() => {
    let isMounted = true;
    const initialize = async () => {
      setTokenState(localStorage.getItem(LS_TOKEN));
      setOrgState(localStorage.getItem(LS_ORG));
      setAppState(localStorage.getItem(LS_APP));
      const u = localStorage.getItem(LS_USER);
      if (u) setUserState(JSON.parse(u));
      const resolvedConfig = await fetchConfig();
      if (!isMounted) return;
      setConfig(resolvedConfig);
      setLoading(false);
    };
    void initialize();

    return () => {
      isMounted = false;
    };
  }, []);

  const setToken = (t: string | null) => {
    setTokenState(t);
    if (t) localStorage.setItem(LS_TOKEN, t);
    else localStorage.removeItem(LS_TOKEN);
  };
  const setOrg = (o: string | null) => {
    setOrgState(o);
    if (o) localStorage.setItem(LS_ORG, o);
    else localStorage.removeItem(LS_ORG);
  };
  const setApp = (a: string | null) => {
    setAppState(a);
    if (a) localStorage.setItem(LS_APP, a);
    else localStorage.removeItem(LS_APP);
  };
  const setUser = (u: User) => {
    setUserState(u);
    if (u) localStorage.setItem(LS_USER, JSON.stringify(u));
    else localStorage.removeItem(LS_USER);
  };

  const clearSession = () => {
    setToken(null);
    setUser(null);
    setOrg(null);
    setApp(null);
    localStorage.removeItem(LS_AUTH_METHOD);
    localStorage.removeItem(LS_ID_TOKEN);
    if (localStorage.getItem("org_request_data")) localStorage.removeItem("org_request_data");
  };

  const logout = () => {
    clearSession();
    // redirect to login after clearing state
    if (typeof window !== "undefined") window.location.href = "/login";
  };

  const signOut = () => {
    // Read before clearSession() wipes them. Sessions from before the sign-in method was
    // recorded count as SSO when password login is turned off.
    const signedInWithOidc =
      localStorage.getItem(LS_AUTH_METHOD) === "oidc" || config?.password_login_enabled === false;
    const logoutUrl = config?.oidc_logout_url
      ? providerLogoutUrl(config.oidc_logout_url, localStorage.getItem(LS_ID_TOKEN))
      : null;
    clearSession();
    if (typeof window === "undefined") return;
    if (signedInWithOidc && logoutUrl) {
      // A top-level navigation (not fetch) so the provider can read and clear its own
      // session cookie; it then redirects back via the URL's post-logout redirect.
      window.location.href = logoutUrl;
      return;
    }
    window.location.href = "/login";
  };

  const getOrgAccess = (orgName: string | null) => {
    if (!orgName) return [];
    const orgObj = organisations.find((o) => o.name === orgName);
    return orgObj ? orgObj.access : [];
  };

  const getAppAccess = (orgName: string | null, appName: string | null) => {
    if (!orgName || !appName) return [];
    const orgObj = organisations.find((o) => o.name === orgName);
    if (!orgObj) return [];
    const appObj = orgObj.applications.find((a) => a.application === appName);
    return appObj ? appObj.access : [];
  };

  const value = useMemo(
    () => ({
      loading,
      token,
      setToken,
      org,
      setOrg,
      app,
      setApp,
      user,
      setUser,
      logout,
      signOut,
      config,
      organisations,
      getOrgAccess,
      getAppAccess,
      updateOrgs: mutate,
      loadingAccess: isLoading,
    }),
    [token, org, app, user, loading, config, organisations, mutate, isLoading]
  );

  return <AppContext.Provider value={value}>{children}</AppContext.Provider>;
}

export function useAppContext() {
  const ctx = useContext(AppContext);
  if (!ctx) throw new Error("useAppContext must be used within AppProvider");
  return ctx;
}

export function useApp() {
  return useAppContext();
}
