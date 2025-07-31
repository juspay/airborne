"use client";

import { useMemo, useState } from "react";
import useSWR, { mutate } from "swr";
import SharedLayout from "@/components/shared-layout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Rocket, Search, Plus } from "lucide-react";
import Link from "next/link";
import { apiFetch } from "@/lib/api";
import { useAppContext } from "@/providers/app-context";

type OrgResp = { name: string; applications: { application: string; organisation: string }[] };

export default function ApplicationsPage() {
  const { token, org, logout } = useAppContext();
  const [searchQuery, setSearchQuery] = useState("");
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [formData, setFormData] = useState({ name: "", description: "" });

  const { data, isLoading, error } = useSWR<OrgResp[]>(token ? "/organisations" : null, (url: string) =>
    apiFetch<any>(url, {}, { token, logout })
  );

  const apps = useMemo(
    () => data?.find((o) => o.name === org)?.applications?.map((a) => a.application) || [],
    [data, org]
  );
  const filtered = apps.filter((a) => a.toLowerCase().includes(searchQuery.toLowerCase()));

  const handleCreate = async () => {
    await apiFetch(
      "/organisations/applications/create",
      { method: "POST", body: { application: formData.name } },
      { token, org, logout }
    );
    setIsCreateModalOpen(false);
    setFormData({ name: "", description: "" });
    mutate("/organisations");
  };

  return (
    <SharedLayout>
      <div className="p-6">
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-3xl font-bold font-[family-name:var(--font-space-grotesk)] text-balance">
              Organization Overview
            </h1>
            <p className="text-muted-foreground mt-2">Manage your organization, applications, and team members</p>
          </div>
          <Dialog open={isCreateModalOpen} onOpenChange={setIsCreateModalOpen}>
            <DialogTrigger asChild>
              <Button>
                <Plus className="h-4 w-4 mr-2" />
                Create Application
              </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-md">
              <DialogHeader>
                <DialogTitle>Create New Application</DialogTitle>
                <DialogDescription>Add a new application to your organisation</DialogDescription>
              </DialogHeader>
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="name">Application name *</Label>
                  <Input
                    id="name"
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="description">Description</Label>
                  <Textarea
                    id="description"
                    rows={3}
                    value={formData.description}
                    onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  />
                </div>
                <div className="flex justify-end gap-2 pt-4">
                  <Button variant="outline" onClick={() => setIsCreateModalOpen(false)}>
                    Cancel
                  </Button>
                  <Button onClick={handleCreate} disabled={!formData.name}>
                    Create Application
                  </Button>
                </div>
              </div>
            </DialogContent>
          </Dialog>
        </div>

        <Card className="mb-6">
          <CardContent className="p-4">
            <div className="flex items-center gap-4">
              <div className="flex-1">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    placeholder="Search applications..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="pl-10"
                  />
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {error ? (
          <div className="text-red-600">Failed to load applications</div>
        ) : isLoading ? (
          <div>Loading…</div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {filtered.map((a) => (
              <Card key={a}>
                <CardHeader>
                  <CardTitle className="font-[family-name:var(--font-space-grotesk)]">{a}</CardTitle>
                  <CardDescription>{org}</CardDescription>
                </CardHeader>
                <CardContent className="flex items-center justify-between">
                  <div className="flex items-center gap-2 text-muted-foreground">
                    <Rocket className="h-4 w-4" />
                    <span className="text-sm">Releases</span>
                  </div>
                  <Button asChild size="sm">
                    <Link href={"/dashboard/" + encodeURIComponent(org || "") + "/" + encodeURIComponent(a || "")}>
                      Open
                    </Link>
                  </Button>
                </CardContent>
              </Card>
            ))}
            {filtered.length === 0 && (
              <div className="text-muted-foreground">No applications in {org || "selected org"}.</div>
            )}
          </div>
        )}
      </div>
    </SharedLayout>
  );
}
