"use client";

import { useState } from "react";
import { useAppContext } from "@/providers/app-context";
import { apiFetch } from "@/lib/api";
import { refreshControlCenter } from "@/lib/control-center/hooks";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";

/** Server rechecks admin membership and the replacement's terminal, non-serving state, and audits the reason. */
export function AbandonRollback({ org, app, releaseId }: { org: string; app: string; releaseId: string }) {
  const { token, logout, user, getOrgAccess } = useAppContext();
  const roles = getOrgAccess(org);
  const admin = Boolean(user?.is_super_admin) || roles.includes("owner") || roles.includes("admin");
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState("");
  const [ack, setAck] = useState(false);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");
  async function abandon() {
    setPending(true);
    setError("");
    try {
      await apiFetch(
        `/control-center/operations/rollback/${encodeURIComponent(releaseId)}/abandon`,
        { method: "POST", body: { reason: reason.trim() }, showErrorToast: false },
        { token, logout, org, app }
      );
      setOpen(false);
      await refreshControlCenter();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setPending(false);
    }
  }
  if (!admin)
    return (
      <p className="text-xs text-muted-foreground">
        An organisation admin can review and abandon this rollback after its replacement stops serving.
      </p>
    );
  return (
    <>
      <Button
        variant="outline"
        onClick={() => {
          setOpen(true);
          setReason("");
          setAck(false);
          setError("");
        }}
      >
        Abandon rollback…
      </Button>
      <Dialog
        open={open}
        onOpenChange={(v) => {
          if (!pending) setOpen(v);
        }}
      >
        <DialogContent className="max-h-[90dvh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Abandon this rollback?</DialogTitle>
            <DialogDescription>
              This clears the unfinished rollback so a new operation can be raised. It does not change what devices
              receive. First discard the replacement or conclude it to control. The server verifies it is no longer
              serving and records your reason in the audit history.
            </DialogDescription>
          </DialogHeader>
          <Textarea
            aria-label="Reason for abandoning rollback"
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            maxLength={2000}
            placeholder="What changed, and why is abandoning safe?"
          />
          <label className="flex items-start gap-2 text-sm">
            <Checkbox checked={ack} onCheckedChange={(v) => setAck(v === true)} />I reviewed the replacement and its
            serving state.
          </label>
          {error && (
            <p role="alert" className="text-sm text-destructive break-words">
              {error}
            </p>
          )}
          <Button disabled={pending || !ack || !reason.trim()} onClick={() => void abandon()}>
            {pending ? "Verifying…" : "Verify and abandon rollback"}
          </Button>
        </DialogContent>
      </Dialog>
    </>
  );
}
