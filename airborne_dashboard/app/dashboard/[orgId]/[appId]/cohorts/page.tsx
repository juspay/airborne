"use client";

import { useEffect, useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Plus, Users, Target, X, GitBranch, ArrowLeftRight } from "lucide-react";
import { useAppContext } from "@/providers/app-context";
import { apiFetch } from "@/lib/api";
import { useToast } from "@/hooks/use-toast";
import Link from "next/link";
import { definePagePermissions, permission } from "@/lib/page-permissions";
import { usePagePermissions } from "@/hooks/use-page-permissions";
import { classifyCacheError } from "@/lib/control-center/rollback-error";
import { frozenWriteNotice } from "@/lib/control-center/approval";
import { overlappingCohorts } from "@/lib/cohort-overlap";

const PAGE_AUTHZ = definePagePermissions({
  read_dimensions: permission("dimension", "read", "app"),
  read_cohort: permission("cohort", "read", "app"),
  update_cohort: permission("cohort", "update", "app"),
  create_cohort_group: permission("cohort_group", "create", "app"),
  read_cohort_group: permission("cohort_group", "read", "app"),
  update_cohort_group: permission("cohort_group", "update", "app"),
  read_releases: permission("release", "read", "app"),
});

interface CohortSchema {
  type: string;
  enum: string[];
  definitions: Record<string, any>;
}

interface Dimension {
  dimension: string;
  position: number;
  schema?: any;
  description?: string;
  mandatory?: boolean;
  change_reason?: string;
  dimension_type?: "standard" | "cohort";
  depends_on?: string;
}

interface Release {
  id: string;
  created_at: string;
  experiment: {
    status: string;
    traffic_percentage?: number;
  };
  // Add more fields as needed
}

type CheckpointForm = {
  name: string;
  value: string;
  valueType: "semver" | "string";
  includeValue: boolean; // true = >= or <=, false = > or <
};

/**
 * A cohort write also clears the CDN's cached release answers. When only that part fails, the server answers
 * 502 cache_invalidation_failed and the cohort is saved: say so instead of inviting a repeat.
 */
function cacheWarning(error: unknown): { title: string; description: string } | null {
  const cache = classifyCacheError(error);
  if (!cache) return null;
  return {
    title: "Saved, but the CDN cache was not cleared",
    description:
      "The change is recorded on the server. Devices behind the CDN may keep the previous release answer until the cache expires; retry the cache clear from Control Center. Do not repeat the change.",
  };
}

type GroupForm = {
  name: string;
  members: string[];
  newMember: string;
};

/** A closed, inclusive semantic-version range. Independent of the checkpoint chain. */
type RangeForm = {
  name: string;
  lower: string;
  upper: string;
  priority: number;
};

const STABLE_SEMVER = /^\d+\.\d+\.\d+$/;

/** Problems the server would refuse, stated before the request is sent. */
function rangeProblems(form: RangeForm, existing: string[], otherwiseIndex: number): string[] {
  const problems: string[] = [];
  if (!form.name.trim()) problems.push("Give the range a name.");
  else if (form.name === "otherwise") problems.push("“otherwise” is reserved.");
  else if (existing.includes(form.name)) problems.push(`A cohort named “${form.name}” already exists.`);
  if (!STABLE_SEMVER.test(form.lower)) problems.push("Lower bound must be a stable version like 2.0.0.");
  if (!STABLE_SEMVER.test(form.upper)) problems.push("Upper bound must be a stable version like 2.9.9.");
  if (STABLE_SEMVER.test(form.lower) && STABLE_SEMVER.test(form.upper)) {
    const a = form.lower.split(".").map(Number);
    const b = form.upper.split(".").map(Number);
    const gt = a[0] > b[0] || (a[0] === b[0] && (a[1] > b[1] || (a[1] === b[1] && a[2] > b[2])));
    if (gt) problems.push("Lower bound must not be above the upper bound.");
  }
  if (!Number.isInteger(form.priority) || form.priority < 0 || form.priority > otherwiseIndex) {
    problems.push(`Priority must be between 0 and ${otherwiseIndex}.`);
  }
  return problems;
}

type Definition = unknown;
const asRecord = (v: unknown): Record<string, unknown> | null =>
  v && typeof v === "object" && !Array.isArray(v) ? (v as Record<string, unknown>) : null;

/** The comparison a cohort definition encodes, in words. */
function describeDefinition(definition: Definition): string | null {
  const d = asRecord(definition);
  if (!d) return null;
  const label = (key: string, v: string) =>
    ({
      jp_ver_ge: `≥ ${v}`,
      jp_ver_gt: `> ${v}`,
      jp_ver_le: `≤ ${v}`,
      jp_ver_lt: `< ${v}`,
      str_ge: `≥ ${v} (text)`,
      str_gt: `> ${v} (text)`,
      str_le: `≤ ${v} (text)`,
      str_lt: `< ${v} (text)`,
    })[key] ?? null;
  const one = (node: unknown): string | null => {
    const n = asRecord(node);
    if (!n) return null;
    const [key] = Object.keys(n);
    const args = n[key];
    const value = Array.isArray(args) ? args.find((a) => typeof a === "string") : undefined;
    return typeof value === "string" ? label(key, value) : null;
  };
  if (Array.isArray(d.and)) {
    const parts = d.and.map(one).filter(Boolean);
    return parts.length > 0 ? parts.join(" and ") : null;
  }
  return one(d);
}

