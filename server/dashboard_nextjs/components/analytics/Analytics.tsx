"use client";
import { useAppContext } from "@/providers/app-context";
import React, { useEffect } from "react";
import { format, isAfter, isBefore, isSameDay, subDays } from "date-fns";
import { DayPicker } from "react-day-picker";
import "react-day-picker/dist/style.css";
import { Download, CheckCircle, Clock, TrendingUp, Undo } from "lucide-react";
import { MetricGrid } from "./MetricCards";
import { AdoptionChart } from "./charts/AdoptionChart";
import { PerformanceChart } from "./charts/PerformanceChart";
import { RollbackChart } from "./charts/RollbackChart";
import { TimeToAdoptionChart } from "./charts/TimeToAdoptionChart";
import { Tabs } from "../ui/tabs";
import { Popover, PopoverContent, PopoverTrigger } from "../ui/popover";
import {
  fetchAdoptionMetrics,
  fetchPerformanceMetrics,
  fetchActiveDevices,
  calculateMetrics
} from "./analyticsUtils";
import { Button } from "../ui/button";

interface AnalyticsProps {
  releaseId: string;
}

interface Range {
  startDate: Date;
  endDate: Date;
}

// Analytics types based on the API responses

export interface AnalyticsTimeSeriesData {
  time_slot: string;
  download_success: number;
  download_failures: number;
  apply_success: number;
  apply_failures: number;
  rollbacks_initiated: number;
  rollbacks_completed: number;
  rollback_failures: number;
  update_checks: number;
  update_available: number;
}

export interface AdoptionMetrics {
  org_id: string;
  app_id: string;
  release_id: string;
  time_breakdown: AnalyticsTimeSeriesData[];
}

export interface VersionDistribution {
  org_id: string;
  app_id: string;
  versions: {
    js_version: string;
    device_count: number;
    percentage: number;
  }[];
  total_devices: number;
}

export interface PerformanceMetrics {
  org_id: string;
  app_id: string;
  release_id?: string;
  avg_download_time_ms: number;
  avg_apply_time_ms: number;
  avg_download_size_bytes: number;
}

export interface ActiveDevicesMetrics {
  org_id: string;
  app_id: string;
  total_active_devices: number;
  daily_breakdown: {
    date: string;
    active_devices: number;
  }[];
}

export interface FailureMetrics {
  org_id: string;
  app_id: string;
  release_id?: string;
  total_failures: number;
  failure_rate: number;
  failures_by_type: {
    error_code: string;
    count: number;
    percentage: number;
  }[];
}

export interface AnalyticsResponse<T> {
  success: boolean;
  data: T;
  timestamp: string;
}

export type DateRange = "1d" | "7d" | "30d" | "custom";

export interface AnalyticsFilters {
  org_id: string;
  app_id: string;
  release_id?: string;
  date_range: DateRange;
  start_date?: Date;
  end_date?: Date;
  interval?: "HOUR" | "DAY";
}

export interface MetricCard {
  title: string;
  value: number | string;
  change?: number;
  changeType?: "positive" | "negative" | "neutral";
  icon: React.ComponentType;
  unit?: string;
}

interface FineTunedMetrics {
  totalDevices: number;
  updateChecks: number;
  downloadSuccess: number;
  downloadFailures: number;
  applySuccess: number;
  applyFailures: number;
  rollbacks: number;
  successRate: number;
  downloadSuccessRate: number;
  rollbackRate: number;
  downloadTimeMs: number;
}

