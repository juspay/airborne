"use client";

import { useMemo } from "react";
import useSWR from "swr";

import { enforcePermissionsBatch, type PermissionCheckRequest } from "@/lib/authz";
import type { PagePermissionMap } from "@/lib/page-permissions";
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

  const shouldFetch = Boolean(token && org && checks.length > 0);
  const swrKey = shouldFetch ? ["page-permissions", token, org, app ?? "", requestFingerprint] : null;

  const { data, isLoading, error, mutate } = useSWR(swrKey, () =>
    enforcePermissionsBatch({ token, org, app }, checks as PermissionCheckRequest[])
  );

  const decisions = useMemo(() => {
    const resolved = {} as PermissionDecisionMap<K>;
    aliases.forEach((alias, index) => {
      resolved[alias] = data?.results?.[index]?.allowed ?? false;
    });
    return resolved;
  }, [aliases, data]);

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
