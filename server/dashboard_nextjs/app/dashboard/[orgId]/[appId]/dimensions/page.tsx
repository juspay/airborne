"use client";

import { useEffect, useMemo, useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Plus, Target, ArrowUp, ArrowDown } from "lucide-react";
import { useAppContext } from "@/providers/app-context";
import { apiFetch } from "@/lib/api";

export type Dimension = {
  dimension: string;
  position: number;
  schema?: any;
  description?: string;
  mandatory?: boolean;
  change_reason?: string;
};

export default function DimensionsPage() {
  const { token, org, app } = useAppContext();
  const [searchQuery, setSearchQuery] = useState("");
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [formData, setFormData] = useState({ key: "", description: "" });
  const [dimensions, setDimensions] = useState<Dimension[]>([]);

  const load = () =>
    apiFetch<any>("/organisations/applications/dimension/list", {}, { token, org, app })
      .then((res) => setDimensions((res.data as any[]) || []))
      .catch(() => setDimensions([]));

  useEffect(() => {
    if (token && org && app) load();
  }, [token, org, app]);

  const filtered = useMemo(
    () =>
      dimensions
        .filter(
          (d) =>
            d.dimension.toLowerCase().includes(searchQuery.toLowerCase()) ||
            d.description?.toLowerCase().includes(searchQuery.toLowerCase())
        )
        .sort((a, b) => a.position - b.position),
    [dimensions, searchQuery]
  );

  const handleCreate = async () => {
    const schema = "string";
    await apiFetch(
      "/organisations/applications/dimension/create",
      { method: "POST", body: { dimension: formData.key, schema, description: formData.description } },
      { token, org, app }
    );
    setIsCreateModalOpen(false);
    setFormData({ key: "", description: "" });
    load();
  };

  const movePriority = async (name: string, to: number) => {
    await apiFetch(
      `/organisations/applications/dimension/${encodeURIComponent(name)}`,
      { method: "PUT", body: { position: to, change_reason: "Reorder via UI" } },
      { token, org, app }
    );
    load();
  };

  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-3xl font-bold font-[family-name:var(--font-space-grotesk)] text-balance">Dimensions</h1>
          <p className="text-muted-foreground mt-2">Manage targeting dimensions for precise release control</p>
        </div>

        <Dialog open={isCreateModalOpen} onOpenChange={setIsCreateModalOpen}>
          <DialogTrigger asChild>
            <Button>
              <Plus className="h-4 w-4 mr-2" />
              Create Dimension
            </Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle>Create New Dimension</DialogTitle>
              <DialogDescription>Add a new targeting dimension for release control</DialogDescription>
            </DialogHeader>
            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="key">Key *</Label>
                <Input
                  id="key"
                  value={formData.key}
                  onChange={(e) => setFormData({ ...formData, key: e.target.value.toLowerCase().replace(/\s+/g, "_") })}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="description">Description*</Label>
                <Textarea
                  id="description"
                  rows={2}
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                />
              </div>
              <div className="flex justify-end gap-2 pt-4">
                <Button variant="outline" onClick={() => setIsCreateModalOpen(false)}>
                  Cancel
                </Button>
                <Button onClick={handleCreate} disabled={!formData.key || !formData.description}>
                  Create Dimension
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="font-[family-name:var(--font-space-grotesk)]">Dimensions</CardTitle>
          <CardDescription>Manage targeting dimensions and their priority order</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="mb-4">
            <Input
              placeholder="Search dimensions..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-[80px]">Priority</TableHead>
                <TableHead>Name</TableHead>
                <TableHead>Description</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.map((d) => (
                <TableRow key={d.dimension}>
                  <TableCell>
                    <div className="flex items-center gap-1">
                      <span className="text-sm font-medium">{d.position}</span>
                      <div className="flex flex-col">
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-4 w-4 p-0"
                          onClick={() => movePriority(d.dimension, Math.max(1, d.position - 1))}
                          disabled={d.position === 1}
                        >
                          <ArrowUp className="h-3 w-3" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-4 w-4 p-0"
                          onClick={() => movePriority(d.dimension, d.position + 1)}
                        >
                          <ArrowDown className="h-3 w-3" />
                        </Button>
                      </div>
                    </div>
                  </TableCell>
                  <TableCell className="font-mono text-sm">{d.dimension}</TableCell>
                  <TableCell className="text-muted-foreground">{d.description || "—"}</TableCell>
                </TableRow>
              ))}
              {filtered.length === 0 && (
                <TableRow>
                  <TableCell colSpan={3} className="text-center text-muted-foreground py-8">
                    <Target className="inline h-5 w-5 mr-2" />
                    No dimensions found
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