const Analytics: React.FC<AnalyticsProps> = () => {
  const { org, app } = useAppContext();
  const today = new Date();
  const sevenDaysAgo = new Date();
  sevenDaysAgo.setDate(today.getDate() - 7);
  const yesterday = new Date();
  yesterday.setDate(today.getDate() - 1);

  const [range, setRange] = React.useState<Range>({
    startDate: sevenDaysAgo,
    endDate: today,
  });
  const [interval, setInterval] = React.useState<"HOUR" | "DAY">("DAY");
  const [adoptionData, setAdoptionData] =
    React.useState<AdoptionMetrics | null>(null);
  const [performanceData, setPerformanceData] =
    React.useState<PerformanceMetrics | null>(null);
  const [activeDevicesData, setActiveDevicesData] =
    React.useState<ActiveDevicesMetrics | null>(null);

  useEffect(() => {
    const fetchData = async () => {
      const orgId = org || "";
      const appId = app || "";
      const [adoption, performance, active] = await Promise.all([
        fetchAdoptionMetrics(orgId, appId, interval, range),
        fetchPerformanceMetrics(orgId, appId, interval, range),
        fetchActiveDevices(orgId, appId, interval, range),
      ]);
      setAdoptionData(adoption);
      setPerformanceData(performance);
      setActiveDevicesData(active);
    };
    fetchData();
  }, [org, app, interval, range]);

  useEffect(() => {
    const diff = range.endDate.getTime() - range.startDate.getTime();
    const hours = diff / (1000 * 60 * 60);
    if (hours <= 24) {
      setInterval("HOUR");
    } else {
      setInterval("DAY");
    }
  }, [range]);

  const metrics = calculateMetrics(adoptionData, performanceData, activeDevicesData);
  const loading = !adoptionData || !performanceData || !activeDevicesData;

  return (
    <div className="container mx-auto py-6 space-y-8">
      <div className="space-y-4">
        <h2 className="text-3xl font-bold tracking-tight">
          Analytics Dashboard
        </h2>
        <div className="text-muted-foreground">
          View analytics and metrics for your updates and deployments
        </div>
      </div>
      <Tabs>
        <div className="flex gap-4 items-center p-4">
          <button
            className={`px-4 py-2 rounded ${
              range.startDate.toDateString() === today.toDateString() &&
              range.endDate.toDateString() === today.toDateString()
                ? "bg-primary text-white"
                : "bg-muted"
            }`}
            onClick={() => {
              setRange({
                startDate: today,
                endDate: today,
              });
            }}
          >
            Last 24 hours
          </button>
          <button
            className={`px-4 py-2 rounded ${
              range.startDate.toDateString() === sevenDaysAgo.toDateString() &&
              range.endDate.toDateString() === today.toDateString()
                ? "bg-primary text-white"
                : "bg-muted"
            }`}
            onClick={() => {
              setRange({
                startDate: sevenDaysAgo,
                endDate: today,
              });
            }}
          >
            Last 7 days
          </button>
          <button
            className={`px-4 py-2 rounded ${
              range.startDate.toDateString() ===
                new Date(
                  today.getTime() - 29 * 24 * 60 * 60 * 1000
                ).toDateString() &&
              range.endDate.toDateString() === today.toDateString()
                ? "bg-primary text-white"
                : "bg-muted"
            }`}
            onClick={() => {
              setRange({
                startDate: new Date(today.getTime() - 29 * 24 * 60 * 60 * 1000),
                endDate: today,
              });
            }}
          >
            Last 30 days
          </button>
 
    <div className="flex items-center gap-2">
      <span>Custom:</span>

      {/* Start Date */}
      <Popover>
        <PopoverTrigger asChild>
          <Button variant="outline" className="px-2 py-1">
            {range.startDate.toDateString()}
          </Button>
        </PopoverTrigger>
        <PopoverContent className="p-0">
          <DayPicker
            mode="single"
            selected={range.startDate}
            onSelect={(date) => {
              if (date && date <= yesterday && date <= range.endDate) {
                setRange((prev) => ({
                  ...prev,
                  startDate: date,
                }));
              }
            }}
            disabled={[
              { after: yesterday }, // disable future dates beyond yesterday
              { before: new Date(2000, 0, 1) }, // optional min bound
            ]}
          />
        </PopoverContent>
      </Popover>

      <span>-</span>

      {/* End Date */}
      <Popover>
        <PopoverTrigger asChild>
          <Button variant="outline" className="px-2 py-1">
            {range.endDate.toDateString()}
          </Button>
        </PopoverTrigger>
        <PopoverContent className="p-0">
          <DayPicker
            mode="single"
            selected={range.endDate}
            onSelect={(date) => {
              if (date && date <= today && date >= range.startDate) {
                setRange((prev) => ({
                  ...prev,
                  endDate: date,
                }));
              }
            }}
            disabled={[
              { after: today }, // disable future dates beyond today
              { before: new Date(2000, 0, 1) },
            ]}
          />
        </PopoverContent>
      </Popover>
    </div>
        </div>
      </Tabs>
      <MetricGrid
        metrics={[
          {
            title: "Total Devices",
            value: activeDevicesData?.total_active_devices || 0,
            icon: TrendingUp,
            description: "Total active devices",
          },
          {
            title: "Check for Update Rate",
            value: `${(
              (metrics.updateChecks /
                (activeDevicesData?.total_active_devices || 1)) *
              100
            ).toFixed(1)}%`,
            icon: Clock,
            description: "Percentage of devices checking for updates",
          },
          {
            title: "Average Download Time",
            value: `${metrics.downloadTimeMs.toFixed(1)}ms`,
            icon: Clock,
            description: "Average time taken to download updates",
          },
        ]}
        loading={loading}
      />

      <MetricGrid
        metrics={[
          {
            title: "Downloads",
            value: metrics.downloadSuccess,
            icon: Download,
            description: "Successful downloads",
          },
          {
            title: "Applied Updates",
            value: metrics.applySuccess,
            icon: CheckCircle,
            description: "Successfully applied updates",
          },
          {
            title: "Rollbacks",
            value: metrics.rollbacks,
            icon: Undo,
            description: "Total rollbacks",
          },
        ]}
        loading={loading}
      />
      <div className="grid gap-6 md:grid-cols-2">
        <AdoptionChart
          data={adoptionData?.time_breakdown || []}
          interval={interval}
        />
        <PerformanceChart
          data={adoptionData?.time_breakdown || []}
          interval={interval}
        />
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        <TimeToAdoptionChart
          data={adoptionData?.time_breakdown || []}
          interval={interval}
        />
        <RollbackChart
          data={adoptionData?.time_breakdown || []}
          interval={interval}
        />
      </div>
    </div>
  );
};

export default Analytics;
