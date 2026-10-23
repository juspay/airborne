"use client";

import { useState } from "react";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toastError, toastSuccess } from "@/hooks/use-toast";
import { apiFetch } from "@/lib/api";
import { SIGNING_KEY_ID_MAX_LENGTH, SIGNING_KEY_ID_RULE_TEXT, validateSigningKeyId } from "@/lib/name-validation";
import { useAppContext } from "@/providers/app-context";
import type { CreateSigningKeyRequest, SigningKey } from "@/types/integrity";

type CreateKeyDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCreated: () => void | Promise<void>;
};

export function CreateKeyDialog({ open, onOpenChange, onCreated }: CreateKeyDialogProps) {
  const { token, org, app } = useAppContext();
  const [keyId, setKeyId] = useState("");
  const [creating, setCreating] = useState(false);

  const keyIdError = validateSigningKeyId(keyId);

  const handleOpenChange = (next: boolean) => {
    if (creating) return;
    if (!next) setKeyId("");
    onOpenChange(next);
  };

  const createKey = async () => {
    if (keyIdError || creating) return;

    setCreating(true);
    try {
      const body: CreateSigningKeyRequest = { key_id: keyId };
      const created = await apiFetch<SigningKey>(
        "/signing-keys",
        { method: "POST", body, showErrorToast: false },
        { token, org, app }
      );

      setKeyId("");
      onOpenChange(false);
      await onCreated();
      toastSuccess("Signing key created", `"${created.key_id}" is ready to use.`);
    } catch (error) {
      // 400 (invalid ID) and 409 (duplicate ID) both arrive with a message worth showing.
      toastError(
        "Could not create signing key",
        error instanceof Error && error.message ? error.message : "Please try again."
      );
    } finally {
      setCreating(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Create signing key</DialogTitle>
          <DialogDescription>
            Airborne generates an ECDSA P-256 key pair and keeps the private half on the server. Only the public key can
            ever be viewed or downloaded.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2">
          <div className="space-y-2">
            <Label htmlFor="signing-key-id">Key ID</Label>
            <Input
              id="signing-key-id"
              placeholder="release-signing-2026"
              value={keyId}
              maxLength={SIGNING_KEY_ID_MAX_LENGTH}
              autoComplete="off"
              onChange={(event) => setKeyId(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === "Enter") createKey();
              }}
            />
            {keyId.length > 0 && keyIdError ? (
              <p className="text-xs text-destructive">{keyIdError}</p>
            ) : (
              <p className="text-xs text-muted-foreground">{SIGNING_KEY_ID_RULE_TEXT}</p>
            )}
          </div>

          <p className="text-xs text-muted-foreground">
            The new key does not sign anything yet. Roll its public key out to your clients first, then make it the
            default.
          </p>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => handleOpenChange(false)} disabled={creating}>
            Cancel
          </Button>
          <Button onClick={createKey} disabled={Boolean(keyIdError) || creating}>
            {creating ? "Creating..." : "Create key"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
