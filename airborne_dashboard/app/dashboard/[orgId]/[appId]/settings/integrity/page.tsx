"use client";

import { useEffect } from "react";
import { notFound } from "next/navigation";

import { SigningKeysCard } from "@/components/settings/integrity/signing-keys-card";
import { usePagePermissions } from "@/hooks/use-page-permissions";
import { definePagePermissions, permission } from "@/lib/page-permissions";

const PAGE_AUTHZ = definePagePermissions({
  read_signing_keys: permission("signing_key", "read", "app"),
  create_signing_key: permission("signing_key", "create", "app"),
  update_signing_key: permission("signing_key", "update", "app"),
});

export default function IntegrityPage() {
  const permissions = usePagePermissions(PAGE_AUTHZ);
  const canRead = permissions.isReady && permissions.can("read_signing_keys");

  useEffect(() => {
    if (permissions.isReady && !permissions.can("read_signing_keys")) {
      notFound();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [permissions.isReady, permissions.checks]);

  return (
    <SigningKeysCard
      canRead={canRead}
      canCreate={permissions.can("create_signing_key")}
      canUpdate={permissions.can("update_signing_key")}
    />
  );
}
