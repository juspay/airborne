import { AdoptionMetrics, PerformanceMetrics, ActiveDevicesMetrics, AnalyticsResponse } from "./Analytics";

export async function fetchAdoptionMetrics(
  org: string,
  app: string,
  interval: "HOUR" | "DAY",
  range: { startDate: Date; endDate: Date }
) {
  try {
    const params = new URLSearchParams({
      org_id: org || "",
      app_id: app || "",
      interval: interval,
      start_date: range.startDate.getTime().toString(),
      end_date: range.endDate.getTime().toString(),
      date: new Date().getTime().toString(),
    });
    const url = `/analytics/adoption?${params.toString()}`;
    const res = await fetch(url);
    const data: AnalyticsResponse<AdoptionMetrics> = await res.json();
    return data.data;
  } catch (error) {
    console.error("Error fetching adoption metrics:", error);
    return null;
  }
}

export async function fetchPerformanceMetrics(
  org: string,
  app: string,
  interval: "HOUR" | "DAY",
  range: { startDate: Date; endDate: Date }
) {
  try {
    const diffMs = range.endDate.getTime() - range.startDate.getTime();
    const diffDays = Math.round(diffMs / (1000 * 60 * 60 * 24));
    const params = new URLSearchParams({
      org_id: org || "",
      app_id: app || "",
      interval: interval,
      days: diffDays < 1 ? "1" : diffDays.toString(),
    });
    const url = `/analytics/performance?${params.toString()}`;
    const res = await fetch(url);
    const data: AnalyticsResponse<PerformanceMetrics> = await res.json();
    return data.data;
  } catch (error) {
    console.error("Error fetching performance metrics:", error);
    return null;
  }
}

export async function fetchActiveDevices(
  org: string,
  app: string,
  interval: "HOUR" | "DAY",
  range: { startDate: Date; endDate: Date }
) {
  try {
    const diffMs = range.endDate.getTime() - range.startDate.getTime();
    const diffDays = Math.round(diffMs / (1000 * 60 * 60 * 24));
    const params = new URLSearchParams({
      org_id: org || "",
      app_id: app || "",
      interval: interval,
      days: diffDays < 1 ? "1" : diffDays.toString(),
    });
    const url = `/analytics/active-devices?${params.toString()}`;
    const res = await fetch(url);
    const data: AnalyticsResponse<ActiveDevicesMetrics> = await res.json();
    return data.data;
  } catch (error) {
    console.error("Error fetching active devices:", error);
    return null;
  }
}

export function calculateMetrics(
  adoptionData: AdoptionMetrics | null,
  performanceData: PerformanceMetrics | null,
  activeDevicesData: ActiveDevicesMetrics | null
) {
  if (!adoptionData) {
    return {
      totalDevices: 0,
      updateChecks: 0,
      downloadSuccess: 0,
      downloadFailures: 0,
      applySuccess: 0,
      applyFailures: 0,
      rollbacks: 0,
      successRate: 0,
      downloadSuccessRate: 0,
      rollbackRate: 0,
      downloadTimeMs: 0,
    };
  }
  const totals = adoptionData.time_breakdown.reduce(
    (acc, curr) => ({
      updateChecks: acc.updateChecks + curr.update_checks,
      downloadSuccess: acc.downloadSuccess + curr.download_success,
      downloadFailures: acc.downloadFailures + curr.download_failures,
      applySuccess: acc.applySuccess + curr.apply_success,
      applyFailures: acc.applyFailures + curr.apply_failures,
      rollbacks: acc.rollbacks + curr.rollbacks_initiated,
    }),
    {
      updateChecks: 0,
      downloadSuccess: 0,
      downloadFailures: 0,
      applySuccess: 0,
      applyFailures: 0,
      rollbacks: 0,
    }
  );
  const totalDownloads = totals.downloadSuccess + totals.downloadFailures;
  return {
    ...totals,
    totalDevices: activeDevicesData?.total_active_devices || 0,
    successRate: (totals.applySuccess / (totals.applySuccess + totals.applyFailures)) * 100 || 0,
    downloadSuccessRate: totalDownloads > 0 ? (totals.downloadSuccess / totalDownloads) * 100 : 0,
    rollbackRate: totals.applySuccess > 0 ? (totals.rollbacks / totals.applySuccess) * 100 : 0,
    downloadTimeMs: performanceData?.avg_download_time_ms || 0,
  };
}
