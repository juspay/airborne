"use client";

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ArrowLeft, RefreshCw, Eye } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useAppContext } from "@/providers/app-context";
import { apiFetch } from "@/lib/api";
import { useParams, useRouter } from "next/navigation";
import type { WebhookScope } from "@/components/webhooks/webhooks-view";

interface Delivery {
  id: string;
  event: string;
  status: string;
  app_id: string | null;
  attempt_count: number;
  max_attempts: number;
  last_status_code: number | null;
  is_test: boolean;
  scheduled_for: string;
  created_at: string;
}

interface Attempt {
  attempt_number: number;
  request_url: string;
  request_headers: Record<string, string>;
  request_body: string;
  response_status: number | null;
  response_headers: Record<string, string> | null;
  response_body: string | null;
  error: string | null;
  duration_ms: number | null;
  attempted_at: string;
}

interface DeliveryDetail extends Delivery {
  payload: any;
  attempts: Attempt[];
}

const statusVariant = (status: string): "secondary" | "destructive" | "outline" => {
  if (status === "succeeded") return "secondary";
  if (status === "failed" || status === "exhausted" || status === "cancelled") return "destructive";
  return "outline";
};

const fmt = (d: string) =>
  new Date(d).toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });

// Pretty-print a response body when it's JSON; otherwise show it verbatim.
const formatBody = (body: string) => {
  try {
    return JSON.stringify(JSON.parse(body.trim()), null, 2);
  } catch {
    return body;
  }
};

