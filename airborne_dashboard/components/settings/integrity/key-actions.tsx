"use client";

import { Copy, Download, Eye, MoreHorizontal, ShieldCheck, ShieldOff, Star } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import type { SigningKey } from "@/types/integrity";

type KeyActionsProps = {
  signingKey: SigningKey;
  canUpdate: boolean;
  pending: boolean;
  onViewPublicKey: () => void;
  onCopyPublicKey: () => void;
  onDownloadPublicKey: () => void;
  onSetDefault: () => void;
  onSetDisabled: (disabled: boolean) => void;
};

/** An action the server would reject, shown disabled with the reason spelled out. */
function BlockedItem({ label, reason }: { label: string; reason: string }) {
  return (
    <DropdownMenuItem disabled className="items-start">
      <div className="flex flex-col gap-0.5">
        <span>{label}</span>
        <span className="text-xs">{reason}</span>
      </div>
    </DropdownMenuItem>
  );
}

export function KeyActions({
  signingKey,
  canUpdate,
  pending,
  onViewPublicKey,
  onCopyPublicKey,
  onDownloadPublicKey,
  onSetDefault,
  onSetDisabled,
}: KeyActionsProps) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon" className="h-8 w-8" disabled={pending}>
          <MoreHorizontal className="h-4 w-4" />
          <span className="sr-only">Actions for {signingKey.key_id}</span>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-60">
        <DropdownMenuLabel>Public key</DropdownMenuLabel>
        <DropdownMenuItem onClick={onViewPublicKey}>
          <Eye className="mr-2 h-4 w-4" />
          View public key
        </DropdownMenuItem>
        <DropdownMenuItem onClick={onCopyPublicKey}>
          <Copy className="mr-2 h-4 w-4" />
          Copy public key
        </DropdownMenuItem>
        <DropdownMenuItem onClick={onDownloadPublicKey}>
          <Download className="mr-2 h-4 w-4" />
          Download .pem
        </DropdownMenuItem>

        {canUpdate && (
          <>
            <DropdownMenuSeparator />
            <DropdownMenuLabel>Manage</DropdownMenuLabel>

            {/* The default key is already the default; a disabled key cannot become one. */}
            {!signingKey.is_default &&
              (signingKey.disabled ? (
                <BlockedItem label="Set as default" reason="Enable this key first" />
              ) : (
                <DropdownMenuItem onClick={onSetDefault}>
                  <Star className="mr-2 h-4 w-4" />
                  Set as default
                </DropdownMenuItem>
              ))}

            {/* Disabling the default key would leave nothing to sign with. */}
            {signingKey.is_default ? (
              <BlockedItem label="Disable" reason="Make another key the default first" />
            ) : signingKey.disabled ? (
              <DropdownMenuItem onClick={() => onSetDisabled(false)}>
                <ShieldCheck className="mr-2 h-4 w-4" />
                Enable
              </DropdownMenuItem>
            ) : (
              <DropdownMenuItem variant="destructive" onClick={() => onSetDisabled(true)}>
                <ShieldOff className="mr-2 h-4 w-4" />
                Disable
              </DropdownMenuItem>
            )}
          </>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
