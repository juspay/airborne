"use client";

import React, { useState, useEffect, useCallback } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Target, Lock } from "lucide-react";
import { useReleaseForm } from "../ReleaseFormContext";
import { useAppContext } from "@/providers/app-context";
import { apiFetch } from "@/lib/api";
import { Dimension } from "@/types/release";

export function TargetingStep() {
  const { token, org, app } = useAppContext();
  const { mode, hasExistingReleases, targetingRules, addTargetingRule, removeTargetingRule, updateTargetingRule } =
    useReleaseForm();

  const [dimensions, setDimensions] = useState<Dimension[]>([]);
  const [cohorts, setCohorts] = useState<Record<string, string[]>>({});

  useEffect(() => {
    const fetchDimensions = async () => {
      try {
        const { data }: { data: Dimension[] } = await apiFetch(
          `/organisations/applications/dimension/list`,
          { method: "GET" },
          { token, org, app }
        );
        setDimensions(data);
      } catch (err) {
        console.error("Error fetching dimensions:", err);
      }
    };
    fetchDimensions();
  }, [token, org, app]);

  const loadCohortsForDimension = useCallback(
    async (dimensionName: string) => {
      if (cohorts[dimensionName]) return;
      try {
        const response = await apiFetch<{ cohorts: string[] }>(
          `/organisations/applications/dimension/${dimensionName}/cohorts`,
          { method: "GET" },
          { token, org, app }
        );
        setCohorts((prev) => ({ ...prev, [dimensionName]: response?.cohorts || [] }));
      } catch (err) {
        console.error("Error loading cohorts:", err);
      }
    },
    [token, org, app, cohorts]
  );

  const isEditMode = mode === "edit";

  return (
    <div className="space-y-6">
      <Card>
        <CardContent className="space-y-6 pt-6">
          {isEditMode && (
            <div className="flex items-start gap-2 p-3 bg-amber-50 border border-amber-200 rounded-lg">
              <Lock className="h-4 w-4 text-amber-600 mt-0.5" />
              <div className="text-sm text-amber-800">
                <span className="font-medium">Targeting rules cannot be modified when editing a release.</span>
                <span className="block text-xs mt-1">
                  To change targeting, create a new release with the desired dimensions.
                </span>
              </div>
            </div>
          )}

          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h4 className="font-medium">Targeting Rules</h4>
                <p className="text-sm text-muted-foreground">Add rules to target specific user segments</p>
              </div>
              {hasExistingReleases && !isEditMode && (
                <Button variant="outline" onClick={addTargetingRule}>
                  Add Rule
                </Button>
              )}
            </div>

            {targetingRules.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                <Target className="mx-auto h-8 w-8 mb-2" />
                {hasExistingReleases ? (
                  <p className="text-sm">No targeting rules set - release will go to all users</p>
                ) : (
                  <p className="text-sm">You can&apos;t target your first release. It goes to all users.</p>
                )}
              </div>
            ) : (
              <div className="space-y-4">
                {targetingRules.map((rule, idx) => {
                  const selectedDim = dimensions.find((d) => d.dimension === rule.dimension);
                  const isCohortDimension = selectedDim?.type === "cohort";
                  const cohortOptions = isCohortDimension ? cohorts[rule.dimension] || [] : [];

                  return (
                    <Card key={idx} className={`p-4 ${isEditMode ? "opacity-75" : ""}`}>
                      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                        <div className="space-y-2">
                          <Label>Dimension</Label>
                          <Select
                            value={rule.dimension}
                            disabled={isEditMode}
                            onValueChange={async (v) => {
                              updateTargetingRule(idx, { dimension: v, values: "" });
                              const dim = dimensions.find((d) => d.dimension === v);
                              if (dim?.type === "cohort") {
                                await loadCohortsForDimension(v);
                              }
                            }}
                          >
                            <SelectTrigger>
                              <SelectValue placeholder="Select dimension" />
                            </SelectTrigger>
                            <SelectContent>
                              {dimensions.map((d) => (
                                <SelectItem key={d.dimension} value={d.dimension}>
                                  <div className="flex items-center gap-2">
                                    {d.dimension}
                                    {d.type === "cohort" && (
                                      <Badge variant="secondary" className="text-xs">
                                        Cohort
                                      </Badge>
                                    )}
                                  </div>
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                        <div className="space-y-2">
                          <Label>Operator</Label>
                          <Select
                            value={rule.operator}
                            disabled={isEditMode}
                            onValueChange={(v: any) => updateTargetingRule(idx, { operator: v })}
                          >
                            <SelectTrigger>
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="equals">Equals</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                        <div className="space-y-2">
                          <Label>{isCohortDimension ? "Cohort" : "Value"}</Label>
                          {isCohortDimension ? (
                            <Select
                              value={rule.values || ""}
                              disabled={isEditMode}
                              onValueChange={(v) => updateTargetingRule(idx, { values: v })}
                            >
                              <SelectTrigger>
                                <SelectValue placeholder="Select cohort" />
                              </SelectTrigger>
                              <SelectContent>
                                {cohortOptions && cohortOptions.length > 0 ? (
                                  cohortOptions.map((cohort) => (
                                    <SelectItem key={cohort} value={cohort}>
                                      {cohort}
                                    </SelectItem>
                                  ))
                                ) : (
                                  <SelectItem disabled value="__loading__">
                                    {isCohortDimension ? "No cohorts available" : "Loading cohorts..."}
                                  </SelectItem>
                                )}
                              </SelectContent>
                            </Select>
                          ) : (
                            <Input
                              value={rule.values || ""}
                              disabled={isEditMode}
                              onChange={(e) => updateTargetingRule(idx, { values: e.target.value })}
                              placeholder={selectedDim ? "Enter value" : "Select dimension first"}
                            />
                          )}
                        </div>
                        <div className="flex items-end">
                          {!isEditMode && (
                            <Button variant="outline" onClick={() => removeTargetingRule(idx)}>
                              Remove
                            </Button>
                          )}
                        </div>
                      </div>
                    </Card>
                  );
                })}
              </div>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

export default TargetingStep;
