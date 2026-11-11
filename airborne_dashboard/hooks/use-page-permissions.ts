"use client";

import { useMemo } from "react";
import useSWR from "swr";

import { enforcePermissionsBatch, type PermissionCheckRequest } from "@/lib/authz";
import { contextualPermissionChecks, type PagePermissionMap } from "@/lib/page-permissions";
import { useAppContext } from "@/providers/app-context";

type PermissionDecisionMap<K extends string> = Record<K, boolean>;

type UsePagePermissionsResult<K extends string> = {
  can: (key: K) => boolean;
  checks: PermissionDecisionMap<K>;
  isLoading: boolean;
  isReady: boolean;
  error?: Error;
  refresh: () => Promise<void>;
};

export function usePagePermissions<K extends string>(permissionMap: PagePermissionMap<K>): UsePagePermissionsResult<K> {
  const { token, org, app } = useAppContext();

  const aliases = useMemo(() => Object.keys(permissionMap) as K[], [permissionMap]);
  const checks = useMemo(
    () =>
      aliases.map((alias) => {
        const value = permissionMap[alias];
        return { resource: value.resource, action: value.action, scope: value.scope };
      }),
    [aliases, permissionMap]
  );
  const requestFingerprint = useMemo(
    () => checks.map((check) => `${check.scope ?? "auto"}:${check.resource}.${check.action}`).join("|"),
    [checks]
  );

  const contextualChecks = contextualPermissionChecks(checks, app);
  const shouldFetch = Boolean(token && org && contextualChecks.length > 0);
  const swrKey = shouldFetch ? ["page-permissions", token, org, app ?? "", requestFingerprint] : null;

  const { data, isLoading, error, mutate } = useSWR(swrKey, () =>
    enforcePermissionsBatch({ token, org, app }, contextualChecks as PermissionCheckRequest[])
  );

  const decisions = useMemo(() => {
    const resolved = {} as PermissionDecisionMap<K>;
    aliases.forEach((alias, index) => {
      resolved[alias] =
        data?.results?.find(
          (result) =>
            result.resource === checks[index].resource &&
            result.action === checks[index].action &&
            result.scope === (checks[index].scope ?? "auto")
        )?.allowed ?? false;
    });
    return resolved;
  }, [aliases, data, checks]);

  const can = (key: K) => {
    if (aliases.length === 0) return true;
    return decisions[key] ?? false;
  };

  const refresh = async () => {
    await mutate();
  };

  return {
    can,
    checks: decisions,
    isLoading: shouldFetch ? isLoading : false,
    isReady: aliases.length === 0 || Boolean(data) || Boolean(error),
    error: error as Error | undefined,
    refresh,
  };
}