const DeliveriesView = ({ scope }: { scope: WebhookScope }) => {
  const { token, org, app: ctxApp } = useAppContext();
  // Org-scoped requests must not send `x-application` — see `WebhooksView`.
  const app = scope === "app" ? ctxApp : undefined;

  const params = useParams();
  const router = useRouter();
  const { toast } = useToast();
  const webhookId = params?.webhookId as string;

  const [deliveries, setDeliveries] = useState<Delivery[]>([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [detail, setDetail] = useState<DeliveryDetail | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    load();
  }, [page]);

  const load = async () => {
    try {
      setLoading(true);
      const res = await apiFetch<{ data: Delivery[]; total_pages: number }>(
        `/webhooks/${webhookId}/deliveries`,
        { query: { page, count: 25 } },
        { token, org, app }
      );
      setDeliveries(res.data);
      setTotalPages(res.total_pages || 1);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  const openDetail = async (id: string) => {
    try {
      const res = await apiFetch<DeliveryDetail>(`/webhooks/deliveries/${id}`, {}, { token, org, app });
      setDetail(res);
    } catch (e) {
      console.error(e);
    }
  };

  const resend = async (id: string) => {
    try {
      setBusy(true);
      await apiFetch(`/webhooks/deliveries/${id}/resend`, { method: "POST", body: {} }, { token, org, app });
      toast({ title: "Resent", description: "A new delivery was queued" });
      load();
    } catch (e) {
      console.error(e);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="container mx-auto py-8 px-4 max-w-6xl">
      <Button variant="ghost" size="sm" className="mb-4 gap-2" onClick={() => router.back()}>
        <ArrowLeft className="h-4 w-4" /> Back to webhooks
      </Button>
      <h1 className="text-3xl font-bold text-foreground mb-2">Deliveries</h1>
      <p className="text-muted-foreground mb-8">Every delivery attempt and the response your endpoint returned.</p>

      {loading ? (
        <div className="flex justify-center py-12">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
        </div>
      ) : deliveries.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center text-muted-foreground">No deliveries yet.</CardContent>
        </Card>
      ) : (
        <Card>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Event</TableHead>
                  {/* An org webhook fires for every app, so which one triggered it matters. */}
                  {scope === "org" && <TableHead>Application</TableHead>}
                  <TableHead>Status</TableHead>
                  <TableHead>Attempts</TableHead>
                  <TableHead>Code</TableHead>
                  <TableHead>Created</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {deliveries.map((d) => (
                  <TableRow key={d.id}>
                    <TableCell className="font-mono text-xs">
                      {d.event}
                      {d.is_test && (
                        <Badge variant="outline" className="ml-2 text-xs">
                          test
                        </Badge>
                      )}
                    </TableCell>
                    {scope === "org" && (
                      <TableCell className="text-xs">
                        {d.app_id ?? <span className="text-muted-foreground">organisation</span>}
                      </TableCell>
                    )}
                    <TableCell>
                      <Badge variant={statusVariant(d.status)}>{d.status}</Badge>
                    </TableCell>
                    <TableCell>
                      {d.attempt_count}/{d.max_attempts}
                    </TableCell>
                    <TableCell className="font-mono">{d.last_status_code ?? "—"}</TableCell>
                    <TableCell className="text-xs text-muted-foreground">{fmt(d.created_at)}</TableCell>
                    <TableCell>
                      <div className="flex items-center justify-end gap-1">
                        <Button variant="ghost" size="sm" title="View" onClick={() => openDetail(d.id)}>
                          <Eye className="h-4 w-4" />
                        </Button>
                        <Button variant="ghost" size="sm" title="Resend" disabled={busy} onClick={() => resend(d.id)}>
                          <RefreshCw className="h-4 w-4" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}

      {totalPages > 1 && (
        <div className="flex justify-center items-center gap-4 mt-6">
          <Button variant="outline" size="sm" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>
            Previous
          </Button>
          <span className="text-sm text-muted-foreground">
            Page {page} of {totalPages}
          </span>
          <Button variant="outline" size="sm" disabled={page >= totalPages} onClick={() => setPage((p) => p + 1)}>
            Next
          </Button>
        </div>
      )}

      {/* Delivery detail */}
      <Dialog open={!!detail} onOpenChange={() => setDetail(null)}>
        <DialogContent className="sm:max-w-3xl max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <span className="font-mono text-base">{detail?.event}</span>
              {detail && <Badge variant={statusVariant(detail.status)}>{detail.status}</Badge>}
            </DialogTitle>
            <DialogDescription>Delivery {detail?.id}</DialogDescription>
          </DialogHeader>
          {detail && (
            <div className="space-y-4 py-2">
              <div>
                <h3 className="text-sm font-semibold mb-1">Payload</h3>
                <pre className="max-h-48 overflow-auto whitespace-pre-wrap break-words rounded-md bg-muted p-3 text-xs">
                  {JSON.stringify(detail.payload, null, 2)}
                </pre>
              </div>
              <div>
                <h3 className="text-sm font-semibold mb-2">Attempts ({detail.attempts.length})</h3>
                <div className="space-y-3">
                  {detail.attempts.map((a) => (
                    <div key={a.attempt_number} className="border rounded-md p-3 space-y-2">
                      <div className="flex items-center justify-between text-sm">
                        <span className="font-medium">Attempt #{a.attempt_number}</span>
                        <div className="flex items-center gap-2">
                          {a.response_status != null ? (
                            <Badge variant={a.response_status < 300 ? "secondary" : "destructive"}>
                              HTTP {a.response_status}
                            </Badge>
                          ) : (
                            <Badge variant="destructive">no response</Badge>
                          )}
                          {a.duration_ms != null && (
                            <span className="text-xs text-muted-foreground">{a.duration_ms} ms</span>
                          )}
                        </div>
                      </div>
                      <div className="text-xs text-muted-foreground">{fmt(a.attempted_at)}</div>
                      {a.error && <p className="text-xs text-destructive break-words">{a.error}</p>}
                      {a.response_body && (
                        <div>
                          <p className="text-xs font-semibold mb-1">Response body</p>
                          <pre className="max-h-40 overflow-auto whitespace-pre-wrap break-words rounded-md bg-muted p-3 text-xs">
                            {formatBody(a.response_body)}
                          </pre>
                        </div>
                      )}
                    </div>
                  ))}
                  {detail.attempts.length === 0 && (
                    <p className="text-sm text-muted-foreground">No attempts recorded yet (still scheduled).</p>
                  )}
                </div>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default DeliveriesView;
