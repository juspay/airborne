"use client";

import { Copy, Download } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import type { SigningKey } from "@/types/integrity";

type PublicKeyDialogProps = {
  signingKey: SigningKey | null;
  onOpenChange: (open: boolean) => void;
  onCopyPublicKey: (signingKey: SigningKey) => void;
  onDownloadPublicKey: (signingKey: SigningKey) => void;
};

export function PublicKeyDialog({
  signingKey,
  onOpenChange,
  onCopyPublicKey,
  onDownloadPublicKey,
}: PublicKeyDialogProps) {
  return (
    <Dialog open={Boolean(signingKey)} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>Public key{signingKey ? ` — ${signingKey.key_id}` : ""}</DialogTitle>
          <DialogDescription>
            Distribute this public key to your clients so they can verify the release-config signature. The matching
            private key stays on the server and is never exposed by the API.
          </DialogDescription>
        </DialogHeader>

        {signingKey && (
          <div className="space-y-4 py-2">
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-1">
                <Label className="text-muted-foreground">Key ID</Label>
                <p className="font-mono text-sm break-all">{signingKey.key_id}</p>
              </div>
              <div className="space-y-1">
                <Label className="text-muted-foreground">Algorithm</Label>
                <p className="font-mono text-sm">{signingKey.algorithm}</p>
              </div>
            </div>

            <div className="space-y-2">
              <Label className="text-muted-foreground">Public key (SPKI PEM)</Label>
              <pre className="max-h-64 overflow-auto rounded-md border border-border bg-muted/50 p-3 font-mono text-xs whitespace-pre">
                {signingKey.public_key}
              </pre>
            </div>
          </div>
        )}

        <DialogFooter className="gap-2">
          {signingKey && (
            <>
              <Button variant="outline" className="gap-2 bg-transparent" onClick={() => onCopyPublicKey(signingKey)}>
                <Copy className="h-4 w-4" />
                Copy PEM
              </Button>
              <Button
                variant="outline"
                className="gap-2 bg-transparent"
                onClick={() => onDownloadPublicKey(signingKey)}
              >
                <Download className="h-4 w-4" />
                Download .pem
              </Button>
            </>
          )}
          <Button onClick={() => onOpenChange(false)}>Done</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
