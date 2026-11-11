"use client";

import { useState } from "react";
import { useAppContext } from "@/providers/app-context";
import { getControlCenterClient } from "@/lib/control-center/data";
import { refreshControlCenter } from "@/lib/control-center/hooks";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";

/** Role gate matches the server's explicit organisation admin check. */
export function OperationRecovery({ org, app, operationId }: { org: string; app: string; operationId: string }) {
  const { token, logout, getOrgAccess, user } = useAppContext();
  const roles = getOrgAccess(org);
  const admin = Boolean(user?.is_super_admin) || roles.includes("owner") || roles.includes("admin");
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState("");
  const [finding, setFinding] = useState<"applied" | "did_not_apply">("applied");
  const [ack, setAck] = useState(false);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");
  const [details, setDetails] = useState<unknown>(null);
  // "gone": the journal no longer lists this operation, usually because another admin resolved it.
  const [lookup, setLookup] = useState<"loading" | "found" | "gone" | "failed">("loading");
  async function inspect() {
    setOpen(true);
    setAck(false);
    setError("");
    setReason("");
    setDetails(null);
    setLookup("loading");
    try {
      const c = await getControlCenterClient({ token, logout });
      const r = await c.listOperations(org, app);
      const found = r.operations.find((o) => o.operation_id === operationId);
      setDetails(found ?? null);
      setLookup(found ? "found" : "gone");
      if (!found) await refreshControlCenter();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
      setLookup("failed");
    }
  }
  async function resolve() {
    setPending(true);
    setError("");
    try {
      const c = await getControlCenterClient({ token, logout });
      await c.resolveOperation(org, app, operationId, finding, reason.trim());
      setOpen(false);
      await refreshControlCenter();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setPending(false);
    }
  }
  return (
    <div className="space-y-2 rounded-md border border-red-500/40 bg-red-500/5 p-3 text-sm">
      <p>
        <strong>Writes paused</strong> · {app} · <span className="break-all font-mono text-xs">{operationId}</span>
      </p>
      <p className="text-xs text-muted-foreground">
        An upstream change has an unconfirmed outcome. Every release write for this app is paused until it is verified.
      </p>
      {admin ? (
        <Button variant="outline" size="sm" onClick={() => void inspect()}>
          Review recovery
        </Button>
      ) : (
        <p className="text-xs text-muted-foreground">An organisation admin can review recovery.</p>
      )}
      <Dialog
        open={open}
        onOpenChange={(v) => {
          if (!pending) setOpen(v);
        }}
      >
        <DialogContent className="max-h-[90vh] overflow-auto sm:max-w-xl">
          <DialogHeader>
            <DialogTitle>Resolve paused writes for {app}</DialogTitle>
            <DialogDescription>
              Inspect the operation ID and Superposition history; the server verifies the journal’s expected state
              before stating your finding. Airborne re-reads upstream and refuses a finding it cannot verify.
            </DialogDescription>
          </DialogHeader>
          {details ? (
            <pre className="max-h-52 overflow-auto whitespace-pre-wrap break-all rounded bg-muted p-2 text-xs">
              {JSON.stringify(details, null, 2)}
            </pre>
          ) : lookup === "gone" ? (
            <p role="status" className="text-sm">
              This operation is no longer listed as unresolved. Someone may have resolved it already. The page is being
              refreshed; close this dialog and check whether writes are still paused.
            </p>
          ) : lookup === "failed" ? (
            <p role="status" className="text-sm">
              The operation could not be read, so it cannot be resolved from here. See the error below, then close and
              try again.
            </p>
          ) : (
            <p>Loading operation…</p>
          )}
          <label className="space-y-1 text-sm">
            Operator finding
            <select
              aria-label="Operator finding"
              className="block w-full rounded border bg-background p-2"
              value={finding}
              onChange={(e) => {
                setFinding(e.target.value as typeof finding);
                setAck(false);
              }}
            >
              <option value="applied">Applied — accept the server-verified journal state</option>
              <option value="did_not_apply">Did not apply — request ended, upstream is unchanged</option>
            </select>
          </label>
          <label className="space-y-1 text-sm">
            Reason (required, audited)
            <Textarea value={reason} onChange={(e) => setReason(e.target.value)} />
          </label>
          <label className="flex items-start gap-2 text-sm">
            <Checkbox checked={ack} onCheckedChange={(v) => setAck(v === true)} />
            <span>
              {finding === "did_not_apply"
                ? "I confirmed in upstream/proxy logs that the original request has ended and cannot execute later. This records rejection and permits later release writes."
                : "I reviewed the operation and upstream history. The server must verify the journal’s expected state before acceptance permits later release writes."}{" "}
              Resolving changes the journal, not Superposition. It does not finish a partial rollback; retry that
              rollback afterwards.
            </span>
          </label>
          {error && (
            <p role="alert" className="text-sm text-red-700 dark:text-red-300">
              {error}
            </p>
          )}
          <DialogFooter>
            <Button variant="outline" disabled={pending} onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button disabled={pending || !details || !ack || !reason.trim()} onClick={() => void resolve()}>
              {pending ? "Verifying…" : "Verify and resolve operation"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
