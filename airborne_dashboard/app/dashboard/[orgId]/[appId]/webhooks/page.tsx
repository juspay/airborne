"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import useSWR from "swr";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Plus, Webhook as WebhookIcon } from "lucide-react";
import { useAppContext } from "@/providers/app-context";
import { apiFetch } from "@/lib/api";

interface WebhookItem {
  id: string;
  url: string;
  status: string;
  secret_set: boolean;
  actions: string[];
  description?: string | null;
  created_at: string;
  updated_at: string;
}

interface Paginated<T> {
  data: T[];
  total_items: number;
  total_pages: number;
}

export default function WebhooksListPage() {
  const { token, org } = useAppContext();
  const { orgId, appId } = useParams<{ orgId: string; appId: string }>();
  const [page, setPage] = useState(1);
  const [actionFilter, setActionFilter] = useState<string>("");
  const count = 20;

  const swrKey = useMemo(
    () => (token && org && appId ? ["/webhook", page, count, actionFilter] : null),
    [token, org, appId, page, actionFilter]
  );

  const { data, isLoading, mutate } = useSWR<Paginated<WebhookItem>>(swrKey, () =>
    apiFetch<Paginated<WebhookItem>>(
      "/webhook",
      {
        query: {
          page,
          count,
          ...(actionFilter ? { action: actionFilter } : {}),
        },
      },
      { token, org, app: appId }
    )
  );

  const items = data?.data ?? [];

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold flex items-center gap-2">
            <WebhookIcon className="h-6 w-6" />
            Webhooks
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Outgoing webhooks triggered by actions inside this application.
          </p>
        </div>
        <Link href={`/dashboard/${orgId}/${appId}/webhooks/create`}>
          <Button>
            <Plus className="h-4 w-4 mr-1" />
            New webhook
          </Button>
        </Link>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Filters</CardTitle>
        </CardHeader>
        <CardContent className="flex gap-2">
          <Input
            placeholder="Filter by action (e.g. release.create)"
            value={actionFilter}
            onChange={(e) => setActionFilter(e.target.value)}
            className="max-w-sm"
          />
          <Button variant="outline" onClick={() => mutate()}>
            Refresh
          </Button>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="p-8 text-center text-muted-foreground">Loading…</div>
          ) : items.length === 0 ? (
            <div className="p-8 text-center text-muted-foreground">No webhooks yet</div>
          ) : (
            <div className="divide-y">
              {items.map((w) => (
                <Link
                  key={w.id}
                  href={`/dashboard/${orgId}/${appId}/webhooks/${w.id}`}
                  className="flex items-center justify-between p-4 hover:bg-muted/40"
                >
                  <div className="min-w-0">
                    <div className="font-medium truncate">{w.url}</div>
                    <div className="text-xs text-muted-foreground mt-1 flex flex-wrap gap-1">
                      {w.actions.map((a) => (
                        <Badge key={a} variant="secondary" className="text-[10px]">
                          {a}
                        </Badge>
                      ))}
                    </div>
                  </div>
                  <div className="flex items-center gap-2 ml-4">
                    {w.secret_set && <Badge variant="outline">signed</Badge>}
                    <Badge variant={w.status === "active" ? "default" : "secondary"} className="uppercase">
                      {w.status}
                    </Badge>
                  </div>
                </Link>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {data && data.total_pages > 1 && (
        <div className="flex items-center justify-end gap-2">
          <Button variant="outline" size="sm" disabled={page <= 1} onClick={() => setPage((p) => Math.max(1, p - 1))}>
            Previous
          </Button>
          <span className="text-sm text-muted-foreground">
            Page {page} of {data.total_pages}
          </span>
          <Button variant="outline" size="sm" disabled={page >= data.total_pages} onClick={() => setPage((p) => p + 1)}>
            Next
          </Button>
        </div>
      )}
    </div>
  );
}
