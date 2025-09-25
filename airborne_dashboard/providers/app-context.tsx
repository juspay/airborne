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
type User = { name: string; user_id?: string } | null;

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
  logout: () => void;
  signOut: () => void; // add alias for compatibility
  config: Configuration | null;
  organisations: Organisations[];
  getOrgAccess: (orgName: string | null) => string[];
  getAppAccess: (orgName: string | null, appName: string | null) => string[];
  updateOrgs: () => Promise<OrganisationsList | undefined>;
  loadingAccess: boolean;
};

interface Configuration {
  google_signin_enabled: boolean;
  organisation_creation_disabled: boolean;
}

const AppContext = createContext<AppContextType | undefined>(undefined);

export const LS_TOKEN = "airborne:token";
export const LS_ORG = "airborne:org";
export const LS_APP = "airborne:app";
export const LS_USER = "airborne:user";

export function AppProvider({ children }: { children: React.ReactNode }) {
  const [token, setTokenState] = useState<string | null>(null);
  const [org, setOrgState] = useState<string | null>(null);
  const [app, setAppState] = useState<string | null>(null);
  const [user, setUserState] = useState<User>(null);
  const [loading, setLoading] = useState(true);
  const [config, setConfig] = useState<Configuration | null>(null);
  const fetchConfig = async () => {
    const res: Configuration = await apiFetch("/dashboard/configuration");
    setConfig(res);
  };

  const fetchOrganisations = async () => {
    if (!token) return { organisations: [] };
    return await apiFetch<OrganisationsList>("/organisations", {}, { token });
  };

  const { data, mutate, isLoading } = useSWR<OrganisationsList>(token ? "/organisations" : null, fetchOrganisations);

  const organisations = data?.organisations || [];

  useEffect(() => {
    setTokenState(localStorage.getItem(LS_TOKEN));
    setOrgState(localStorage.getItem(LS_ORG));
    setAppState(localStorage.getItem(LS_APP));
    const u = localStorage.getItem(LS_USER);
    if (u) setUserState(JSON.parse(u));
    fetchConfig();
    setLoading(false);
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

  const logout = () => {
    setToken(null);
    setUser(null);
    setOrg(null);
    setApp(null);
    // redirect to login after clearing state
    if (typeof window !== "undefined") window.location.href = "/login";
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
      signOut: logout, // add alias for compatibility
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
