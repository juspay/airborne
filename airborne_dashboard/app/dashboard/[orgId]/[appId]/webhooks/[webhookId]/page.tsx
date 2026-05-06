"use client";

import { useMemo, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import useSWR from "swr";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { ChevronDown, ChevronRight, CheckCircle2, XCircle, PlayCircle, Power, Trash2 } from "lucide-react";
import { useAppContext } from "@/providers/app-context";
import { apiFetch } from "@/lib/api";
import { useToast } from "@/hooks/use-toast";

interface Webhook {
  id: string;
  url: string;
  status: string;
  secret_set: boolean;
  actions: string[];
  description?: string | null;
  created_at: string;
  updated_at: string;
}

interface WebhookLog {
  id: string;
  webhook_id: string;
  action: string;
  resource_type: string;
  resource_id: string | null;
  success: boolean;
  status_code: number | null;
  response: any;
  webhook_payload: any;
  created_at: string;
}

interface Paginated<T> {
  data: T[];
  total_items: number;
  total_pages: number;
}

interface Metrics {
  total: number;
  success: number;
  failed: number;
  success_rate: number;
}

function formatTimestamp(value: string): string {
  try {
    return new Date(value).toLocaleString();
  } catch {
    return value;
  }
}

function prettyJson(value: any): string {
  try {
    return JSON.stringify(value, null, 2);
  } catch {
    return String(value);
  }
}

export default function WebhookDetailPage() {
  const { token, org } = useAppContext();
  const { orgId, appId, webhookId } = useParams<{
    orgId: string;
    appId: string;
    webhookId: string;
  }>();
  const router = useRouter();
  const { toast } = useToast();
  const [logPage, setLogPage] = useState(1);
  const [logAction, setLogAction] = useState("");
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const count = 25;

  const { data: webhook, mutate: mutateWebhook } = useSWR<Webhook>(
    token && webhookId ? ["/webhook/", webhookId] : null,
    () => apiFetch<Webhook>(`/webhook/${webhookId}`, {}, { token, org, app: appId })
  );

  const { data: metrics } = useSWR<Metrics>(token && webhookId ? ["/webhook/metrics", webhookId] : null, () =>
    apiFetch<Metrics>(`/webhook/${webhookId}/metrics`, {}, { token, org, app: appId })
  );

  const logsKey = useMemo(
    () => (token && webhookId ? ["/webhook/logs", webhookId, logPage, logAction] : null),
    [token, webhookId, logPage, logAction]
  );

  const { data: logs, mutate: mutateLogs } = useSWR<Paginated<WebhookLog>>(logsKey, () =>
    apiFetch<Paginated<WebhookLog>>(
      `/webhook/${webhookId}/logs`,
      {
        query: { page: logPage, count, ...(logAction ? { action: logAction } : {}) },
      },
      { token, org, app: appId }
    )
  );

  const toggleExpand = (id: string) => {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const sendTest = async () => {
    try {
      await apiFetch(`/webhook/${webhookId}/test`, { method: "POST", body: {} }, { token, org, app: appId });
      toast({ title: "Test webhook queued" });
      setTimeout(() => mutateLogs(), 1200);
    } catch (err) {
      console.error(err);
      toast({ title: "Failed to queue test", variant: "destructive" });
    }
  };

  const toggleStatus = async () => {
    if (!webhook) return;
    const next = webhook.status === "active" ? "disabled" : "active";
    try {
      await apiFetch(`/webhook/${webhookId}`, { method: "PATCH", body: { status: next } }, { token, org, app: appId });
      toast({ title: `Webhook ${next}` });
      mutateWebhook();
    } catch (err) {
      console.error(err);
      toast({ title: "Update failed", variant: "destructive" });
    }
  };

  const deleteWebhook = async () => {
    try {
      await apiFetch(`/webhook/${webhookId}`, { method: "DELETE" }, { token, org, app: appId });
      toast({ title: "Webhook deleted" });
      router.push(`/dashboard/${orgId}/${appId}/webhooks`);
    } catch (err) {
      console.error(err);
      toast({ title: "Delete failed", variant: "destructive" });
    }
  };

  if (!webhook) {
    return <div className="p-6 text-muted-foreground">Loading webhook…</div>;
  }

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <h1 className="text-2xl font-semibold truncate">{webhook.url}</h1>
          <div className="mt-2 flex items-center gap-2">
            <Badge variant={webhook.status === "active" ? "default" : "secondary"}>
              {webhook.status.toUpperCase()}
            </Badge>
            {webhook.secret_set && <Badge variant="outline">signed</Badge>}
            <span className="text-xs text-muted-foreground">Created {formatTimestamp(webhook.created_at)}</span>
          </div>
          <div className="mt-2 flex flex-wrap gap-1">
            {webhook.actions.map((a) => (
              <Badge key={a} variant="secondary">
                {a}
              </Badge>
            ))}
          </div>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={sendTest}>
            <PlayCircle className="h-4 w-4 mr-1" />
            Send test
          </Button>
          <Button variant="outline" onClick={toggleStatus}>
            <Power className="h-4 w-4 mr-1" />
            {webhook.status === "active" ? "Disable" : "Enable"}
          </Button>
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button variant="destructive">
                <Trash2 className="h-4 w-4 mr-1" />
                Delete
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Delete this webhook?</AlertDialogTitle>
                <AlertDialogDescription>
                  The webhook will stop receiving events. Logs will be retained.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Cancel</AlertDialogCancel>
                <AlertDialogAction onClick={deleteWebhook}>Delete</AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardHeader>
            <CardTitle className="text-xs text-muted-foreground">Total deliveries</CardTitle>
          </CardHeader>
          <CardContent className="text-2xl font-semibold">{metrics?.total ?? "—"}</CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="text-xs text-muted-foreground">Successful</CardTitle>
          </CardHeader>
          <CardContent className="text-2xl font-semibold text-green-600">{metrics?.success ?? "—"}</CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="text-xs text-muted-foreground">Failed</CardTitle>
          </CardHeader>
          <CardContent className="text-2xl font-semibold text-red-600">{metrics?.failed ?? "—"}</CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="text-xs text-muted-foreground">Success rate</CardTitle>
          </CardHeader>
          <CardContent className="text-2xl font-semibold">
            {metrics ? `${(metrics.success_rate * 100).toFixed(1)}%` : "—"}
          </CardContent>
        </Card>
      </div>

      <Tabs defaultValue="logs">
        <TabsList>
          <TabsTrigger value="logs">Delivery logs</TabsTrigger>
          <TabsTrigger value="info">Info</TabsTrigger>
        </TabsList>

        <TabsContent value="logs" className="space-y-4">
          <div className="flex gap-2">
            <Input
              placeholder="Filter by action"
              value={logAction}
              onChange={(e) => {
                setLogAction(e.target.value);
                setLogPage(1);
              }}
              className="max-w-xs"
            />
            <Button variant="outline" onClick={() => mutateLogs()}>
              Refresh
            </Button>
          </div>

          <Card>
            <CardContent className="p-0">
              {!logs ? (
                <div className="p-8 text-center text-muted-foreground">Loading…</div>
              ) : logs.data.length === 0 ? (
                <div className="p-8 text-center text-muted-foreground">No deliveries yet</div>
              ) : (
                <div className="divide-y">
                  {logs.data.map((log) => {
                    const open = expanded.has(log.id);
                    return (
                      <div key={log.id}>
                        <button
                          className="w-full flex items-center justify-between p-4 hover:bg-muted/40 text-left"
                          onClick={() => toggleExpand(log.id)}
                        >
                          <div className="flex items-center gap-3 min-w-0">
                            {open ? (
                              <ChevronDown className="h-4 w-4 flex-shrink-0" />
                            ) : (
                              <ChevronRight className="h-4 w-4 flex-shrink-0" />
                            )}
                            {log.success ? (
                              <CheckCircle2 className="h-4 w-4 text-green-600 flex-shrink-0" />
                            ) : (
                              <XCircle className="h-4 w-4 text-red-600 flex-shrink-0" />
                            )}
                            <div className="min-w-0">
                              <div className="font-medium text-sm truncate">{log.action}</div>
                              <div className="text-xs text-muted-foreground truncate">
                                {log.resource_type}
                                {log.resource_id ? ` · ${log.resource_id}` : ""}
                              </div>
                            </div>
                          </div>
                          <div className="flex items-center gap-3 ml-4">
                            {log.status_code != null && (
                              <Badge variant="outline" className="font-mono text-xs">
                                {log.status_code}
                              </Badge>
                            )}
                            <span className="text-xs text-muted-foreground whitespace-nowrap">
                              {formatTimestamp(log.created_at)}
                            </span>
                          </div>
                        </button>
                        {open && (
                          <div className="grid md:grid-cols-2 gap-4 px-6 pb-4">
                            <div>
                              <div className="text-xs font-semibold mb-1 text-muted-foreground">Request payload</div>
                              <pre className="bg-muted/50 rounded p-3 text-xs overflow-auto max-h-80">
                                <code>{prettyJson(log.webhook_payload)}</code>
                              </pre>
                            </div>
                            <div>
                              <div className="text-xs font-semibold mb-1 text-muted-foreground">Response</div>
                              <pre className="bg-muted/50 rounded p-3 text-xs overflow-auto max-h-80">
                                <code>{prettyJson(log.response)}</code>
                              </pre>
                            </div>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </CardContent>
          </Card>

          {logs && logs.total_pages > 1 && (
            <div className="flex items-center justify-end gap-2">
              <Button
                variant="outline"
                size="sm"
                disabled={logPage <= 1}
                onClick={() => setLogPage((p) => Math.max(1, p - 1))}
              >
                Previous
              </Button>
              <span className="text-sm text-muted-foreground">
                Page {logPage} of {logs.total_pages}
              </span>
              <Button
                variant="outline"
                size="sm"
                disabled={logPage >= logs.total_pages}
                onClick={() => setLogPage((p) => p + 1)}
              >
                Next
              </Button>
            </div>
          )}
        </TabsContent>

        <TabsContent value="info">
          <Card>
            <CardContent className="p-6 space-y-3 text-sm">
              <div>
                <div className="text-xs text-muted-foreground">URL</div>
                <div className="font-mono break-all">{webhook.url}</div>
              </div>
              {webhook.description && (
                <div>
                  <div className="text-xs text-muted-foreground">Description</div>
                  <div>{webhook.description}</div>
                </div>
              )}
              <div>
                <div className="text-xs text-muted-foreground">Subscribed actions</div>
                <div className="flex flex-wrap gap-1 mt-1">
                  {webhook.actions.map((a) => (
                    <Badge key={a} variant="secondary">
                      {a}
                    </Badge>
                  ))}
                </div>
              </div>
              <div>
                <div className="text-xs text-muted-foreground">Signed</div>
                <div>{webhook.secret_set ? "Yes (HMAC-SHA256)" : "No"}</div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
