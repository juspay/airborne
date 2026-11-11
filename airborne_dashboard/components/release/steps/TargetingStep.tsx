"use client";

import React, { useState, useEffect, useCallback, useRef } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Target, Lock } from "lucide-react";
import Link from "next/link";
import { useReleaseForm } from "../ReleaseFormContext";
import { useAppContext } from "@/providers/app-context";
import { apiFetch } from "@/lib/api";
import { Dimension } from "@/types/release";
import { useOverview } from "@/lib/control-center/hooks";
import { localeExceptions, locateApp } from "@/lib/control-center/format";
import { LocaleExceptionsNotice } from "@/components/control-center/locale-notice";

export function TargetingStep() {
  const { token, org, app } = useAppContext();
  const {
    mode,
    hasExistingReleases,
    targetingRequired,
    targetingRules,
    addTargetingRule,
    removeTargetingRule,
    updateTargetingRule,
    setTargetingRules,
  } = useReleaseForm();

  const prefilled = useRef(false);
  const [dimensions, setDimensions] = useState<Dimension[]>([]);
  const [cohorts, setCohorts] = useState<Record<string, string[]>>({});
  // Live locale-targeted releases that a general release would leave behind (Superposition specificity).
  const { overview } = useOverview();
  const appStatus = locateApp(overview, org ?? "", app ?? "").app;
  const proposed = Object.fromEntries(
    targetingRules.filter((r) => r.dimension && r.values).map((r) => [r.dimension, r.values])
  );
  const exceptions = localeExceptions(appStatus, proposed);

  useEffect(() => {
    if (!targetingRules.length) return;
    targetingRules.forEach((rule) => {
      const dim = dimensions.find((d) => d.dimension === rule.dimension);
      if (dim?.dimension_type === "cohort" && !cohorts[rule.dimension]) {
        loadCohortsForDimension(rule.dimension);
      }
    });
  }, [dimensions]);

  useEffect(() => {
    const fetchDimensions = async () => {
      try {
        const { data }: { data: Dimension[] } = await apiFetch(
          `/organisations/applications/dimension/list?all=true`,
          { method: "GET" },
          { token, org, app }
        );
        setDimensions(data.filter((d) => d.dimension !== "variantIds"));
        const version = data.find((d) => d.dimension === "version_cohort" && d.dimension_type === "cohort");
        if (mode === "create" && !hasExistingReleases && !prefilled.current && version) {
          prefilled.current = true;
          const cohort = await apiFetch<{ enum: string[] }>(
            `/organisations/applications/dimension/${version.dimension}/cohort`,
            { method: "GET" },
            { token, org, app }
          );
          const choices = (cohort.enum || []).filter((value) => value !== "otherwise");
          setCohorts((prev) => ({ ...prev, [version.dimension]: cohort.enum || [] }));
          setTargetingRules((rules) =>
            rules.length
              ? rules
              : [{ dimension: version.dimension, operator: "equals", values: choices.length === 1 ? choices[0] : "" }]
          );
        }
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
        const response = await apiFetch<{ enum: string[] }>(
          `/organisations/applications/dimension/${dimensionName}/cohort`,
          { method: "GET" },
          { token, org, app }
        );
        setCohorts((prev) => ({ ...prev, [dimensionName]: response?.enum || [] }));
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

          {!isEditMode && dimensions.length === 0 && appStatus?.approval_required && (
            <p role="status" className="text-sm">
              No dimensions yet, and this application requires approval, which freezes dimension and cohort changes
              (they cannot be raised as requests). An organisation owner or admin has to turn approval off to create
              them, then back on.
            </p>
          )}
          {!isEditMode && dimensions.length === 0 && !appStatus?.approval_required && (
            <p role="status" className="text-sm">
              No dimensions yet.{" "}
              <Link
                className="underline"
                href={`/dashboard/${encodeURIComponent(org || "")}/${encodeURIComponent(app || "")}/dimensions`}
              >
                Open Dimensions
              </Link>{" "}
              to create app_version (standard) and version_cohort (cohort depending on app_version). Then open Cohorts
              to add a compatible version range, then return here.
            </p>
          )}
          <p className="text-sm text-muted-foreground">
            Review the version range before creating. Ramp accepts up to 50% because Superposition retains a control
            variant; conclude with the experimental variant to serve all matching devices.
          </p>
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h4 className="font-medium">Targeting Rules</h4>
                <p className="text-sm text-muted-foreground">Add rules to target specific user segments</p>
              </div>
              {!isEditMode && (
                <Button variant="outline" onClick={addTargetingRule}>
                  Add Rule
                </Button>
              )}
            </div>

            {targetingRules.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                <Target className="mx-auto h-8 w-8 mb-2" />
                {targetingRequired ? (
                  <>
                    <p className="text-sm font-medium text-foreground">
                      Add a targeting rule to continue. This application serves strictly, so a release needs one,
                      including the first.
                    </p>
                    <p className="mt-1 text-xs">
                      Select a compatible version cohort. Creation starts at zero traffic; ramp, then conclude
                      explicitly.
                    </p>
                  </>
                ) : (
                  <>
                    <p className="text-sm">No targeting rule: this release is for every device in reach.</p>
                    <p className="mt-1 text-xs">Creation starts at zero traffic; ramp, then conclude explicitly.</p>
                  </>
                )}
              </div>
            ) : (
              <div className="space-y-4">
                {targetingRules.map((rule, idx) => {
                  const selectedDim = dimensions.find((d) => d.dimension === rule.dimension);
                  const isCohortDimension = selectedDim?.dimension_type === "cohort";
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
                              if (dim?.dimension_type === "cohort") {
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
                                    {d.dimension_type === "cohort" && (
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
                          {/* A release context is an exact match per dimension; there is no other operator.
                              Ranges and comparisons are expressed as cohort checkpoints and version ranges. */}
                          <div
                            className="flex h-10 items-center rounded-md border bg-muted/40 px-3 text-sm"
                            title="A release matches a device when every rule's value is exactly what the device sends."
                          >
                            Equals
                          </div>
                          <p className="text-xs text-muted-foreground">
                            For a version range or comparison, target a{" "}
                            <Link
                              href={`/dashboard/${encodeURIComponent(org || "")}/${encodeURIComponent(app || "")}/cohorts`}
                              className="underline"
                            >
                              cohort
                            </Link>
                            .
                          </p>
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
          {!isEditMode && (
            <LocaleExceptionsNotice
              org={org ?? ""}
              app={app ?? ""}
              exceptions={exceptions}
              verb="Making this release live"
            />
          )}
        </CardContent>
      </Card>
    </div>
  );
}

export default TargetingStep;
