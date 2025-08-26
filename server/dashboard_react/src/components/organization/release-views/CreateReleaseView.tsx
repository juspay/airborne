import React, { useCallback, useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { FileJson, X, Plus, Trash2 } from "lucide-react";
import axios from "../../../api/axios";
import { useToast } from "../../../utils";
import { useParams } from "react-router-dom";

interface CreateReleaseViewProps {
  onViewCreated?: (view: any) => void;
}

interface Dimension {
  dimension: string;
  position: number;
  description: string;
}

interface DimensionEntry {
  key: string;
  value: string;
}

const CreateReleaseView: React.FC<CreateReleaseViewProps> = ({

  onViewCreated,
}) => {
  const { org: orgParam, app: appParam } = useParams();
  const org = decodeURIComponent(orgParam || "");
  const app = decodeURIComponent(appParam || "");
  const {showSuccess, showError} = useToast();
  const [isModalOpen, setIsModalOpen] = useState<boolean>(false);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [isCreating, setIsCreating] = useState<boolean>(false);
  const [dimensions, setDimensions] = useState<Dimension[]>([]);
  const [viewName, setViewName] = useState<string>("");
  const [dimensionEntries, setDimensionEntries] = useState<DimensionEntry[]>([
    { key: "", value: "" },
  ]);
  const handleOpenModal = () => {
    setIsModalOpen(true);
  };

  const handleCloseModal = () => {
    setIsModalOpen(false);
    // Reset form when closing
    setViewName("");
    setDimensionEntries([{ key: "", value: "" }]);
  };

  const addDimensionEntry = () => {
    setDimensionEntries([...dimensionEntries, { key: "", value: "" }]);
  };

  const removeDimensionEntry = (index: number) => {
    if (dimensionEntries.length > 1) {
      setDimensionEntries(dimensionEntries.filter((_, i) => i !== index));
    }
  };

  const updateDimensionEntry = (
    index: number,
    field: "key" | "value",
    value: string
  ) => {
    const updated = dimensionEntries.map((entry, i) =>
      i === index ? { ...entry, [field]: value } : entry
    );
    setDimensionEntries(updated);
  };

  const handleCreateView = async () => {
    if (!viewName.trim()) {
      showError("Please enter a view name");
      return;
    }

    // Build dimensions as array to allow duplicate keys
    const dimensionsArray = dimensionEntries
      .filter(entry => entry.key && entry.value.trim())
      .map(entry => ({
        key: entry.key,
        value: entry.value.trim()
      }));

    if (dimensionsArray.length === 0) {
      showError("Please add at least one dimension with a value");
      return;
    }

    setIsCreating(true);
    try {
      const response = await axios.post(
        `/organisations/applications/dimension/release-view`,
        {
          name: viewName.trim(),
          dimensions: dimensionsArray,
        },
        {
          headers: {
            "x-application": app,
            "x-organisation": org,
          },
        }
      );

      // Success - close modal and reset form
      handleCloseModal();
      
      showSuccess("Release view created successfully");
      
      // Call the callback to refresh the views list
      if (onViewCreated) {
        onViewCreated(response.data);
      }
      
      
    } catch (error: any) {
      console.error("Error creating view:", error);
      showError(error.response?.data?.message || "Failed to create view. Please try again.");
    } finally {
      setIsCreating(false);
    }
  };

  const fetchDimensions = useCallback(async () => {
    setIsLoading(true);
    try {
      const response = await axios.get(
        `/organisations/applications/dimension/list`,
        {
          headers: {
            "x-application": app,
            "x-organisation": org,
          },
        }
      );

      setDimensions(response.data.data);
    } catch (err: any) {
      console.error("Error fetching dimensions:", err);
    } finally {
      setIsLoading(false);
    }
  }, [app, org]);

  useEffect(() => {
    if (isModalOpen) {
      fetchDimensions();
    }
  }, [isModalOpen, fetchDimensions]);

  return (
    <>
      {/* Trigger Button */}
      <button
        onClick={handleOpenModal}
        className="px-6 py-3 bg-gradient-to-r from-green-500 to-emerald-600 hover:from-green-600 hover:to-emerald-700 text-white rounded-xl font-semibold transition-all duration-300 transform hover:scale-105 shadow-lg shadow-green-500/20 flex items-center"
      >
        <FileJson size={18} className="mr-2" />
        Create Release View
      </button>

      {/* Modal using Portal */}
      {isModalOpen &&
        createPortal(
          <div className="fixed inset-0 bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900 bg-opacity-95 backdrop-blur-sm overflow-y-auto h-full w-full z-[9999]">
            <div className="relative min-h-screen flex items-center justify-center p-4">
              <div className="bg-white/10 backdrop-blur-xl rounded-2xl border border-white/20 shadow-2xl w-full max-w-4xl">
                {/* Header */}
                <div className="flex items-center justify-between mb-6 pb-6 border-b border-white/20 p-8">
                  <div className="flex items-center space-x-4">
                    <div className="w-12 h-12 bg-gradient-to-r from-green-400 to-emerald-500 rounded-xl flex items-center justify-center">
                      <FileJson size={24} className="text-white" />
                    </div>
                    <div>
                      <h2 className="text-2xl font-bold text-white">
                        Create Release View
                      </h2>
                      <p className="text-white/70">
                        Add a new release view to {app}
                      </p>
                    </div>
                    <span className="px-4 py-2 text-sm bg-gradient-to-r from-green-400/20 to-emerald-400/20 text-green-200 rounded-full border border-green-300/30">
                      {org}
                    </span>
                  </div>
                  <button
                    onClick={handleCloseModal}
                    className="text-white/60 hover:text-white/90 transition-colors duration-200"
                  >
                    <span className="sr-only">Close</span>
                    <X size={24} />
                  </button>
                </div>

                {/* Content Area - Form */}
                <div className="p-8 space-y-6">
                  {/* View Name Input */}
                  <div>
                    <label className="block text-white font-medium mb-2">
                      Release View Name
                    </label>
                    <input
                      type="text"
                      value={viewName}
                      onChange={(e) => setViewName(e.target.value)}
                      placeholder="Enter release view name"
                      className="w-full px-4 py-3 bg-white/10 border border-white/20 rounded-lg text-white placeholder-white/50 focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-transparent"
                    />
                  </div>

                  {/* Dimensions Section */}
                  <div>
                    <div className="flex items-center justify-between mb-4">
                      <label className="block text-white font-medium">
                        Dimensions
                      </label>
                      <button
                        onClick={addDimensionEntry}
                        className="px-3 py-1 bg-green-500/20 hover:bg-green-500/30 text-green-200 rounded-lg border border-green-400/30 flex items-center text-sm transition-colors"
                      >
                        <Plus size={16} className="mr-1" />
                        Add Dimension
                      </button>
                    </div>

                    {isLoading ? (
                      <div className="text-center py-4">
                        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-white mx-auto"></div>
                        <p className="text-white/60 mt-2">
                          Loading dimensions...
                        </p>
                      </div>
                    ) : (
                      <div className="space-y-3">
                        {dimensionEntries.map((entry, index) => (
                          <div key={index} className="flex gap-3 items-center">
                            {/* Dimension Key Dropdown */}
                            <div className="flex-1">
                              <select
                                value={entry.key}
                                onChange={(e) =>
                                  updateDimensionEntry(
                                    index,
                                    "key",
                                    e.target.value
                                  )
                                }
                                className="w-full px-3 py-2 bg-white/10 border border-white/20 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-transparent"
                              >
                                <option value="" className="bg-slate-800">
                                  Select dimension
                                </option>
                                {dimensions.map((dim) => (
                                  <option
                                    key={dim.dimension}
                                    value={dim.dimension}
                                    className="bg-slate-800"
                                  >
                                    {dim.dimension}
                                  </option>
                                ))}
                              </select>
                            </div>

                            {/* Dimension Value Input */}
                            <div className="flex-1">
                              <input
                                type="text"
                                value={entry.value}
                                onChange={(e) =>
                                  updateDimensionEntry(
                                    index,
                                    "value",
                                    e.target.value
                                  )
                                }
                                placeholder="Enter value"
                                className="w-full px-3 py-2 bg-white/10 border border-white/20 rounded-lg text-white placeholder-white/50 focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-transparent"
                              />
                            </div>

                            {/* Remove Button */}
                            {dimensionEntries.length > 1 && (
                              <button
                                onClick={() => removeDimensionEntry(index)}
                                className="p-2 text-red-400 hover:text-red-300 hover:bg-red-500/20 rounded-lg transition-colors"
                              >
                                <Trash2 size={16} />
                              </button>
                            )}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>

                  {dimensions.length === 0 && !isLoading && (
                    <div className="text-center py-4">
                      <p className="text-white/60">
                        No dimensions found. Create dimensions first to add them
                        to release views.
                      </p>
                    </div>
                  )}
                </div>

                {/* Footer with action buttons */}
                <div className="flex justify-end space-x-4 p-8 border-t border-white/20">
                  <button
                    onClick={handleCloseModal}
                    disabled={isCreating}
                    className="px-6 py-2 bg-white/10 hover:bg-white/20 text-white rounded-lg border border-white/20 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleCreateView}
                    disabled={isCreating || !viewName.trim()}
                    className="px-6 py-2 bg-gradient-to-r from-green-500 to-emerald-600 hover:from-green-600 hover:to-emerald-700 text-white rounded-lg transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center"
                  >
                    {isCreating ? (
                      <>
                        <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                        Creating...
                      </>
                    ) : (
                      "Create Release View"
                    )}
                  </button>
                </div>
              </div>
            </div>
          </div>,
          document.body
        )}
    </>
  );
};

export default CreateReleaseView;
