"use client";

import { useState } from "react";
import useSWR from "swr";
import { Copy, KeyRound, Plus, ShieldCheck } from "lucide-react";

import { CreateKeyDialog } from "@/components/settings/integrity/create-key-dialog";
import { KeyActions } from "@/components/settings/integrity/key-actions";
import { PublicKeyDialog } from "@/components/settings/integrity/public-key-dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardAction, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { toastError, toastSuccess } from "@/hooks/use-toast";
import { apiFetch } from "@/lib/api";
import { useAppContext } from "@/providers/app-context";
import type { SigningKey, SigningKeysResponse, UpdateSigningKeyRequest } from "@/types/integrity";

type SigningKeysCardProps = {
  canRead: boolean;
  canCreate: boolean;
  canUpdate: boolean;
};

const INLINE_CODE = "rounded bg-muted px-1.5 py-0.5 font-mono text-xs text-foreground";

const formatDate = (value: string) =>
  new Date(value).toLocaleDateString("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });

/** Mirrors the filename the server puts in `Content-Disposition` for the PEM download. */
const publicKeyFileName = (keyId: string) => `${keyId}.pem`;

const messageOf = (error: unknown, fallback: string) =>
  error instanceof Error && error.message ? error.message : fallback;

export function SigningKeysCard({ canRead, canCreate, canUpdate }: SigningKeysCardProps) {
  const { token, org, app } = useAppContext();
  const [createOpen, setCreateOpen] = useState(false);
  const [viewedKey, setViewedKey] = useState<SigningKey | null>(null);
  const [pendingKeyId, setPendingKeyId] = useState<string | null>(null);

  const { data, isLoading, mutate } = useSWR(canRead && token && org && app ? ["/signing-keys", org, app] : null, () =>
    apiFetch<SigningKeysResponse>("/signing-keys", {}, { token, org, app })
  );

  const keys = data?.data ?? [];
  const loading = !canRead || isLoading;

  const copyToClipboard = async (value: string, label: string) => {
    try {
      await navigator.clipboard.writeText(value);
      toastSuccess("Copied", `${label} copied to clipboard`);
    } catch (error) {
      console.error("Failed to copy to clipboard:", error);
      toastError("Copy failed", "Could not write to the clipboard");
    }
  };

  /**
   * The list response already carries the PEM, so the file is built client-side —
   * no second request, and no fighting `apiFetch` over a non-JSON body.
   */
  const downloadPublicKey = (signingKey: SigningKey) => {
    const pem = signingKey.public_key.endsWith("\n") ? signingKey.public_key : `${signingKey.public_key}\n`;
    const fileName = publicKeyFileName(signingKey.key_id);
    const url = URL.createObjectURL(new Blob([pem], { type: "application/x-pem-file" }));
    const anchor = document.createElement("a");

    anchor.href = url;
    anchor.download = fileName;
    document.body.appendChild(anchor);
    anchor.click();
    document.body.removeChild(anchor);
    URL.revokeObjectURL(url);

    toastSuccess("Downloaded", `Public key saved as ${fileName}`);
  };

  const setDefaultKey = async (signingKey: SigningKey) => {
    setPendingKeyId(signingKey.key_id);
    try {
      await apiFetch<SigningKey>(
        `/signing-keys/${encodeURIComponent(signingKey.key_id)}/default`,
        { method: "POST", showErrorToast: false },
        { token, org, app }
      );
      await mutate();
      toastSuccess("Default key updated", `"${signingKey.key_id}" now signs release configs for this application.`);
    } catch (error) {
      // e.g. 400 when the key is disabled, 404 when it no longer exists.
      toastError("Could not set default key", messageOf(error, "Please try again."));
    } finally {
      setPendingKeyId(null);
    }
  };

  const setKeyDisabled = async (signingKey: SigningKey, disabled: boolean) => {
    setPendingKeyId(signingKey.key_id);
    try {
      const body: UpdateSigningKeyRequest = { disabled };
      await apiFetch<SigningKey>(
        `/signing-keys/${encodeURIComponent(signingKey.key_id)}`,
        { method: "PATCH", body, showErrorToast: false },
        { token, org, app }
      );
      await mutate();
      toastSuccess(
        disabled ? "Key disabled" : "Key enabled",
        `"${signingKey.key_id}" is now ${disabled ? "disabled" : "active"}.`
      );
    } catch (error) {
      // e.g. 400 when trying to disable the default key.
      toastError(disabled ? "Could not disable key" : "Could not enable key", messageOf(error, "Please try again."));
    } finally {
      setPendingKeyId(null);
    }
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 font-[family-name:var(--font-space-grotesk)]">
            <ShieldCheck className="h-5 w-5 text-primary" />
            Release config signing
          </CardTitle>
          <CardDescription>
            Airborne signs every release-config response with this application&apos;s default key, so clients can prove
            the config came from Airborne and was not tampered with in transit.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3 text-sm text-muted-foreground">
          <p>Each response carries the signature in a response header:</p>
          <pre className="overflow-x-auto rounded-md border border-border bg-muted/50 p-3 font-mono text-xs text-foreground">
            {`X-Airborne-Signature: keyid="production",alg="es256",sig="<base64>"`}
          </pre>
          <p>
            Clients verify <code className={INLINE_CODE}>sig</code> against the public key of{" "}
            <code className={INLINE_CODE}>keyid</code>. To sign with a specific key instead of the default, send{" "}
            <code className={INLINE_CODE}>{"X-Signing-Key-Id: production"}</code> on the request.
          </p>
          <p>
            Private keys never leave Airborne — they are not returned by any API. Only public keys can be viewed or
            downloaded.
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="font-[family-name:var(--font-space-grotesk)]">
            Signing keys ({loading ? "..." : keys.length})
          </CardTitle>
          <CardDescription>
            Exactly one key is the default. It is the key used when no key is requested.
          </CardDescription>
          {canCreate && (
            <CardAction>
              <Button className="gap-2" onClick={() => setCreateOpen(true)}>
                <Plus className="h-4 w-4" />
                Create key
              </Button>
            </CardAction>
          )}
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <div className="flex items-center gap-3">
                <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-primary"></div>
                <span className="text-muted-foreground">Loading signing keys...</span>
              </div>
            </div>
          ) : keys.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <KeyRound className="h-12 w-12 text-muted-foreground mb-4" />
              <h3 className="text-lg font-semibold mb-2">No signing keys</h3>
              <p className="text-muted-foreground mb-4">
                Release configs for this application are not being signed. Create a key to start signing them.
              </p>
              {canCreate && (
                <Button className="gap-2" onClick={() => setCreateOpen(true)}>
                  <Plus className="h-4 w-4" />
                  Create your first key
                </Button>
              )}
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Key ID</TableHead>
                  <TableHead>Algorithm</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Created</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {keys.map((signingKey) => (
                  <TableRow key={signingKey.key_id} className={signingKey.disabled ? "opacity-60" : undefined}>
                    <TableCell>
                      <div className="flex items-center gap-1">
                        <span className="font-mono text-xs font-medium">{signingKey.key_id}</span>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-6 w-6"
                          title="Copy key ID"
                          onClick={() => copyToClipboard(signingKey.key_id, "Key ID")}
                        >
                          <Copy className="h-3 w-3" />
                          <span className="sr-only">Copy key ID for {signingKey.key_id}</span>
                        </Button>
                      </div>
                    </TableCell>
                    <TableCell className="font-mono text-xs text-muted-foreground">{signingKey.algorithm}</TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        {signingKey.is_default && <Badge>Default</Badge>}
                        {signingKey.disabled && <Badge variant="secondary">Disabled</Badge>}
                        {!signingKey.is_default && !signingKey.disabled && <Badge variant="outline">Active</Badge>}
                      </div>
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {formatDate(signingKey.created_at)}
                    </TableCell>
                    <TableCell className="text-right">
                      <KeyActions
                        signingKey={signingKey}
                        canUpdate={canUpdate}
                        pending={pendingKeyId === signingKey.key_id}
                        onViewPublicKey={() => setViewedKey(signingKey)}
                        onCopyPublicKey={() => copyToClipboard(signingKey.public_key, "Public key")}
                        onDownloadPublicKey={() => downloadPublicKey(signingKey)}
                        onSetDefault={() => setDefaultKey(signingKey)}
                        onSetDisabled={(disabled) => setKeyDisabled(signingKey, disabled)}
                      />
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <CreateKeyDialog
        open={createOpen}
        onOpenChange={setCreateOpen}
        onCreated={async () => {
          await mutate();
        }}
      />

      <PublicKeyDialog
        signingKey={viewedKey}
        onOpenChange={(open) => {
          if (!open) setViewedKey(null);
        }}
        onCopyPublicKey={(signingKey) => copyToClipboard(signingKey.public_key, "Public key")}
        onDownloadPublicKey={downloadPublicKey}
      />
    </div>
  );
}
