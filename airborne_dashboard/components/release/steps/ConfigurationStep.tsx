"use client";

import React from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useReleaseForm } from "../ReleaseFormContext";

export function ConfigurationStep() {
  const {
    bootTimeout,
    setBootTimeout,
    releaseConfigTimeout,
    setReleaseConfigTimeout,
    configProperties,
    setConfigProperties,
  } = useReleaseForm();

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="font-[family-name:var(--font-space-grotesk)]">Release Configuration</CardTitle>
          <CardDescription>Configure timeout settings and additional properties for this release</CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-2">
              <Label htmlFor="bootTimeout">Boot Timeout (ms)</Label>
              <Input
                id="bootTimeout"
                type="number"
                value={bootTimeout}
                onChange={(e) => setBootTimeout(Number(e.target.value))}
                placeholder="4000"
                min="0"
                step="100"
              />
              <p className="text-xs text-muted-foreground">Maximum time to wait for application boot</p>
            </div>
            <div className="space-y-2">
              <Label htmlFor="releaseConfigTimeout">Release Config Timeout (ms)</Label>
              <Input
                id="releaseConfigTimeout"
                type="number"
                value={releaseConfigTimeout}
                onChange={(e) => setReleaseConfigTimeout(Number(e.target.value))}
                placeholder="4000"
                min="0"
                step="100"
              />
              <p className="text-xs text-muted-foreground">Maximum time to wait for release configuration</p>
            </div>
          </div>

          <div className="space-y-2 hidden">
            <Label htmlFor="configProperties">Additional Properties (JSON)</Label>
            <Textarea
              id="configProperties"
              rows={6}
              value={configProperties}
              onChange={(e) => setConfigProperties(e.target.value)}
              placeholder='{"feature_flags": {"new_ui": true}, "api_version": "v2"}'
              className="font-mono text-sm"
            />
            <p className="text-xs text-muted-foreground">Additional configuration properties in JSON format</p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

export default ConfigurationStep;
