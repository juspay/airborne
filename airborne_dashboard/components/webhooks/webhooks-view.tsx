"use client";

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
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
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { AlertTriangle, Plus, Send, Trash2, Pencil, ListChecks, RefreshCw } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useAppContext } from "@/providers/app-context";
import { apiFetch } from "@/lib/api";
import { notFound, useRouter } from "next/navigation";
import { definePagePermissions, permission } from "@/lib/page-permissions";
import { usePagePermissions } from "@/hooks/use-page-permissions";

export type WebhookScope = "org" | "app";

interface Webhook {
  id: string;
  scope: WebhookScope;
  application: string | null;
  name: string;
  description: string;
  url: string;
  method: string;
  events: string[];
  custom_headers: Record<string, string>;
  enabled: boolean;
  signed: boolean;
  payload_version: string;
  max_retries: number;
  created_at: string;
  updated_at: string;
}

interface EventItem {
  key: string;
  resource: string;
  action: string;
  default_delay_seconds: number;
}

interface WebhookFormState {
  name: string;
  description: string;
  url: string;
  method: string;
  events: string[];
  custom_headers: string;
  enabled: boolean;
  max_retries: number;
  secret: string;
  removeSigning: boolean;
}

const emptyForm: WebhookFormState = {
  name: "",
  description: "",
  url: "",
  method: "POST",
  events: [],
  custom_headers: "{}",
  enabled: true,
  max_retries: 5,
  secret: "",
  removeSigning: false,
};

// The server accepts these; GET is offered but discouraged (see the caution below).
const METHODS = ["POST", "PUT", "PATCH", "GET"];

// The authz scope must match the webhook's scope: an org webhook is administered with
// org-level permissions, an app webhook with app-level ones.
const AUTHZ_BY_SCOPE = {
  org: definePagePermissions({
    read_webhooks: permission("webhook", "read", "org"),
    create_webhook: permission("webhook", "create", "org"),
    update_webhook: permission("webhook", "update", "org"),
    delete_webhook: permission("webhook", "delete", "org"),
  }),
  app: definePagePermissions({
    read_webhooks: permission("webhook", "read", "app"),
    create_webhook: permission("webhook", "create", "app"),
    update_webhook: permission("webhook", "update", "app"),
    delete_webhook: permission("webhook", "delete", "app"),
  }),
} as const;

const randomSecret = () => {
  const bytes = new Uint8Array(32);
  crypto.getRandomValues(bytes);
  return Array.from(bytes)
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
};

// Pretty-print a response body when it's JSON; otherwise show it verbatim.
const formatBody = (body: string) => {
  try {
    return JSON.stringify(JSON.parse(body.trim()), null, 2);
  } catch {
    return body;
  }
};

