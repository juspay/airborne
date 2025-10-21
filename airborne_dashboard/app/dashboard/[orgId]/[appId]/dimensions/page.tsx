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
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Plus, Target, ArrowUp, ArrowDown, Users, Settings, ExternalLink } from "lucide-react";
import { useAppContext } from "@/providers/app-context";
import { apiFetch } from "@/lib/api";
import { hasAppAccess } from "@/lib/utils";
import { useToast } from "@/hooks/use-toast";
import Link from "next/link";
import { useParams } from "next/navigation";
import { useDebouncedValue } from "@/hooks/useDebouncedValue";

export type Dimension = {
  dimension: string;
  position: number;
  schema?: any;
  description?: string;
  mandatory?: boolean;
  change_reason?: string;
  dimension_type?: "standard" | "cohort";
  depends_on?: string;
};

type DimensionFormData = {
  key: string;
  description: string;
  dimensionType: "standard" | "cohort";
  dependsOn: string;
};

export default function DimensionsPage() {
  const { token, org, app, getAppAccess, getOrgAccess } = useAppContext();
  const { toast } = useToast();
  const params = useParams();
  const [searchQuery, setSearchQuery] = useState("");
  const debouncedSeachQuery = useDebouncedValue(searchQuery, 500);
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [formData, setFormData] = useState<DimensionFormData>({
    key: "",
    description: "",
    dimensionType: "standard",
    dependsOn: "",
  });
  const [dimensions, setDimensions] = useState<Dimension[]>([]);
  const [creating, setCreating] = useState(false);

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
    [dimensions, debouncedSeachQuery]
  );

  // Available dimensions for cohort depends_on (exclude cohort dimensions)
  const availableDimensions = useMemo(() => dimensions.filter((d) => d.dimension_type !== "cohort"), [dimensions]);

  const resetForm = () => {
    setFormData({ key: "", description: "", dimensionType: "standard", dependsOn: "" });
  };

  const handleCreate = async () => {
    setCreating(true);
    const payload: any = {
      dimension: formData.key,
      description: formData.description,
      dimension_type: formData.dimensionType,
    };

    // For cohort dimensions, include depends_on
    if (formData.dimensionType === "cohort" && formData.dependsOn) {
      payload.depends_on = formData.dependsOn;
    }

    try {
      await apiFetch(
        "/organisations/applications/dimension/create",
        { method: "POST", body: payload },
        { token, org, app }
      );
      setIsCreateModalOpen(false);
      resetForm();
      load();
      toast({
        title: "Dimension created",
        description: `Successfully created ${formData.dimensionType} dimension "${formData.key}"`,
      });
    } catch (error) {
      console.error("Failed to create dimension:", error);
      toast({
        title: "Error",
        description: "Failed to create dimension. Please try again.",
        variant: "destructive",
      });
    } finally {
      setCreating(false);
    }
  };

  const movePriority = async (name: string, to: number) => {
    try {
      await apiFetch(
        `/organisations/applications/dimension/${encodeURIComponent(name)}`,
        { method: "PUT", body: { position: to, change_reason: "Reorder via UI" } },
        { token, org, app }
      );
      load();
      toast({
        title: "Priority updated",
        description: `Updated priority for dimension "${name}"`,
      });
    } catch (error) {
      console.error("Failed to update priority:", error);
      toast({
        title: "Error",
        description: "Failed to update dimension priority. Please try again.",
        variant: "destructive",
      });
    }
  };

  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-3xl font-bold font-[family-name:var(--font-space-grotesk)] text-balance">Dimensions</h1>
          <p className="text-muted-foreground mt-2">Manage targeting dimensions for precise release control</p>
        </div>

        {hasAppAccess(getOrgAccess(org), getAppAccess(org, app)) && (
          <Dialog
            open={isCreateModalOpen}
            onOpenChange={(open) => {
              setIsCreateModalOpen(open);
              if (!open) resetForm();
            }}
          >
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
                    onChange={(e) =>
                      setFormData({ ...formData, key: e.target.value.toLowerCase().replace(/\s+/g, "_") })
                    }
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="dimensionType">Dimension Type *</Label>
                  <Select
                    value={formData.dimensionType}
                    onValueChange={(value: "standard" | "cohort") =>
                      setFormData({ ...formData, dimensionType: value, dependsOn: "" })
                    }
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select dimension type" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="standard">
                        <div className="flex items-center gap-2">
                          <Settings className="h-4 w-4" />
                          <span>Standard</span>
                        </div>
                      </SelectItem>
                      <SelectItem value="cohort" disabled={availableDimensions.length === 0}>
                        <div className="flex items-center gap-2">
                          <Users className="h-4 w-4" />
                          <span>Cohort</span>
                          {availableDimensions.length === 0 && (
                            <span className="text-xs text-muted-foreground">(requires standard dimensions)</span>
                          )}
                        </div>
                      </SelectItem>
                    </SelectContent>
                  </Select>
                  {formData.dimensionType === "cohort" && (
                    <p className="text-xs text-muted-foreground">
                      Cohort dimensions allow user segmentation based on version ranges or group memberships.
                    </p>
                  )}
                </div>

                {formData.dimensionType === "cohort" && (
                  <div className="space-y-2">
                    <Label htmlFor="dependsOn">Depends On *</Label>
                    <Select
                      value={formData.dependsOn}
                      onValueChange={(value) => setFormData({ ...formData, dependsOn: value })}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Select dimension this cohort depends on" />
                      </SelectTrigger>
                      <SelectContent>
                        {availableDimensions.length === 0 ? (
                          <div className="p-2 text-sm text-muted-foreground">
                            No standard dimensions available. Create a standard dimension first.
                          </div>
                        ) : (
                          availableDimensions.map((dim) => (
                            <SelectItem key={dim.dimension} value={dim.dimension}>
                              {dim.dimension}
                            </SelectItem>
                          ))
                        )}
                      </SelectContent>
                    </Select>
                    <p className="text-xs text-muted-foreground">
                      The dimension that this cohort will use for segmentation (e.g., app_version, user_id).
                    </p>
                  </div>
                )}

                <div className="space-y-2">
                  <Label htmlFor="description">Description *</Label>
                  <Textarea
                    id="description"
                    rows={2}
                    value={formData.description}
                    onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  />
                </div>

                <div className="flex justify-end gap-2 pt-4">
                  <Button
                    variant="outline"
                    onClick={() => {
                      setIsCreateModalOpen(false);
                      resetForm();
                    }}
                  >
                    Cancel
                  </Button>
                  <Button
                    onClick={handleCreate}
                    disabled={
                      creating ||
                      !formData.key ||
                      !formData.description ||
                      (formData.dimensionType === "cohort" && !formData.dependsOn)
                    }
                  >
                    {creating ? "Creating..." : "Create Dimension"}
                  </Button>
                </div>
              </div>
            </DialogContent>
          </Dialog>
        )}
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
                <TableHead className="w-[80px]">Weight</TableHead>
                <TableHead>Name</TableHead>
                <TableHead>Type</TableHead>
                <TableHead>Description</TableHead>
                <TableHead className="w-[120px]">Actions</TableHead>
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
                          disabled={d.position === 1 || !hasAppAccess(getOrgAccess(org), getAppAccess(org, app))}
                        >
                          <ArrowUp className="h-3 w-3" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-4 w-4 p-0"
                          onClick={() => movePriority(d.dimension, d.position + 1)}
                          disabled={
                            d.position === dimensions.length - 1 ||
                            !hasAppAccess(getOrgAccess(org), getAppAccess(org, app))
                          }
                        >
                          <ArrowDown className="h-3 w-3" />
                        </Button>
                      </div>
                    </div>
                  </TableCell>
                  <TableCell className="font-mono text-sm">{d.dimension}</TableCell>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      <Badge
                        variant={d.dimension_type === "cohort" ? "default" : "secondary"}
                        className="flex items-center gap-1"
                      >
                        {d.dimension_type === "cohort" ? (
                          <>
                            <Users className="h-3 w-3" />
                            Cohort
                          </>
                        ) : (
                          <>
                            <Settings className="h-3 w-3" />
                            Standard
                          </>
                        )}
                      </Badge>
                      {d.dimension_type === "cohort" && d.depends_on && (
                        <span className="text-xs text-muted-foreground">→ {d.depends_on}</span>
                      )}
                    </div>
                  </TableCell>
                  <TableCell className="text-muted-foreground">{d.description || "—"}</TableCell>
                  <TableCell>
                    {d.dimension_type === "cohort" && (
                      <Link href={`/dashboard/${params.orgId}/${params.appId}/cohorts`}>
                        <Button variant="outline" size="sm" className="flex items-center gap-1">
                          <ExternalLink className="h-3 w-3" />
                          Manage
                        </Button>
                      </Link>
                    )}
                  </TableCell>
                </TableRow>
              ))}
              {filtered.length === 0 && (
                <TableRow>
                  <TableCell colSpan={5} className="text-center text-muted-foreground py-8">
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