/** A closed range created by the range API: exactly `≥ lower and ≤ upper`. */
function isClosedRange(definition: Definition): boolean {
  const and = asRecord(definition)?.and;
  const has = (key: string) => Array.isArray(and) && and.some((n) => asRecord(n)?.[key] !== undefined);
  return Array.isArray(and) && and.length === 2 && has("jp_ver_ge") && has("jp_ver_le");
}

export default function CohortsPage() {
  const { token, org, app } = useAppContext();
  const permissions = usePagePermissions(PAGE_AUTHZ);
  const { toast } = useToast();
  const canManageCohorts =
    permissions.can("update_cohort") ||
    permissions.can("create_cohort_group") ||
    permissions.can("update_cohort_group");

  // State
  const [dimensions, setDimensions] = useState<Dimension[]>([]);
  const [selectedDimension, setSelectedDimension] = useState<string>("");
  const [cohortSchema, setCohortSchema] = useState<CohortSchema | null>(null);
  const [releases, setReleases] = useState<Record<string, Release[]>>({});
  const [loading, setLoading] = useState(false);
  const [activeTab, setActiveTab] = useState("checkpoints");

  // Forms
  const [showCheckpointForm, setShowCheckpointForm] = useState(false);
  const [checkpointForm, setCheckpointForm] = useState<CheckpointForm>({
    name: "",
    value: "",
    valueType: "semver",
    includeValue: true,
  });

  const [showGroupForm, setShowGroupForm] = useState(false);
  const [groupForm, setGroupForm] = useState<GroupForm>({
    name: "",
    members: [],
    newMember: "",
  });

  const [showRangeForm, setShowRangeForm] = useState(false);
  const [rangeForm, setRangeForm] = useState<RangeForm>({ name: "", lower: "", upper: "", priority: 0 });

  const [priorityMap, setPriorityMap] = useState<Record<string, number>>({});
  const [creating, setCreating] = useState<"checkpoint" | "group" | "priority" | "range" | null>(null);

  // Load dimensions on mount
  useEffect(() => {
    if (token && org && app) {
      loadDimensions();
    }
  }, [token, org, app]);

  // Load cohort schema when dimension is selected
  useEffect(() => {
    if (selectedDimension) {
      loadCohortSchema();
      loadPriority();
    } else {
      setCohortSchema(null);
      setReleases({});
    }
  }, [selectedDimension]);

  // Load releases when schema changes
  useEffect(() => {
    if (cohortSchema && selectedDimension) {
      loadReleasesForCohorts();
    }
  }, [cohortSchema, selectedDimension]);

  const loadDimensions = async () => {
    try {
      const result = await apiFetch<any>("/organisations/applications/dimension/list", {}, { token, org, app });
      const allDimensions = (result.data as Dimension[]) || [];
      const cohortDimensions = allDimensions.filter((d) => d.dimension_type === "cohort");
      setDimensions(cohortDimensions);

      if (cohortDimensions.length > 0 && !selectedDimension) {
        setSelectedDimension(cohortDimensions[0].dimension);
      }
    } catch (error) {
      console.error("Failed to load dimensions:", error);
      toast({
        title: "Error",
        description: "Failed to load dimensions",
        variant: "destructive",
      });
    }
  };

  const loadCohortSchema = async () => {
    if (!selectedDimension) return;

    setLoading(true);
    try {
      const result = await apiFetch<CohortSchema>(
        `/organisations/applications/dimension/${encodeURIComponent(selectedDimension)}/cohort`,
        {},
        { token, org, app }
      );
      setCohortSchema(result);
    } catch (error) {
      console.error("Failed to load cohort schema:", error);
      toast({
        title: "Error",
        description: "Failed to load cohort schema",
        variant: "destructive",
      });
    }
    setLoading(false);
  };

  const loadPriority = async () => {
    if (!selectedDimension) return;

    try {
      const result = await apiFetch<{ priority_map: Record<string, number> }>(
        `/organisations/applications/dimension/${encodeURIComponent(selectedDimension)}/cohort/group/priority`,
        {},
        { token, org, app }
      );
      setPriorityMap(result.priority_map);
    } catch (error) {
      console.error("Failed to load priority:", error);
    }
  };

  const loadReleasesForCohorts = async () => {
    if (!cohortSchema || !selectedDimension) return;

    const releasePromises = cohortSchema.enum.map(async (cohort) => {
      try {
        const result = await apiFetch<{ data: Release[] }>(
          "/releases/list",
          {
            headers: {
              "x-dimension": `${selectedDimension}=${cohort}`,
            },
            query: {
              all: true,
            },
          },
          { token, org, app }
        );
        return { cohort, releases: result.data || [] };
      } catch (error) {
        console.error(`Failed to load releases for cohort ${cohort}:`, error);
        return { cohort, releases: [] };
      }
    });

    const results = await Promise.all(releasePromises);
    const releaseMap: Record<string, Release[]> = {};
    results.forEach(({ cohort, releases: cohortReleases }) => {
      releaseMap[cohort] = cohortReleases;
    });
    setReleases(releaseMap);
  };

  const handleCreateCheckpoint = async () => {
    if (!selectedDimension) return;

    setCreating("checkpoint");
    try {
      // Determine comparator based on form input
      let comparator: string;
      if (checkpointForm.valueType === "semver") {
        comparator = checkpointForm.includeValue ? "semver_ge" : "semver_gt";
      } else {
        comparator = checkpointForm.includeValue ? "str_ge" : "str_gt";
      }

      await apiFetch(
        `/organisations/applications/dimension/${encodeURIComponent(selectedDimension)}/cohort/checkpoint`,
        {
          method: "POST",
          body: {
            name: checkpointForm.name,
            value: checkpointForm.value,
            comparator,
          },
        },
        { token, org, app }
      );

      setCheckpointForm({ name: "", value: "", valueType: "semver", includeValue: true });
      setShowCheckpointForm(false);
      loadCohortSchema();
      toast({
        title: "Checkpoint created",
        description: `Successfully created checkpoint "${checkpointForm.name}"`,
      });
    } catch (error: any) {
      const frozen = frozenWriteNotice(error);
      if (frozen) {
        toast({ ...frozen, variant: "destructive" });
        return;
      }
      const saved = cacheWarning(error);
      if (saved) {
        setCheckpointForm({ name: "", value: "", valueType: "semver", includeValue: true });
        setShowCheckpointForm(false);
        loadCohortSchema();
        toast({ ...saved, variant: "destructive" });
        return;
      }
      console.error("Failed to create checkpoint:", error);
      toast({
        title: "Error",
        description: error?.message || error?.error || "Failed to create checkpoint. Please try again.",
        variant: "destructive",
      });
    } finally {
      setCreating(null);
    }
  };

  const handleCreateRange = async () => {
    if (!selectedDimension) return;
    setCreating("range");
    try {
      await apiFetch(
        `/organisations/applications/dimension/${encodeURIComponent(selectedDimension)}/cohort/range`,
        {
          method: "POST",
          body: {
            name: rangeForm.name.trim(),
            lower: rangeForm.lower.trim(),
            upper: rangeForm.upper.trim(),
            priority: rangeForm.priority,
          },
          showErrorToast: false,
        },
        { token, org, app }
      );
      setRangeForm({ name: "", lower: "", upper: "", priority: 0 });
      setShowRangeForm(false);
      loadCohortSchema();
      toast({
        title: "Range created",
        description: `“${rangeForm.name.trim()}” covers ${rangeForm.lower.trim()} to ${rangeForm.upper.trim()}, inclusive. Existing checkpoints are unchanged.`,
      });
    } catch (error: any) {
      const frozen = frozenWriteNotice(error);
      if (frozen) {
        toast({ ...frozen, variant: "destructive" });
        return;
      }
      const saved = cacheWarning(error);
      if (saved) {
        setRangeForm({ name: "", lower: "", upper: "", priority: 0 });
        setShowRangeForm(false);
        loadCohortSchema();
        toast({ ...saved, variant: "destructive" });
        return;
      }
      console.error("Failed to create range:", error);
      toast({
        title: "Could not create the range",
        description: error?.message || "The server refused the range.",
        variant: "destructive",
      });
    } finally {
      setCreating(null);
    }
  };

  const handleCreateGroup = async () => {
    if (!selectedDimension) return;

    setCreating("group");
    try {
      await apiFetch(
        `/organisations/applications/dimension/${encodeURIComponent(selectedDimension)}/cohort/group`,
        {
          method: "POST",
          body: {
            name: groupForm.name,
            members: groupForm.members,
          },
          showErrorToast: false,
        },
        { token, org, app }
      );

      setGroupForm({ name: "", members: [], newMember: "" });
      setShowGroupForm(false);
      loadCohortSchema();
      loadPriority();
      toast({
        title: "Group created",
        description: `Successfully created group "${groupForm.name}" with ${groupForm.members.length} members`,
      });
    } catch (error) {
      const frozen = frozenWriteNotice(error);
      if (frozen) {
        toast({ ...frozen, variant: "destructive" });
        return;
      }
      console.error("Failed to create group:", error);
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to create group. Please try again.",
        variant: "destructive",
      });
    } finally {
      setCreating(null);
    }
  };

  const handleUpdatePriority = async () => {
    if (!selectedDimension) return;

    setCreating("priority");
    try {
      await apiFetch(
        `/organisations/applications/dimension/${encodeURIComponent(selectedDimension)}/cohort/group/priority`,
        {
          method: "PUT",
          body: { priority_map: priorityMap },
          showErrorToast: false,
        },
        { token, org, app }
      );
      loadPriority();
      toast({
        title: "Priorities updated",
        description: "Successfully updated cohort group priorities",
      });
    } catch (error) {
      const frozen = frozenWriteNotice(error);
      if (frozen) {
        toast({ ...frozen, variant: "destructive" });
        return;
      }
      console.error("Failed to update priority:", error);
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to update priorities. Please try again.",
        variant: "destructive",
      });
    } finally {
      setCreating(null);
    }
  };

  const addMemberToGroup = () => {
    if (groupForm.newMember.trim()) {
      setGroupForm({
        ...groupForm,
        members: [...groupForm.members, groupForm.newMember.trim()],
        newMember: "",
      });
    }
  };

  const removeMemberFromGroup = (index: number) => {
    setGroupForm({
      ...groupForm,
      members: groupForm.members.filter((_, i) => i !== index),
    });
  };

  const getCheckpointCohorts = () => {
    if (!cohortSchema) return [];
    return cohortSchema.enum.filter((cohortName) => {
      const definition = cohortSchema.definitions[cohortName];
      return definition && !Object.keys(definition).includes("in") && cohortName !== "otherwise";
    });
  };

  const getGroupCohorts = () => {
    if (!cohortSchema) return [];
    return cohortSchema.enum.filter((cohortName) => {
      const definition = cohortSchema.definitions[cohortName];
      return definition && Object.keys(definition).includes("in");
    });
  };

  if (dimensions.length === 0) {
    return (
      <div className="p-6">
        <div className="text-center py-12">
          <Users className="h-12 w-12 mx-auto mb-4 opacity-50" />
          <h2 className="text-xl font-semibold mb-2">No Cohort Dimensions Found</h2>
          <p className="text-muted-foreground mb-4">Create a cohort dimension first to start managing user segments.</p>
          <Button
            onClick={() => {
              window.location.href = `/dashboard/${encodeURIComponent(org || "")}/${encodeURIComponent(app || "")}/dimensions`;
            }}
          >
            Open Dimensions
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-3xl font-bold font-[family-name:var(--font-space-grotesk)] text-balance">
            Cohort Management
          </h1>
          <p className="text-muted-foreground mt-2">Manage user segmentation with checkpoints and groups</p>
        </div>
      </div>

      {/* Dimension Selector */}
      <Card className="mb-6">
        <CardHeader>
          <CardTitle>Select Cohort Dimension</CardTitle>
          <CardDescription>Choose which cohort dimension to manage</CardDescription>
        </CardHeader>
        <CardContent>
          <Select value={selectedDimension} onValueChange={setSelectedDimension}>
            <SelectTrigger className="w-full max-w-md">
              <SelectValue placeholder="Select a cohort dimension" />
            </SelectTrigger>
            <SelectContent>
              {dimensions.map((dim) => (
                <SelectItem key={dim.dimension} value={dim.dimension}>
                  <div className="flex items-center gap-2">
                    <Users className="h-4 w-4" />
                    <span>{dim.dimension}</span>
                    {dim.depends_on && (
                      <Badge variant="outline" className="text-xs">
                        → {dim.depends_on}
                      </Badge>
                    )}
                  </div>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </CardContent>
      </Card>

      {selectedDimension && (
        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="checkpoints">Checkpoints</TabsTrigger>
            <TabsTrigger value="groups">Groups</TabsTrigger>
          </TabsList>

          <TabsContent value="checkpoints" className="space-y-6">
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle>Version Checkpoints</CardTitle>
                    <CardDescription>Segment users based on version comparisons</CardDescription>
                  </div>
                  {canManageCohorts && (
                    <div className="flex gap-2">
                      <Button
                        variant="outline"
                        onClick={() => {
                          setRangeForm({ name: "", lower: "", upper: "", priority: 0 });
                          setShowRangeForm(true);
                        }}
                        title="A closed version range that does not change existing checkpoints"
                      >
                        <ArrowLeftRight className="h-4 w-4 mr-2" />
                        Add Range
                      </Button>
                      <Button onClick={() => setShowCheckpointForm(true)}>
                        <Plus className="h-4 w-4 mr-2" />
                        Add Checkpoint
                      </Button>
                    </div>
                  )}
                </div>
              </CardHeader>
              <CardContent>
                {loading ? (
                  <div className="flex items-center justify-center py-8">
                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
                  </div>
                ) : (
                  <CheckpointTimeline
                    checkpoints={getCheckpointCohorts()}
                    definitions={cohortSchema?.definitions ?? {}}
                    releases={releases}
                    onAddCheckpoint={() => setShowCheckpointForm(true)}
                    canManageCohorts={canManageCohorts}
                    org={org}
                    app={app}
                  />
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="groups" className="space-y-6">
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle>User Groups</CardTitle>
                    <CardDescription>Segment users based on explicit membership lists</CardDescription>
                  </div>
                  {canManageCohorts && (
                    <Button onClick={() => setShowGroupForm(true)}>
                      <Plus className="h-4 w-4 mr-2" />
                      Add Group
                    </Button>
                  )}
                </div>
              </CardHeader>
              <CardContent>
                {loading ? (
                  <div className="flex items-center justify-center py-8">
                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
                  </div>
                ) : (
                  <GroupAccordion
                    groups={getGroupCohorts()}
                    releases={releases}
                    priorityMap={priorityMap}
                    setPriorityMap={setPriorityMap}
                    onUpdatePriority={handleUpdatePriority}
                    updating={creating === "priority"}
                    canManageCohorts={canManageCohorts}
                    org={org}
                    app={app}
                  />
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      )}

      {/* Checkpoint Form Dialog */}
      <Dialog open={showCheckpointForm} onOpenChange={setShowCheckpointForm}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add Checkpoint</DialogTitle>
            <DialogDescription>Create a version-based checkpoint for user segmentation</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="checkpoint-name">Checkpoint Name</Label>
              <Input
                id="checkpoint-name"
                value={checkpointForm.name}
                onChange={(e) => setCheckpointForm({ ...checkpointForm, name: e.target.value })}
                placeholder="e.g., v2_1_users"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="checkpoint-value">Value</Label>
              <Input
                id="checkpoint-value"
                value={checkpointForm.value}
                onChange={(e) => setCheckpointForm({ ...checkpointForm, value: e.target.value })}
                placeholder="e.g., 2.1.0"
              />
            </div>

            <div className="space-y-2">
              <Label>Value Type</Label>
              <Select
                value={checkpointForm.valueType}
                onValueChange={(value: "semver" | "string") =>
                  setCheckpointForm({ ...checkpointForm, valueType: value })
                }
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="semver">Semantic Version</SelectItem>
                  <SelectItem value="string">String</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Include Value</Label>
              <Select
                value={checkpointForm.includeValue ? "include" : "exclude"}
                onValueChange={(value) => setCheckpointForm({ ...checkpointForm, includeValue: value === "include" })}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="include">Include this value</SelectItem>
                  <SelectItem value="exclude">Exclude this value (will go in previous checkpoint)</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="flex justify-end gap-2 pt-4">
              <Button variant="outline" onClick={() => setShowCheckpointForm(false)}>
                Cancel
              </Button>
              <Button
                onClick={handleCreateCheckpoint}
                disabled={!checkpointForm.name || !checkpointForm.value || creating === "checkpoint"}
              >
                {creating === "checkpoint" ? "Creating..." : "Create Checkpoint"}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Range Form Dialog */}
      <Dialog open={showRangeForm} onOpenChange={setShowRangeForm}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add Range</DialogTitle>
            <DialogDescription>
              A closed version range, inclusive at both ends. Unlike a checkpoint, adding a range never closes or
              rewrites another band.
            </DialogDescription>
          </DialogHeader>
          {(() => {
            const names = cohortSchema?.enum ?? [];
            const otherwiseIndex = names.indexOf("otherwise") === -1 ? names.length : names.indexOf("otherwise");
            const problems = rangeProblems(rangeForm, names, otherwiseIndex);
            // Existing bands that share a version with this range. The server allows it; the first match wins.
            const bothVersions = STABLE_SEMVER.test(rangeForm.lower) && STABLE_SEMVER.test(rangeForm.upper);
            const overlapping = bothVersions
              ? overlappingCohorts(
                  names,
                  cohortSchema?.definitions ?? {},
                  rangeForm.lower,
                  rangeForm.upper,
                  rangeForm.priority
                )
              : [];
            return (
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="range-name">Range Name</Label>
                  <Input
                    id="range-name"
                    value={rangeForm.name}
                    onChange={(e) => setRangeForm({ ...rangeForm, name: e.target.value })}
                    placeholder="e.g., v2_only"
                  />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="range-lower">From (inclusive)</Label>
                    <Input
                      id="range-lower"
                      value={rangeForm.lower}
                      onChange={(e) => setRangeForm({ ...rangeForm, lower: e.target.value })}
                      placeholder="2.0.0"
                      className="font-mono"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="range-upper">To (inclusive)</Label>
                    <Input
                      id="range-upper"
                      value={rangeForm.upper}
                      onChange={(e) => setRangeForm({ ...rangeForm, upper: e.target.value })}
                      placeholder="2.9.9"
                      className="font-mono"
                    />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="range-priority">Priority (0 is checked first)</Label>
                  <Input
                    id="range-priority"
                    type="number"
                    min={0}
                    max={otherwiseIndex}
                    value={rangeForm.priority}
                    onChange={(e) => setRangeForm({ ...rangeForm, priority: Number(e.target.value) })}
                    className="w-28 font-mono"
                  />
                  <p className="text-xs text-muted-foreground">
                    Where the range sits in the evaluation order, from 0 to {otherwiseIndex}. When ranges overlap, the
                    first match wins.
                  </p>
                </div>
                <p className="text-xs text-muted-foreground">
                  Stable versions only (major.minor.patch). Pre-release and build suffixes are refused because the
                  version comparator does not order them correctly.
                </p>
                {overlapping.length > 0 && (
                  <div
                    role="alert"
                    className="space-y-1 rounded-md border border-amber-500/50 bg-amber-500/5 p-3 text-xs text-amber-900 dark:text-amber-200"
                  >
                    <p className="font-medium">
                      This range overlaps {overlapping.length} existing cohort{overlapping.length === 1 ? "" : "s"}.
                    </p>
                    <ul className="list-disc space-y-0.5 pl-5">
                      {overlapping.map((o) => (
                        <li key={o.name}>
                          <span className="font-mono">{o.name}</span>
                          {describeDefinition(cohortSchema?.definitions?.[o.name]) && (
                            <> ({describeDefinition(cohortSchema?.definitions?.[o.name])})</>
                          )}
                          :{" "}
                          {o.takenByNewRange
                            ? `at priority ${rangeForm.priority} the new range is checked first, so devices in the overlap stop matching “${o.name}” on their next check and lose any release targeted at it.`
                            : `“${o.name}” is checked first and keeps the devices in the overlap.`}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
                {problems.length > 0 && (rangeForm.name || rangeForm.lower || rangeForm.upper) && (
                  <ul className="list-disc space-y-0.5 pl-5 text-xs text-amber-700 dark:text-amber-300">
                    {problems.map((p) => (
                      <li key={p}>{p}</li>
                    ))}
                  </ul>
                )}
                <div className="flex justify-end gap-2 pt-4">
                  <Button variant="outline" onClick={() => setShowRangeForm(false)}>
                    Cancel
                  </Button>
                  <Button onClick={handleCreateRange} disabled={problems.length > 0 || creating === "range"}>
                    {creating === "range" ? "Creating..." : "Create Range"}
                  </Button>
                </div>
              </div>
            );
          })()}
        </DialogContent>
      </Dialog>

      {/* Group Form Dialog */}
      <Dialog open={showGroupForm} onOpenChange={setShowGroupForm}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add Group</DialogTitle>
            <DialogDescription>Create a user group for explicit membership segmentation</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="group-name">Group Name</Label>
              <Input
                id="group-name"
                value={groupForm.name}
                onChange={(e) => setGroupForm({ ...groupForm, name: e.target.value })}
                placeholder="e.g., beta_testers"
              />
            </div>

            <div className="space-y-2">
              <Label>Members</Label>
              <div className="flex gap-2">
                <Input
                  value={groupForm.newMember}
                  onChange={(e) => setGroupForm({ ...groupForm, newMember: e.target.value })}
                  placeholder="Add member ID"
                  onKeyPress={(e) => e.key === "Enter" && addMemberToGroup()}
                />
                <Button type="button" onClick={addMemberToGroup} disabled={!groupForm.newMember.trim()}>
                  Add
                </Button>
              </div>
              <div className="flex flex-wrap gap-2">
                {groupForm.members.map((member, index) => (
                  <Badge key={index} variant="outline" className="flex items-center gap-1">
                    {member}
                    <button onClick={() => removeMemberFromGroup(index)}>
                      <X className="h-3 w-3" />
                    </button>
                  </Badge>
                ))}
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-4">
              <Button variant="outline" onClick={() => setShowGroupForm(false)}>
                Cancel
              </Button>
              <Button
                onClick={handleCreateGroup}
                disabled={!groupForm.name || groupForm.members.length === 0 || creating === "group"}
              >
                {creating === "group" ? "Creating..." : "Create Group"}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// Checkpoint Timeline Component
interface CheckpointTimelineProps {
  checkpoints: string[];
  definitions: Record<string, unknown>;
  releases: Record<string, Release[]>;
  onAddCheckpoint: () => void;
  canManageCohorts: boolean;
  org: string | null;
  app: string | null;
}

function CheckpointTimeline({
  checkpoints,
  definitions,
  releases,
  onAddCheckpoint,
  canManageCohorts,
  org,
  app,
}: CheckpointTimelineProps) {
  if (checkpoints.length === 0) {
    return (
      <div className="text-center py-8">
        <Target className="h-8 w-8 mx-auto mb-2 opacity-50" />
        <p className="text-muted-foreground mb-4">No checkpoints created yet</p>
        <p className="text-xs text-muted-foreground mb-4">Checkpoints segment users based on version comparisons</p>
        {canManageCohorts && (
          <Button onClick={onAddCheckpoint} variant="outline">
            <Plus className="h-4 w-4 mr-2" />
            Create First Checkpoint
          </Button>
        )}
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Info box */}
      <div className="p-3 bg-muted rounded border-l-4 border-primary">
        <p className="text-sm text-muted-foreground">
          <strong>Timeline Order:</strong> Checkpoints and ranges are evaluated in the order shown below. Users are
          assigned to the first matching entry from top to bottom. Adding a checkpoint closes the previous checkpoint
          band; adding a range changes nothing else.
        </p>
      </div>

      {/* Add button at the top */}
      {canManageCohorts && (
        <div className="relative flex items-start mb-6">
          <Button
            variant="ghost"
            size="sm"
            onClick={onAddCheckpoint}
            className="relative z-10 w-8 h-8 p-0 border-2 border-dashed border-primary rounded-full hover:bg-primary hover:text-primary-foreground"
          >
            <Plus className="h-4 w-4" />
          </Button>
          <div className="ml-4">
            <span className="text-sm text-muted-foreground">Add new checkpoint</span>
            <p className="text-xs text-muted-foreground">New checkpoints are added at the top (highest priority)</p>
          </div>
        </div>
      )}

      <div className="relative">
        {/* Vertical line */}
        <div className="absolute left-4 top-0 bottom-0 w-0.5 bg-border"></div>

        <div className="space-y-6">
          {checkpoints.map((checkpoint, index) => (
            <div key={checkpoint} className="relative flex items-start">
              {/* Dot with order number */}
              <div className="relative z-10 flex items-center justify-center w-8 h-8 bg-primary text-primary-foreground text-xs font-bold rounded-full">
                {index + 1}
              </div>

              {/* Content */}
              <div className="ml-6 flex-1">
                <div className="flex flex-wrap items-center gap-2 mb-2">
                  <h4 className="font-semibold">{checkpoint}</h4>
                  <Badge variant="secondary">{isClosedRange(definitions[checkpoint]) ? "Range" : "Checkpoint"}</Badge>
                  {describeDefinition(definitions[checkpoint]) && (
                    <span className="font-mono text-xs text-muted-foreground">
                      {describeDefinition(definitions[checkpoint])}
                    </span>
                  )}
                  <span className="text-xs text-muted-foreground">(Checkpoint position {index}, excluding groups)</span>
                </div>

                {/* Releases */}
                <div className="space-y-2">
                  {releases[checkpoint]?.map((release) => (
                    <Link
                      href={`/dashboard/${encodeURIComponent(org || "")}/${encodeURIComponent(app || "")}/releases/${release.id}`}
                      key={release.id}
                      className="flex items-center gap-2 p-2 bg-muted/50 border rounded"
                    >
                      <GitBranch className="h-4 w-4" />
                      <span className="text-sm font-mono">{release.id}</span>
                      <Badge variant={release.experiment.status === "CONCLUDED" ? "default" : "secondary"}>
                        {release.experiment.status}
                      </Badge>
                      {release.experiment.traffic_percentage !== undefined && (
                        <Badge variant="outline">{release.experiment.traffic_percentage}%</Badge>
                      )}
                    </Link>
                  ))}
                  {(!releases[checkpoint] || releases[checkpoint].length === 0) && (
                    <p className="text-xs text-muted-foreground italic">No releases for this checkpoint</p>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// Group Accordion Component
interface GroupAccordionProps {
  groups: string[];
  releases: Record<string, Release[]>;
  priorityMap: Record<string, number>;
  setPriorityMap: (map: Record<string, number>) => void;
  onUpdatePriority: () => void;
  updating: boolean;
  canManageCohorts: boolean;
  org: string | null;
  app: string | null;
}

function GroupAccordion({
  groups,
  releases,
  priorityMap,
  setPriorityMap,
  onUpdatePriority,
  updating,
  canManageCohorts,
  org,
  app,
}: GroupAccordionProps) {
  const [draggedGroup, setDraggedGroup] = useState<string | null>(null);
  const [expandedGroups, setExpandedGroups] = useState<Set<string>>(new Set());

  if (groups.length === 0) {
    return (
      <div className="text-center py-8">
        <Users className="h-8 w-8 mx-auto mb-2 opacity-50" />
        <p className="text-muted-foreground mb-4">No groups created yet</p>
        <p className="text-xs text-muted-foreground">
          Groups allow you to segment users based on explicit membership lists
        </p>
      </div>
    );
  }

  // Sort groups by priority for display
  const sortedGroups = [...groups].sort((a, b) => {
    const priorityA = priorityMap[a] ?? 0;
    const priorityB = priorityMap[b] ?? 0;
    return priorityA - priorityB;
  });

  const handleDragStart = (e: React.DragEvent, group: string) => {
    setDraggedGroup(group);
    e.dataTransfer.effectAllowed = "move";
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = "move";
  };

  const handleDrop = (e: React.DragEvent, targetGroup: string) => {
    e.preventDefault();
    if (!draggedGroup || draggedGroup === targetGroup) return;

    const draggedIndex = sortedGroups.indexOf(draggedGroup);
    const targetIndex = sortedGroups.indexOf(targetGroup);

    // Create new priority mapping based on new order
    const newOrder = [...sortedGroups];
    newOrder.splice(draggedIndex, 1);
    newOrder.splice(targetIndex, 0, draggedGroup);

    const newPriorityMap: Record<string, number> = {};
    newOrder.forEach((group, index) => {
      newPriorityMap[group] = index;
    });

    setPriorityMap(newPriorityMap);
    setDraggedGroup(null);
  };

  const toggleGroupExpansion = (group: string) => {
    const newExpanded = new Set(expandedGroups);
    if (newExpanded.has(group)) {
      newExpanded.delete(group);
    } else {
      newExpanded.add(group);
    }
    setExpandedGroups(newExpanded);
  };

  return (
    <div className="space-y-4">
      {/* Header with priority info */}
      {canManageCohorts && (
        <div className="flex items-center justify-between p-4 bg-muted/50 border rounded-lg">
          <div>
            <h4 className="font-semibold">Group Priority Management</h4>
            <p className="text-sm text-muted-foreground">
              Drag and drop groups to reorder priorities. Groups at the top are evaluated first.
            </p>
          </div>
          <Button onClick={onUpdatePriority} disabled={updating} variant="default">
            {updating ? "Updating..." : "Save Order"}
          </Button>
        </div>
      )}

      {/* Draggable group list */}
      <div className="space-y-3">
        {sortedGroups.map((group, index) => {
          const isExpanded = expandedGroups.has(group);
          const isDragging = draggedGroup === group;

          return (
            <div
              key={group}
              className={`border rounded-lg transition-all duration-200 ${
                isDragging ? "opacity-50 scale-98 border-primary" : "hover:border-primary/50"
              }`}
              draggable={canManageCohorts}
              onDragStart={(e) => handleDragStart(e, group)}
              onDragOver={handleDragOver}
              onDrop={(e) => handleDrop(e, group)}
            >
              {/* Group header */}
              <div className="flex items-center p-4 cursor-move bg-muted/30 rounded-t-lg hover:bg-muted/50 transition-colors">
                <div className="flex items-center gap-3 flex-1">
                  {/* Drag handle */}
                  <div className="flex flex-col gap-0.5 text-muted-foreground cursor-grab active:cursor-grabbing">
                    <div className="w-1 h-1 bg-current rounded-full"></div>
                    <div className="w-1 h-1 bg-current rounded-full"></div>
                    <div className="w-1 h-1 bg-current rounded-full"></div>
                    <div className="w-1 h-1 bg-current rounded-full"></div>
                    <div className="w-1 h-1 bg-current rounded-full"></div>
                    <div className="w-1 h-1 bg-current rounded-full"></div>
                  </div>

                  {/* Priority number */}
                  <div className="flex items-center justify-center w-8 h-8 bg-primary text-primary-foreground text-sm font-bold rounded-full">
                    {index + 1}
                  </div>

                  {/* Group info */}
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <span className="font-mono font-medium">{group}</span>
                      <Badge variant="secondary">Group</Badge>
                      <Badge variant="outline" className="text-xs">
                        Priority {priorityMap[group] ?? 0}
                      </Badge>
                    </div>
                    <p className="text-sm text-muted-foreground mt-1">
                      {releases[group]?.length || 0} release{(releases[group]?.length || 0) !== 1 ? "s" : ""}
                    </p>
                  </div>

                  {/* Expand button */}
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={(e) => {
                      e.stopPropagation();
                      toggleGroupExpansion(group);
                    }}
                    className="p-2"
                  >
                    <svg
                      className={`w-4 h-4 transition-transform ${isExpanded ? "rotate-180" : ""}`}
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                    </svg>
                  </Button>
                </div>
              </div>

              {/* Releases (expandable) */}
              {isExpanded && (
                <div className="p-4 bg-card border-t rounded-b-lg">
                  <div className="space-y-2">
                    {releases[group]?.map((release) => (
                      <Link
                        href={`/dashboard/${encodeURIComponent(org || "")}/${encodeURIComponent(app || "")}/releases/${release.id}`}
                        key={release.id}
                        className="flex items-center gap-3 p-3 bg-muted/50 border rounded-lg hover:bg-muted/70 transition-colors"
                      >
                        <GitBranch className="h-4 w-4 text-muted-foreground" />
                        <span className="text-sm font-mono">{release.id}</span>
                        <Badge variant={release.experiment.status === "CONCLUDED" ? "default" : "secondary"}>
                          {release.experiment.status}
                        </Badge>
                        {release.experiment.traffic_percentage !== undefined && (
                          <Badge variant="outline">{release.experiment.traffic_percentage}%</Badge>
                        )}
                        <span className="text-xs text-muted-foreground ml-auto">
                          {new Date(release.created_at).toLocaleDateString()}
                        </span>
                      </Link>
                    ))}
                    {(!releases[group] || releases[group].length === 0) && (
                      <div className="text-center py-6 text-muted-foreground">
                        <div className="w-12 h-12 mx-auto mb-3 bg-muted rounded-full flex items-center justify-center">
                          <GitBranch className="h-6 w-6" />
                        </div>
                        <p className="text-sm">No releases for this group yet</p>
                        <p className="text-xs opacity-70 mt-1">Create a release targeting this group</p>
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