const WebhooksView = ({ scope }: { scope: WebhookScope }) => {
  const { token, org, app: ctxApp } = useAppContext();
  // An org-scoped webhook is created by *omitting* the application: `apiFetch` only sends
  // the `x-application` header when `app` is set, and that header is what tells the server
  // which scope the webhook belongs to.
  const app = scope === "app" ? ctxApp : undefined;

  const permissions = usePagePermissions(AUTHZ_BY_SCOPE[scope]);
  const router = useRouter();
  const { toast } = useToast();

  const [webhooks, setWebhooks] = useState<Webhook[]>([]);
  const [events, setEvents] = useState<EventItem[]>([]);
  const [loading, setLoading] = useState(true);

  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState<Webhook | null>(null);
  const [form, setForm] = useState<WebhookFormState>(emptyForm);
  const [saving, setSaving] = useState(false);

  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [testResult, setTestResult] = useState<any | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);

  const canCreate = permissions.can("create_webhook");
  const canUpdate = permissions.can("update_webhook");
  const canDelete = permissions.can("delete_webhook");

  useEffect(() => {
    if (permissions.isReady && !permissions.can("read_webhooks")) {
      notFound();
    }
  }, [permissions.isReady, permissions.checks]);

  useEffect(() => {
    load();
    loadEvents();
  }, []);

  const load = async () => {
    try {
      setLoading(true);
      const { data } = await apiFetch<{ data: Webhook[] }>("/webhooks", {}, { token, org, app });
      setWebhooks(data);
    } catch (e) {
      console.error("Error loading webhooks:", e);
    } finally {
      setLoading(false);
    }
  };

  const loadEvents = async () => {
    try {
      // Scope-dependent: an org webhook can also subscribe to the org-only events
      // (application.create, organisation_user.*) that no app webhook can receive.
      const res = await apiFetch<{ events: EventItem[] }>(
        "/webhooks/events",
        { showErrorToast: false },
        { token, org, app }
      );
      setEvents(res.events);
    } catch (e) {
      console.error("Error loading events:", e);
    }
  };

  const openCreate = () => {
    setEditing(null);
    setForm(emptyForm);
    setShowForm(true);
  };

  const openEdit = (w: Webhook) => {
    setEditing(w);
    setForm({
      name: w.name,
      description: w.description,
      url: w.url,
      method: w.method,
      events: w.events,
      custom_headers: JSON.stringify(w.custom_headers ?? {}, null, 2),
      enabled: w.enabled,
      max_retries: w.max_retries,
      secret: "",
      removeSigning: false,
    });
    setShowForm(true);
  };

  const toggleEvent = (key: string) => {
    setForm((f) =>
      f.events.includes(key)
        ? { ...f, events: f.events.filter((e) => e !== key) }
        : { ...f, events: [...f.events, key] }
    );
  };

  const submitForm = async () => {
    let customHeaders: Record<string, string> = {};
    if (form.custom_headers.trim()) {
      try {
        customHeaders = JSON.parse(form.custom_headers);
      } catch {
        toast({ title: "Invalid JSON", description: "Custom headers must be a JSON object", variant: "destructive" });
        return;
      }
    }
    if (!form.name.trim() || !form.url.trim()) {
      toast({ title: "Missing fields", description: "Name and URL are required", variant: "destructive" });
      return;
    }
    if (form.events.length === 0) {
      toast({ title: "No events", description: "Select at least one event to subscribe to", variant: "destructive" });
      return;
    }

    const body: Record<string, any> = {
      description: form.description,
      url: form.url,
      method: form.method,
      events: form.events,
      custom_headers: customHeaders,
      enabled: form.enabled,
      max_retries: form.max_retries,
    };
    // Signing secret: create -> value or unsigned; edit -> value (change), remove (clear), or omit (keep).
    if (editing) {
      if (form.removeSigning) body.secret = "";
      else if (form.secret.trim()) body.secret = form.secret.trim();
    } else if (form.secret.trim()) {
      body.secret = form.secret.trim();
    }

    try {
      setSaving(true);
      if (editing) {
        await apiFetch(`/webhooks/${editing.id}`, { method: "PUT", body }, { token, org, app });
        toast({ title: "Saved", description: "Webhook updated" });
      } else {
        await apiFetch("/webhooks", { method: "POST", body: { name: form.name, ...body } }, { token, org, app });
        toast({ title: "Created", description: "Webhook created" });
      }
      setShowForm(false);
      load();
    } catch (e) {
      console.error("Error saving webhook:", e);
    } finally {
      setSaving(false);
    }
  };

  const toggleEnabled = async (w: Webhook) => {
    try {
      setBusyId(w.id);
      await apiFetch(`/webhooks/${w.id}`, { method: "PUT", body: { enabled: !w.enabled } }, { token, org, app });
      setWebhooks((list) => list.map((x) => (x.id === w.id ? { ...x, enabled: !x.enabled } : x)));
    } catch (e) {
      console.error(e);
    } finally {
      setBusyId(null);
    }
  };

  const sendTest = async (w: Webhook) => {
    try {
      setBusyId(w.id);
      const res = await apiFetch<any>(`/webhooks/${w.id}/test`, { method: "POST", body: {} }, { token, org, app });
      setTestResult(res);
    } catch (e) {
      console.error(e);
    } finally {
      setBusyId(null);
    }
  };

  const confirmDelete = async () => {
    if (!deleteId) return;
    try {
      setBusyId(deleteId);
      await apiFetch(`/webhooks/${deleteId}`, { method: "DELETE" }, { token, org, app });
      setWebhooks((list) => list.filter((x) => x.id !== deleteId));
      toast({ title: "Deleted", description: "Webhook deleted" });
    } catch (e) {
      console.error(e);
    } finally {
      setBusyId(null);
      setDeleteId(null);
    }
  };

  const goToDeliveries = (id: string) => {
    const base =
      scope === "app"
        ? `/dashboard/${encodeURIComponent(org || "")}/${encodeURIComponent(ctxApp || "")}`
        : `/dashboard/${encodeURIComponent(org || "")}`;
    router.push(`${base}/webhooks/${id}/deliveries`);
  };

  return (
    <div className="container mx-auto py-8 px-4 max-w-6xl">
      <div className="flex justify-between items-center mb-8">
        <div>
          <h1 className="text-3xl font-bold text-foreground">Webhooks</h1>
          <p className="text-muted-foreground mt-2">
            {scope === "app"
              ? "Get HTTP callbacks when things happen in this application."
              : "Get HTTP callbacks for events across every application in this organisation, plus organisation-level events like a new application or a user change."}
          </p>
        </div>
        {canCreate && (
          <Button onClick={openCreate} className="flex items-center gap-2">
            <Plus className="h-4 w-4" />
            Create Webhook
          </Button>
        )}
      </div>

      {loading ? (
        <div className="flex justify-center py-12">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
        </div>
      ) : webhooks.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center text-muted-foreground">
            <p className="text-lg mb-2">No webhooks yet</p>
            <p>Create a webhook to start receiving event notifications.</p>
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>URL</TableHead>
                  <TableHead>Method</TableHead>
                  <TableHead>Events</TableHead>
                  <TableHead>Signing</TableHead>
                  <TableHead>Enabled</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {webhooks.map((w) => (
                  <TableRow key={w.id}>
                    <TableCell className="font-medium">{w.name}</TableCell>
                    <TableCell className="font-mono text-xs max-w-xs truncate" title={w.url}>
                      {w.url}
                    </TableCell>
                    <TableCell>
                      <Badge variant={w.method === "GET" ? "destructive" : "outline"} className="text-xs">
                        {w.method}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <div className="flex flex-wrap gap-1 max-w-xs">
                        {w.events.slice(0, 3).map((e) => (
                          <Badge key={e} variant="secondary" className="text-xs">
                            {e}
                          </Badge>
                        ))}
                        {w.events.length > 3 && (
                          <Badge variant="outline" className="text-xs">
                            +{w.events.length - 3}
                          </Badge>
                        )}
                      </div>
                    </TableCell>
                    <TableCell>
                      {w.signed ? (
                        <Badge variant="secondary" className="text-xs">
                          Signed
                        </Badge>
                      ) : (
                        <Badge variant="outline" className="text-xs">
                          Unsigned
                        </Badge>
                      )}
                    </TableCell>
                    <TableCell>
                      <Switch
                        checked={w.enabled}
                        disabled={!canUpdate || busyId === w.id}
                        onCheckedChange={() => toggleEnabled(w)}
                      />
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center justify-end gap-1">
                        <Button variant="ghost" size="sm" title="Deliveries" onClick={() => goToDeliveries(w.id)}>
                          <ListChecks className="h-4 w-4" />
                        </Button>
                        {canUpdate && (
                          <Button
                            variant="ghost"
                            size="sm"
                            title="Send test"
                            disabled={busyId === w.id}
                            onClick={() => sendTest(w)}
                          >
                            <Send className="h-4 w-4" />
                          </Button>
                        )}
                        {canUpdate && (
                          <Button variant="ghost" size="sm" title="Edit" onClick={() => openEdit(w)}>
                            <Pencil className="h-4 w-4" />
                          </Button>
                        )}
                        {canDelete && (
                          <Button variant="ghost" size="sm" title="Delete" onClick={() => setDeleteId(w.id)}>
                            <Trash2 className="h-4 w-4 text-destructive" />
                          </Button>
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}

      {/* Create / Edit dialog */}
      <Dialog open={showForm} onOpenChange={setShowForm}>
        <DialogContent className="sm:max-w-2xl max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editing ? "Edit Webhook" : "Create Webhook"}</DialogTitle>
            <DialogDescription>
              Configure the endpoint, subscribed events, signing, and delivery options.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            {!editing && (
              <div className="space-y-2">
                <Label>Name</Label>
                <Input
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                  placeholder="my-webhook"
                />
              </div>
            )}
            <div className="space-y-2">
              <Label>Description</Label>
              <Input
                value={form.description}
                onChange={(e) => setForm({ ...form, description: e.target.value })}
                placeholder="What is this webhook for?"
              />
            </div>
            <div className="grid grid-cols-4 gap-2">
              <div className="col-span-3 space-y-2">
                <Label>URL</Label>
                <Input
                  value={form.url}
                  onChange={(e) => setForm({ ...form, url: e.target.value })}
                  placeholder="https://example.com/hooks/airborne"
                />
              </div>
              <div className="space-y-2">
                <Label>Method</Label>
                <select
                  className="w-full h-10 rounded-md border border-input bg-background px-3 text-sm"
                  value={form.method}
                  onChange={(e) => setForm({ ...form, method: e.target.value })}
                >
                  {METHODS.map((m) => (
                    <option key={m} value={m}>
                      {m}
                    </option>
                  ))}
                </select>
              </div>
              {form.method === "GET" && (
                <div className="col-span-4 flex items-start gap-2 rounded-lg border border-amber-200 bg-amber-50 p-3 dark:border-amber-800 dark:bg-amber-950/20">
                  <AlertTriangle className="h-4 w-4 mt-0.5 shrink-0 text-amber-600 dark:text-amber-400" />
                  <p className="text-sm text-amber-800 dark:text-amber-200">
                    <strong>GET is strongly discouraged.</strong> Airborne still sends the full JSON payload as the
                    request body, and a GET request with a body is non-standard — many servers, proxies, and CDNs drop
                    or reject it. If the body is dropped, your endpoint receives no event data, and signature
                    verification will fail. Use <strong>POST</strong> unless your receiver specifically requires GET.
                  </p>
                </div>
              )}
            </div>

            <div className="space-y-2">
              <Label>Events ({form.events.length} selected)</Label>
              <div className="border rounded-md max-h-52 overflow-y-auto p-2 space-y-1">
                {events.length === 0 ? (
                  <p className="text-sm text-muted-foreground p-2">No events available.</p>
                ) : (
                  events.map((ev) => (
                    <label
                      key={ev.key}
                      className="flex items-center gap-2 text-sm py-1 px-1 cursor-pointer hover:bg-muted rounded"
                    >
                      <Checkbox checked={form.events.includes(ev.key)} onCheckedChange={() => toggleEvent(ev.key)} />
                      <span className="font-mono">{ev.key}</span>
                      {ev.default_delay_seconds > 0 && (
                        <Badge variant="outline" className="text-xs">
                          +{ev.default_delay_seconds}s
                        </Badge>
                      )}
                    </label>
                  ))
                )}
              </div>
              {scope === "org" && (
                <p className="text-xs text-muted-foreground">
                  Application events fire for every application in this organisation.
                </p>
              )}
            </div>

            {/* Signing secret (optional) */}
            <div className="space-y-2">
              <Label>Signing secret (optional)</Label>
              <div className="flex items-center gap-2">
                <Input
                  className="font-mono text-xs"
                  value={form.secret}
                  disabled={form.removeSigning}
                  onChange={(e) => setForm({ ...form, secret: e.target.value })}
                  placeholder={editing ? "Leave blank to keep the current secret" : "Leave blank to send unsigned"}
                />
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  disabled={form.removeSigning}
                  onClick={() => setForm({ ...form, secret: randomSecret() })}
                >
                  <RefreshCw className="h-4 w-4 mr-1" /> Generate
                </Button>
              </div>
              <p className="text-xs text-muted-foreground">
                If set, payloads are HMAC-signed and sent with an <code>X-Airborne-Signature</code> header. Copy it now
                — it isn&apos;t shown again.
              </p>
              {editing && (
                <label className="flex items-center gap-2 text-sm pt-1 cursor-pointer">
                  <Checkbox
                    checked={form.removeSigning}
                    onCheckedChange={(v) => setForm({ ...form, removeSigning: !!v, secret: "" })}
                  />
                  Remove signing (send unsigned)
                </label>
              )}
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Max retries</Label>
                <Input
                  type="number"
                  value={form.max_retries}
                  onChange={(e) => setForm({ ...form, max_retries: parseInt(e.target.value || "0", 10) })}
                />
              </div>
              <div className="flex items-center gap-2 pt-8">
                <Switch checked={form.enabled} onCheckedChange={(v) => setForm({ ...form, enabled: v })} />
                <Label>Enabled</Label>
              </div>
            </div>

            <div className="space-y-2">
              <Label>Custom headers (JSON)</Label>
              <Textarea
                className="font-mono text-xs"
                rows={4}
                value={form.custom_headers}
                onChange={(e) => setForm({ ...form, custom_headers: e.target.value })}
                placeholder='{"X-Custom": "value"}'
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowForm(false)} disabled={saving}>
              Cancel
            </Button>
            <Button onClick={submitForm} disabled={saving}>
              {saving ? "Saving..." : editing ? "Save changes" : "Create webhook"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Test result dialog */}
      <Dialog open={!!testResult} onOpenChange={() => setTestResult(null)}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Test delivery {testResult?.status === "succeeded" ? "succeeded" : "result"}</DialogTitle>
            <DialogDescription>Airborne delivered a sample payload to your endpoint.</DialogDescription>
          </DialogHeader>
          <div className="space-y-3 py-2 text-sm">
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground">Status</span>
              <Badge variant={testResult?.status === "succeeded" ? "secondary" : "destructive"}>
                {testResult?.status}
              </Badge>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground">Response code</span>
              <span className="font-mono">{testResult?.response_status ?? "—"}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground">Latency</span>
              <span className="font-mono">
                {testResult?.duration_ms != null ? `${testResult.duration_ms} ms` : "—"}
              </span>
            </div>
            {testResult?.error && (
              <div className="space-y-1">
                <span className="text-xs text-muted-foreground">Error</span>
                <p className="rounded-md border border-destructive/30 bg-destructive/10 p-2 text-destructive break-words">
                  {testResult.error}
                </p>
              </div>
            )}
            {testResult?.response_body ? (
              <div className="space-y-1">
                <span className="text-xs text-muted-foreground">Response body</span>
                <pre className="max-h-48 overflow-auto whitespace-pre-wrap break-words rounded-md bg-muted p-3 font-mono text-xs">
                  {formatBody(testResult.response_body)}
                </pre>
              </div>
            ) : (
              !testResult?.error && <p className="text-xs text-muted-foreground">No response body was returned.</p>
            )}
          </div>
          <DialogFooter>
            <Button onClick={() => setTestResult(null)}>Close</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete confirm */}
      <Dialog open={!!deleteId} onOpenChange={() => setDeleteId(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Delete webhook</DialogTitle>
            <DialogDescription>
              This removes the webhook and its delivery history. This cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteId(null)}>
              Cancel
            </Button>
            <Button variant="destructive" onClick={confirmDelete} disabled={!!busyId}>
              Delete
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default WebhooksView;
