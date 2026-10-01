"use client";
import { ApiRelease } from "@/app/dashboard/[orgId]/[appId]/releases/page";
import { View } from "@/app/dashboard/[orgId]/[appId]/views/page";
import { apiFetch } from "@/lib/api";
import { useAppContext } from "@/providers/app-context";
import React, { useEffect, useState } from "react";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import Link from "next/link";
import { Badge } from "../ui/badge";
import { useRouter } from "next/navigation";
interface ViewReleaseInfoProps {
  view: View;
}

/** Enough to cover a slice's history inline; anything beyond this is noted below the table. */
const PAGE_SIZE = 20;

const ViewReleaseInfo: React.FC<ViewReleaseInfoProps> = ({ view }) => {
  const router = useRouter();
  const [releases, setReleases] = useState<ApiRelease[]>([]);
  const [totalItems, setTotalItems] = useState<number>(0);
  const { token, org, app } = useAppContext();
  const [loading, setLoading] = useState<boolean>(true);

  const dimensionHeader = view.dimensions.map((d) => `${d.key}=${d.value}`).join(";");

  const fetchRelease = async () => {
    setLoading(true);
    try {
      const { data, total_items }: { data: ApiRelease[]; total_items?: number } = await apiFetch(
        `/releases/list`,
        {
          headers: {
            "x-dimension": dimensionHeader,
          },
          query: {
            page: 1,
            count: PAGE_SIZE,
          },
        },
        { token, org, app }
      );

      setReleases(data);
      setTotalItems(total_items ?? data.length);
    } catch (err) {
      console.log(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (token && org && app) {
      fetchRelease();
    }
  }, [token, org, app]);
  if (loading) {
    return (
      <div className="bg-white p-4 rounded-lg">
        <p>Loading release info...</p>
      </div>
    );
  }

  return (
    <div className="bg-white dark:bg-gray-800 p-4 rounded-lg">
      {releases.length === 0 ? (
        <p className="text-gray-600 dark:text-gray-300">No release yet</p>
      ) : (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>ID</TableHead>
              <TableHead>Package</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Created</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {releases.map((r) => (
              <TableRow
                key={r.id}
                onClick={() =>
                  router.push(
                    `/dashboard/${encodeURIComponent(org || "")}/${encodeURIComponent(app || "")}/releases/${encodeURIComponent(r.id)}`
                  )
                }
              >
                <TableCell className="font-mono text-sm">
                  <Link
                    href={`/dashboard/${encodeURIComponent(org || "")}/${encodeURIComponent(app || "")}/releases/${encodeURIComponent(r.id)}`}
                    className="hover:text-primary"
                  >
                    {r.id}
                  </Link>
                </TableCell>
                <TableCell className="text-muted-foreground">{r.package?.version ?? "—"}</TableCell>
                <TableCell>
                  <div className="flex flex-wrap items-center gap-1.5">
                    <Badge variant="outline">{r.experiment?.status || "—"}</Badge>
                    {r.is_reverted && <Badge variant="secondary">Reverted</Badge>}
                    {r.is_delete_release && <Badge variant="secondary">Deletion</Badge>}
                  </div>
                </TableCell>
                <TableCell className="text-muted-foreground">
                  {r.created_at ? new Date(r.created_at).toLocaleString() : "—"}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}
      {totalItems > releases.length && (
        <p className="mt-2 text-xs text-muted-foreground">
          Showing the {releases.length} most recent of {totalItems} releases for this view.
        </p>
      )}
    </div>
  );
};

export default ViewReleaseInfo;
