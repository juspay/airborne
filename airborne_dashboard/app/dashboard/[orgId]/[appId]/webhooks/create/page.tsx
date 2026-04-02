"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import useSWR from "swr";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { useAppContext } from "@/providers/app-context";
import { apiFetch } from "@/lib/api";
import { useToast } from "@/hooks/use-toast";
import { Shuffle, PlayCircle, CheckCircle2, XCircle } from "lucide-react";

interface WebhookAction {
  key: string;
  resource: string;
  action: string;
}

function generateSecret(): string {
  const bytes = new Uint8Array(32);
  crypto.getRandomValues(bytes);
  return Array.from(bytes)
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

export default function CreateWebhookPage() {
  const { token, org } = useAppContext();
  const { orgId, appId } = useParams<{ orgId: string; appId: string }>();
  const router = useRouter();
  const { toast } = useToast();

  const [url, setUrl] = useState("");
  const [description, setDescription] = useState("");
  const [actions, setActions] = useState<Set<string>>(new Set());
  const [secureEnabled, setSecureEnabled] = useState(false);
  const [secret, setSecret] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState<{ success: boolean; status_code: number | null; response: any } | null>(
    null
  );

  const { data: available } = useSWR<WebhookAction[]>(token && org && appId ? "/webhook/actions" : null, () =>
    apiFetch<WebhookAction[]>("/webhook/actions", {}, { token, org, app: appId })
  );

  useEffect(() => {
    if (secureEnabled && !secret) {
      setSecret(generateSecret());
    }
  }, [secureEnabled, secret]);

  const toggleAction = (key: string) => {
    setActions((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };

  const grouped: Record<string, WebhookAction[]> = {};
  (available ?? []).forEach((a) => {
    if (!grouped[a.resource]) grouped[a.resource] = [];
    grouped[a.resource].push(a);
  });

  const onTest = async () => {
    if (!url.trim()) {
      toast({ title: "URL is required", variant: "destructive" });
      return;
    }
    setTesting(true);
    setTestResult(null);
    try {
      const result = await apiFetch<{
        success: boolean;
        status_code: number | null;
        response: any;
      }>(
        "/webhook/test",
        {
          method: "POST",
          body: {
            url: url.trim(),
            secret: secureEnabled && secret ? secret : undefined,
          },
        },
        { token, org, app: appId }
      );
      setTestResult(result);
      toast({
        title: result.success ? "Test delivered" : "Test failed",
        variant: result.success ? "default" : "destructive",
      });
    } catch (err) {
      console.error(err);
      setTestResult({ success: false, status_code: null, response: String(err) });
      toast({ title: "Test request failed", variant: "destructive" });
    } finally {
      setTesting(false);
    }
  };

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!url.trim()) {
      toast({ title: "URL is required", variant: "destructive" });
      return;
    }
    if (actions.size === 0) {
      toast({ title: "Select at least one action", variant: "destructive" });
      return;
    }
    setSubmitting(true);
    try {
      const payload: any = {
        url: url.trim(),
        actions: Array.from(actions),
        description: description || undefined,
      };
      if (secureEnabled && secret) payload.secret = secret;
      await apiFetch("/webhook", { method: "POST", body: payload }, { token, org, app: appId });
      toast({ title: "Webhook created" });
      router.push(`/dashboard/${orgId}/${appId}/webhooks`);
    } catch (err) {
      console.error(err);
      toast({ title: "Failed to create webhook", variant: "destructive" });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="p-6 max-w-3xl mx-auto space-y-6">
      <h1 className="text-2xl font-semibold">Create webhook</h1>

      <form onSubmit={onSubmit} className="space-y-6">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Endpoint</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <Label htmlFor="url">URL</Label>
              <Input
                id="url"
                placeholder="https://example.com/hooks/airborne"
                value={url}
                onChange={(e) => setUrl(e.target.value)}
              />
            </div>
            <div>
              <Label htmlFor="description">Description (optional)</Label>
              <Textarea
                id="description"
                rows={2}
                value={description}
                onChange={(e) => setDescription(e.target.value)}
              />
            </div>
            <div className="flex items-center justify-between">
              <p className="text-xs text-muted-foreground">
                Send a sample payload to verify your endpoint before saving.
              </p>
              <Button type="button" variant="outline" size="sm" disabled={testing || !url.trim()} onClick={onTest}>
                <PlayCircle className="h-4 w-4 mr-1" />
                {testing ? "Sending…" : "Send test"}
              </Button>
            </div>
            {testResult && (
              <div
                className={`rounded-md border p-3 text-xs space-y-2 ${
                  testResult.success ? "border-green-500/40 bg-green-500/5" : "border-red-500/40 bg-red-500/5"
                }`}
              >
                <div className="flex items-center gap-2 text-sm font-medium">
                  {testResult.success ? (
                    <CheckCircle2 className="h-4 w-4 text-green-600" />
                  ) : (
                    <XCircle className="h-4 w-4 text-red-600" />
                  )}
                  {testResult.success ? "Delivery succeeded" : "Delivery failed"}
                  {testResult.status_code != null && (
                    <Badge variant="outline" className="font-mono">
                      {testResult.status_code}
                    </Badge>
                  )}
                </div>
                <pre className="bg-background/60 rounded p-2 overflow-auto max-h-60">
                  <code>
                    {(() => {
                      try {
                        return JSON.stringify(testResult.response, null, 2);
                      } catch {
                        return String(testResult.response);
                      }
                    })()}
                  </code>
                </pre>
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Events</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {Object.keys(grouped).length === 0 && <div className="text-sm text-muted-foreground">Loading actions…</div>}
            {Object.entries(grouped).map(([resource, list]) => (
              <div key={resource} className="space-y-2">
                <div className="text-sm font-medium capitalize">{resource}</div>
                <div className="flex flex-wrap gap-2">
                  {list.map((a) => {
                    const checked = actions.has(a.key);
                    return (
                      <label
                        key={a.key}
                        className={`flex items-center gap-2 rounded-md border px-3 py-1.5 text-sm cursor-pointer ${
                          checked ? "bg-primary/10 border-primary" : "bg-background"
                        }`}
                      >
                        <Checkbox checked={checked} onCheckedChange={() => toggleAction(a.key)} />
                        {a.action}
                      </label>
                    );
                  })}
                </div>
              </div>
            ))}
            {actions.size > 0 && (
              <div className="text-xs text-muted-foreground">
                Selected:{" "}
                {Array.from(actions).map((k) => (
                  <Badge key={k} variant="secondary" className="mr-1">
                    {k}
                  </Badge>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Secure webhook (HMAC)</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <label className="flex items-center gap-2 text-sm">
              <Checkbox checked={secureEnabled} onCheckedChange={(v) => setSecureEnabled(!!v)} />
              Sign requests with an HMAC secret
            </label>
            {secureEnabled && (
              <div className="space-y-2">
                <Label htmlFor="secret">HMAC secret (32 bytes hex)</Label>
                <div className="flex gap-2">
                  <Input
                    id="secret"
                    value={secret}
                    onChange={(e) => setSecret(e.target.value)}
                    className="font-mono text-xs"
                  />
                  <Button type="button" variant="outline" onClick={() => setSecret(generateSecret())}>
                    <Shuffle className="h-4 w-4 mr-1" />
                    Regenerate
                  </Button>
                </div>
                <p className="text-xs text-muted-foreground">
                  Store this secret safely — it won&apos;t be shown again. We sign every delivery with HMAC-SHA256 and
                  send <code>X-Signature</code> and <code>X-Timestamp</code> headers.
                </p>
              </div>
            )}
          </CardContent>
        </Card>

        <div className="flex justify-end gap-2">
          <Button type="button" variant="outline" onClick={() => router.back()}>
            Cancel
          </Button>
          <Button type="submit" disabled={submitting}>
            {submitting ? "Creating…" : "Create webhook"}
          </Button>
        </div>
      </form>
    </div>
  );
}
