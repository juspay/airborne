import React, { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import axios from "../../api/axios";
import ReleaseAPI from "../../api/releaseApi";
import {
  Calendar,
  User,
  Package,
  Eye,
  AlertCircle,
  Loader2,
  TrendingUp,
  CheckCircle,
  Settings,
} from "lucide-react";
import { useNavigate, useParams } from "react-router-dom";

interface ReleaseHistoryEntry {
  id: string;
  package_version: number;
  config_version: string;
  created_at: string;
  created_by: string;
  metadata: Record<string, any>;
}

interface RampModalProps {
  releaseId: string;
  organisation: string;
  application: string;
  release: ReleaseHistoryEntry;
  onClose: () => void;
  onSuccess: () => void;
}

interface ConcludeModalProps {
  releaseId: string;
  organisation: string;
  application: string;
  release: ReleaseHistoryEntry;
  onClose: () => void;
  onSuccess: () => void;
}

// Ramp Modal Component
const RampModal: React.FC<RampModalProps> = ({
  releaseId,
  organisation,
  application,
  release,
  onClose,
  onSuccess,
}) => {
  const [trafficPercentage, setTrafficPercentage] = useState<number>(10);
  const [changeReason, setChangeReason] = useState<string>("");
  const [loading, setLoading] = useState(false);
  const [currentTraffic, setCurrentTraffic] = useState<number>(0);
  const [experimentStatus, setExperimentStatus] = useState<string>("");
  const [fetchingCurrent, setFetchingCurrent] = useState(true);

  const maxTraffic = 50; // Maximum allowed traffic percentage

  // Fetch current experiment details when modal opens
  useEffect(() => {
    const fetchExperimentDetails = async () => {
      try {
        const experimentId = release.metadata?.experiment_id;
        if (experimentId) {
          const details = await ReleaseAPI.getExperimentDetails(
            experimentId,
            organisation,
            application
          );
          const current = details.traffic_percentage || 0;
          setCurrentTraffic(current);
          setExperimentStatus(details.status || "INPROGRESS"); // Default to INPROGRESS if status missing
          setTrafficPercentage(Math.max(current, current + 5)); // Set initial value slightly higher than current
        }
      } catch (error) {
        console.error("Failed to fetch experiment details:", error);
        setCurrentTraffic(0);
        setExperimentStatus("INPROGRESS"); // Default to allow actions
      } finally {
        setFetchingCurrent(false);
      }
    };

    fetchExperimentDetails();
  }, [release.metadata?.experiment_id, organisation, application]);

  const handleRamp = async () => {
    try {
      setLoading(true);
      await ReleaseAPI.rampRelease(
        releaseId,
        {
          traffic_percentage: trafficPercentage,
          change_reason: changeReason || undefined,
        },
        organisation,
        application
      );
      onSuccess();
      onClose();
    } catch (error) {
      console.error("Failed to ramp release:", error);
    } finally {
      setLoading(false);
    }
  };

  return createPortal(
    <div
      className="fixed inset-0 bg-black/70 backdrop-blur-sm z-[9999] flex items-center justify-center p-4"
      onClick={onClose}
    >
      <div
        className="bg-white/10 backdrop-blur-xl rounded-2xl border border-white/20 p-6 w-full max-w-md max-h-[80vh] overflow-y-auto shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <h3 className="text-xl font-bold text-white mb-4">
          Ramp Up Experiment
        </h3>

        {fetchingCurrent ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 size={24} className="animate-spin text-cyan-400" />
            <span className="ml-2 text-white/80">
              Loading current traffic...
            </span>
          </div>
        ) : (
          <div className="space-y-6">
            {/* Current Traffic Display */}
            <div className="bg-white/5 rounded-lg p-4 border border-white/10">
              <div className="flex items-center justify-between mb-2">
                <span className="text-white/80 text-sm">Current Traffic</span>
                <span className="text-cyan-400 font-semibold">
                  {currentTraffic}%
                </span>
              </div>
              <div className="w-full bg-white/10 rounded-full h-2">
                <div
                  className="bg-gradient-to-r from-cyan-400 to-blue-500 h-2 rounded-full transition-all duration-300"
                  style={{ width: `${(currentTraffic / maxTraffic) * 100}%` }}
                />
              </div>

              {/* Experiment Status */}
              <div className="flex items-center justify-between mt-3 pt-2 border-t border-white/10">
                <span className="text-white/80 text-sm">Status</span>
                <span
                  className={`px-2 py-1 rounded text-xs font-medium ${
                    experimentStatus === "CONCLUDED"
                      ? "bg-green-500/20 text-green-400"
                      : experimentStatus === "INPROGRESS"
                      ? "bg-blue-500/20 text-blue-400"
                      : experimentStatus === "CREATED"
                      ? "bg-yellow-500/20 text-yellow-400"
                      : experimentStatus === "DISCARDED"
                      ? "bg-red-500/20 text-red-400"
                      : experimentStatus === "PAUSED"
                      ? "bg-orange-500/20 text-orange-400"
                      : "bg-gray-500/20 text-gray-400"
                  }`}
                >
                  {experimentStatus}
                </span>
              </div>
            </div>

            {/* Traffic Percentage Slider */}
            <div>
              <div className="flex items-center justify-between mb-3">
                <label className="text-white/80 text-sm font-medium">
                  New Traffic Percentage
                </label>
                <span className="text-white font-semibold text-lg">
                  {trafficPercentage}%
                </span>
              </div>

              <div className="space-y-3">
                <div className="relative">
                  <input
                    type="range"
                    min={currentTraffic}
                    max={maxTraffic}
                    value={trafficPercentage}
                    onChange={(e) =>
                      setTrafficPercentage(parseInt(e.target.value))
                    }
                    className="w-full h-2 bg-white/10 rounded-lg appearance-none cursor-pointer slider"
                    style={{
                      background: `linear-gradient(to right, 
                        #0891b2 0%, 
                        #0891b2 ${
                          ((trafficPercentage - currentTraffic) /
                            (maxTraffic - currentTraffic)) *
                          100
                        }%, 
                        rgba(255,255,255,0.1) ${
                          ((trafficPercentage - currentTraffic) /
                            (maxTraffic - currentTraffic)) *
                          100
                        }%, 
                        rgba(255,255,255,0.1) 100%)`,
                    }}
                  />
                  <style
                    dangerouslySetInnerHTML={{
                      __html: `
                      .slider::-webkit-slider-thumb {
                        appearance: none;
                        width: 20px;
                        height: 20px;
                        border-radius: 50%;
                        background: #0891b2;
                        cursor: pointer;
                        border: 2px solid white;
                        box-shadow: 0 2px 6px rgba(0,0,0,0.3);
                      }
                      .slider::-moz-range-thumb {
                        width: 20px;
                        height: 20px;
                        border-radius: 50%;
                        background: #0891b2;
                        cursor: pointer;
                        border: 2px solid white;
                        box-shadow: 0 2px 6px rgba(0,0,0,0.3);
                      }
                    `,
                    }}
                  />
                </div>

                <div className="flex justify-between text-xs text-white/60">
                  <span>Min: {currentTraffic}%</span>
                  <span>Max: {maxTraffic}%</span>
                </div>
              </div>

              {experimentStatus === "CONCLUDED" && (
                <div className="mt-3 p-3 bg-green-500/20 border border-green-500/30 rounded-lg">
                  <p className="text-green-400 text-sm">
                    This experiment has been concluded and cannot be ramped
                    further.
                  </p>
                </div>
              )}

              {experimentStatus === "DISCARDED" && (
                <div className="mt-3 p-3 bg-red-500/20 border border-red-500/30 rounded-lg">
                  <p className="text-red-400 text-sm">
                    This experiment has been discarded and cannot be ramped.
                  </p>
                </div>
              )}

              {experimentStatus === "PAUSED" && (
                <div className="mt-3 p-3 bg-orange-500/20 border border-orange-500/30 rounded-lg">
                  <p className="text-orange-400 text-sm">
                    This experiment is paused and cannot be ramped.
                  </p>
                </div>
              )}

              {experimentStatus === "INPROGRESS" &&
                currentTraffic >= maxTraffic && (
                  <div className="mt-3 p-3 bg-yellow-500/20 border border-yellow-500/30 rounded-lg">
                    <p className="text-yellow-400 text-sm">
                      This experiment is already at maximum traffic (
                      {maxTraffic}%).
                    </p>
                  </div>
                )}
            </div>

            {/* Change Reason */}
            <div>
              <label className="block text-white/80 text-sm font-medium mb-2">
                Change Reason (Optional)
              </label>
              <textarea
                value={changeReason}
                onChange={(e) => setChangeReason(e.target.value)}
                placeholder="Reason for ramping up..."
                className="w-full px-3 py-2 bg-white/10 border border-white/20 rounded-lg text-white placeholder-white/50 focus:outline-none focus:border-cyan-400 resize-none"
                rows={3}
              />
            </div>

            {/* Action Buttons */}
            <div className="flex space-x-3 pt-4">
              <button
                onClick={onClose}
                className="flex-1 px-4 py-2 bg-white/10 hover:bg-white/20 text-white rounded-lg transition-all duration-200"
              >
                Cancel
              </button>
              <button
                onClick={handleRamp}
                disabled={
                  loading ||
                  trafficPercentage <= currentTraffic ||
                  trafficPercentage > maxTraffic ||
                  experimentStatus === "CONCLUDED" ||
                  experimentStatus === "DISCARDED" ||
                  experimentStatus === "PAUSED"
                }
                className="flex-1 px-4 py-2 bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-600 hover:to-blue-700 text-white rounded-lg transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center"
              >
                {loading ? (
                  <Loader2 size={18} className="animate-spin" />
                ) : (
                  "Ramp Up"
                )}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>,
    document.body
  );
};

// Conclude Modal Component
const ConcludeModal: React.FC<ConcludeModalProps> = ({
  releaseId,
  organisation,
  application,
  release,
  onClose,
  onSuccess,
}) => {
  const [chosenVariant, setChosenVariant] = useState<string>("");
  const [changeReason, setChangeReason] = useState<string>("");
  const [loading, setLoading] = useState(false);

  // Extract variants from release metadata
  const variants = React.useMemo(() => {
    const releaseVariants = release.metadata?.variants;
    if (Array.isArray(releaseVariants)) {
      return releaseVariants;
    }
    // Fallback to default variants if not found in metadata
    return [
      { id: "control", name: "Control (Original)" },
      { id: "experimental_variant", name: "Experimental (New Version)" },
    ];
  }, [release.metadata]);

  // Set the first variant as default when variants are loaded
  React.useEffect(() => {
    if (variants.length > 0 && !chosenVariant) {
      setChosenVariant(variants[0].id);
    }
  }, [variants, chosenVariant]);

  const handleConclude = async () => {
    try {
      setLoading(true);
      await ReleaseAPI.concludeRelease(
        releaseId,
        {
          chosen_variant: chosenVariant,
          change_reason: changeReason || undefined,
        },
        organisation,
        application
      );
      onSuccess();
      onClose();
    } finally {
      setLoading(false);
    }
  };

  return createPortal(
    <div
      className="fixed inset-0 bg-black/70 backdrop-blur-sm z-[9999] flex items-center justify-center p-4"
      onClick={onClose}
    >
      <div
        className="bg-white/10 backdrop-blur-xl rounded-2xl border border-white/20 p-6 w-full max-w-md max-h-[80vh] overflow-y-auto shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <h3 className="text-xl font-bold text-white mb-4">
          Conclude Experiment
        </h3>

        <div className="space-y-4">
          <div>
            <label className="block text-white/80 text-sm font-medium mb-2">
              Winning Variant
            </label>
            <select
              value={chosenVariant}
              onChange={(e) => setChosenVariant(e.target.value)}
              className="w-full px-3 py-2 bg-white/10 border border-white/20 rounded-lg text-white focus:outline-none focus:border-cyan-400"
            >
              {variants.map((variant) => (
                <option key={variant.id} value={variant.id}>
                  {variant.name}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-white/80 text-sm font-medium mb-2">
              Change Reason (Optional)
            </label>
            <textarea
              value={changeReason}
              onChange={(e) => setChangeReason(e.target.value)}
              placeholder="Reason for concluding..."
              className="w-full px-3 py-2 bg-white/10 border border-white/20 rounded-lg text-white placeholder-white/50 focus:outline-none focus:border-cyan-400 resize-none"
              rows={3}
            />
          </div>
        </div>

        <div className="flex space-x-3 mt-6">
          <button
            onClick={onClose}
            className="flex-1 px-4 py-2 bg-white/10 hover:bg-white/20 text-white rounded-lg transition-all duration-200"
          >
            Cancel
          </button>
          <button
            onClick={handleConclude}
            disabled={loading}
            className="flex-1 px-4 py-2 bg-gradient-to-r from-green-500 to-emerald-600 hover:from-green-600 hover:to-emerald-700 text-white rounded-lg transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center"
          >
            {loading ? (
              <Loader2 size={18} className="animate-spin" />
            ) : (
              "Conclude"
            )}
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
};

const ReleaseHistory = () => {
  const navigate = useNavigate();
  const { org: orgParam, app: appParam } = useParams();
  const org = decodeURIComponent(orgParam || "");
  const app = decodeURIComponent(appParam || "");
  const [releases, setReleases] = useState<ReleaseHistoryEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [rampModalOpen, setRampModalOpen] =
    useState<ReleaseHistoryEntry | null>(null);
  const [concludeModalOpen, setConcludeModalOpen] =
    useState<ReleaseHistoryEntry | null>(null);
  const [experimentStatuses, setExperimentStatuses] = useState<
    Record<string, string>
  >({});
  const [page, setPage] = useState(1);
  const count = 10;
  const [totalPages, setTotalPages] = useState(0);
  const [_totalItems, setTotalItems] = useState(0);

  const fetchReleaseHistory = async () => {
    try {
      setLoading(true);
      const { data } = await axios.get(
        `/organisations/applications/release/history?page=${page}&count=${count}`,
        {
          headers: {
            "x-organisation": org,
            "x-application": app,
          },
        }
      );
      setReleases(data.releases);
      setTotalItems(data.total_items || 0);
      setTotalPages(data.total_pages || 0);
      setError(null);

      // Fetch experiment statuses for releases with experiments
      const statusPromises = data.releases
        .filter((release: ReleaseHistoryEntry) => hasExperiment(release))
        .map(async (release: ReleaseHistoryEntry) => {
          try {
            const experimentId = release.metadata?.experiment_id;
            if (experimentId) {
              const details = await ReleaseAPI.getExperimentDetails(
                experimentId,
                org,
                app
              );
              return { experimentId, status: details.status || "INPROGRESS" };
            }
          } catch (error) {
            console.error(
              `Failed to fetch status for experiment ${release.metadata?.experiment_id}:`,
              error
            );
            return {
              experimentId: release.metadata?.experiment_id,
              status: "UNKNOWN",
            };
          }
          return null;
        });

      const statuses = await Promise.all(statusPromises);
      const statusMap: Record<string, string> = {};
      statuses.forEach((result) => {
        if (result && result.experimentId) {
          statusMap[result.experimentId] = result.status;
        }
      });
      setExperimentStatuses(statusMap);
    } catch (err: any) {
      setError(err.response?.data?.message || "Failed to load release history");
      setReleases([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (org && app) {
      fetchReleaseHistory();
    }
  }, [org, app, page]);

  // Helper function to check if release has an experiment
  const hasExperiment = (release: ReleaseHistoryEntry): boolean => {
    return !!release.metadata?.experiment_id;
  };

  // Helper function to handle successful modal operations
  const handleModalSuccess = () => {
    fetchReleaseHistory(); // Refresh the list
  };

  // Helper function to format dates
  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return new Intl.DateTimeFormat("en-US", {
      year: "numeric",
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    }).format(date);
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center p-16">
        <div className="text-center">
          <div className="w-16 h-16 bg-gradient-to-r from-cyan-400 to-blue-500 rounded-2xl flex items-center justify-center mx-auto mb-4 animate-pulse">
            <Loader2 size={28} className="text-white animate-spin" />
          </div>
          <p className="text-white/60">Loading release history...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-red-500/10 border border-red-500/30 text-red-400 px-6 py-4 rounded-2xl backdrop-blur-xl">
        <div className="flex items-center">
          <AlertCircle size={20} className="mr-3" />
          <div>
            <strong className="font-semibold">Error: </strong>
            <span>{error}</span>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6 pb-6 p-8  overflow-y-auto">
      <div className="bg-white/10 backdrop-blur-xl rounded-2xl border border-white/20 shadow-xl  ">
        <div className="px-6 py-6 border-b border-white/10 mb-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center">
              <div>
                <h3 className="text-xl font-semibold text-white mb-1">
                  Release History
                </h3>
                <p className="text-white/60 text-sm">
                  Manage experiments and track releases
                </p>
              </div>
            </div>
          </div>
        </div>

        <div className="space-y-2 p-2">
          {releases.length === 0 ? (
            <div className="text-center py-16">
              <div className="w-20 h-20 bg-gradient-to-r from-gray-400/20 to-gray-500/20 rounded-2xl flex items-center justify-center mx-auto mb-6">
                <Package size={32} className="text-white/40" />
              </div>
              <h3 className="text-xl font-semibold text-white mb-2">
                No Release History
              </h3>
              <p className="text-white/60 max-w-md mx-auto">
                No releases found for this application. Create your first
                release to see it here.
              </p>
            </div>
          ) : (
            releases.map((release, index) => (
              <div
                key={release.id}
                className="bg-white/10 backdrop-blur-xl rounded-2xl border border-white/20 p-6 hover:bg-white/15 transition-all duration-300 cursor-pointer group shadow-lg"
                onClick={() => {
                  navigate(`/dashboard/${org}/${app}/release/${release.id}`);
                }}
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-4">
                    {/* Version Badge */}
                    <div className="flex items-center">
                      <div
                        className={`w-12 h-12 rounded-xl flex items-center justify-center mr-4 ${
                          index === 0
                            ? "bg-gradient-to-r from-green-400 to-emerald-500"
                            : "bg-gradient-to-r from-cyan-400 to-blue-500"
                        }`}
                      >
                        <Package size={24} className="text-white" />
                      </div>
                      <div>
                        <div className="flex items-center space-x-2">
                          <h4 className="text-lg font-bold text-white">
                            v{release.package_version}
                          </h4>
                          {index === 0 && (
                            <span className="px-2 py-1 bg-green-500/20 text-green-400 rounded-full text-xs font-medium border border-green-500/30">
                              Latest
                            </span>
                          )}
                        </div>
                        <p className="text-white/60 text-sm">
                          Config v{release.config_version}
                        </p>
                      </div>
                    </div>
                  </div>

                  {/* Release Info */}
                  <div className="flex items-center space-x-6">
                    <div className="text-right">
                      <div className="flex items-center text-white/60 text-sm mb-1">
                        <User size={14} className="mr-1" />
                        <span>{release.created_by}</span>
                      </div>
                      <div className="flex items-center text-white/60 text-sm">
                        <Calendar size={14} className="mr-1" />
                        <span>{formatDate(release.created_at)}</span>
                      </div>
                      {hasExperiment(release) && (
                        <div className="flex items-center text-blue-400 text-sm mt-1">
                          <Settings size={12} className="mr-1" />
                          <span>Experiment Available</span>
                        </div>
                      )}
                    </div>

                    {/* Action Buttons */}
                    <div className="flex items-center space-x-2">
                      {hasExperiment(release) &&
                        (() => {
                          const experimentId = release.metadata?.experiment_id;
                          const experimentStatus = experimentId
                            ? experimentStatuses[experimentId] || "INPROGRESS"
                            : "INPROGRESS";
                          const isActive =
                            experimentStatus === "INPROGRESS" ||
                            experimentStatus === "CREATED";
                          const isConcluded = experimentStatus === "CONCLUDED";

                          return (
                            <>
                              {/* Status badge */}
                              <div
                                className={`px-2 py-1 rounded text-xs font-medium ${
                                  isConcluded
                                    ? "bg-green-500/20 text-green-400"
                                    : isActive
                                    ? "bg-blue-500/20 text-blue-400"
                                    : experimentStatus === "DISCARDED"
                                    ? "bg-red-500/20 text-red-400"
                                    : experimentStatus === "PAUSED"
                                    ? "bg-orange-500/20 text-orange-400"
                                    : "bg-gray-500/20 text-gray-400"
                                }`}
                              >
                                {experimentStatus || "INPROGRESS"}
                              </div>

                              {/* Ramp button - only show for active experiments */}
                              {isActive && (
                                <button
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    setRampModalOpen(release);
                                  }}
                                  className="p-2 bg-cyan-500/20 hover:bg-cyan-500/30 text-cyan-400 rounded-lg transition-all duration-200 border border-cyan-500/30"
                                  title="Ramp Up Experiment"
                                >
                                  <TrendingUp size={16} />
                                </button>
                              )}

                              {/* Conclude button - only show for active experiments */}
                              {isActive && (
                                <button
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    setConcludeModalOpen(release);
                                  }}
                                  className="p-2 bg-green-500/20 hover:bg-green-500/30 text-green-400 rounded-lg transition-all duration-200 border border-green-500/30"
                                  title="Conclude Experiment"
                                >
                                  <CheckCircle size={16} />
                                </button>
                              )}
                            </>
                          );
                        })()}

                      {/* View Button */}
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          navigate(
                            `/dashboard/${org}/${app}/release/${release.id}`
                          );
                        }}
                        className="p-3 bg-white/10 hover:bg-white/20 text-white rounded-xl transition-all duration-200 group-hover:bg-gradient-to-r group-hover:from-cyan-500 group-hover:to-blue-600"
                      >
                        <Eye size={18} />
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            ))
          )}
          {totalPages > 1 && (
            <div className="flex justify-center items-center gap-2 p-6">
              <button
                onClick={() => setPage((prev) => Math.max(prev - 1, 1))}
                disabled={page === 1}
                className={`px-4 py-2 rounded-xl text-sm font-medium transition-all duration-200 
        ${
          page === 1
            ? "bg-white/5 text-white/40 cursor-not-allowed"
            : "bg-white/10 hover:bg-gradient-to-r hover:from-cyan-500 hover:to-blue-600 text-white border border-white/20 shadow-lg"
        }`}
              >
                ← Prev
              </button>

              <div className="flex gap-2">
                {[...Array(totalPages)].map((_, i) => {
                  const pageNum = i + 1;
                  return (
                    <button
                      key={pageNum}
                      onClick={() => setPage(pageNum)}
                      className={`w-10 h-10 rounded-xl flex items-center justify-center text-sm font-semibold transition-all duration-200
              ${
                page === pageNum
                  ? "bg-gradient-to-r from-cyan-500 to-blue-600 text-white shadow-md"
                  : "bg-white/10 hover:bg-white/20 text-white/80 border border-white/20"
              }`}
                    >
                      {pageNum}
                    </button>
                  );
                })}
              </div>

              <button
                onClick={() =>
                  setPage((prev) => Math.min(prev + 1, totalPages))
                }
                disabled={page === totalPages}
                className={`px-4 py-2 rounded-xl text-sm font-medium transition-all duration-200 
        ${
          page === totalPages
            ? "bg-white/5 text-white/40 cursor-not-allowed"
            : "bg-white/10 hover:bg-gradient-to-r hover:from-cyan-500 hover:to-blue-600 text-white border border-white/20 shadow-lg"
        }`}
              >
                Next →
              </button>
            </div>
          )}
        </div>

        {/* Modals */}
        {rampModalOpen && (
          <RampModal
            releaseId={rampModalOpen.id}
            organisation={org}
            application={app}
            release={rampModalOpen}
            onClose={() => setRampModalOpen(null)}
            onSuccess={handleModalSuccess}
          />
        )}

        {concludeModalOpen && (
          <ConcludeModal
            releaseId={concludeModalOpen.id}
            organisation={org}
            application={app}
            release={concludeModalOpen}
            onClose={() => setConcludeModalOpen(null)}
            onSuccess={handleModalSuccess}
          />
        )}
      </div>
    </div>
  );
};

export default ReleaseHistory;
