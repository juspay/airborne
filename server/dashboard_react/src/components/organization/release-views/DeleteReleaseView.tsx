import React, { useState } from "react";
import { createPortal } from "react-dom";
import { View } from "../../../types";
import { Trash2, X, AlertTriangle } from "lucide-react";
import axios from "../../../api/axios";
import { useParams } from "react-router-dom";
import { useToast } from "../../../utils";

interface DeleteReleaseViewProps {
  view: View;
  onViewDeleted?: (viewId: string) => void;
}

const DeleteReleaseView: React.FC<DeleteReleaseViewProps> = ({
  view,
  onViewDeleted,
}) => {
  const { org: orgParam, app: appParam } = useParams();
  const org = decodeURIComponent(orgParam || "");
  const app = decodeURIComponent(appParam || "");
  const [isModalOpen, setIsModalOpen] = useState<boolean>(false);
  const [isDeleting, setIsDeleting] = useState<boolean>(false);
  const {showError, showSuccess} = useToast();

  const handleOpenModal = () => {
    setIsModalOpen(true);
  };

  const handleCloseModal = () => {
    setIsModalOpen(false);
  };

  const handleDeleteView = async () => {
    setIsDeleting(true);
    try {
      await axios.delete(
        `/organisations/applications/dimension/release-view/${view.id}`,
        {
          headers: {
            "x-application": app,
            "x-organisation": org,
          },
        }
      );

      // Success - close modal
      handleCloseModal();

      showSuccess(`Release view "${view.name}" has been deleted successfully`);
      // Call the callback to refresh the views list
      if (onViewDeleted) {
        onViewDeleted(view.id);
      }
      
    } catch (error: any) {
      console.error("Error deleting release view:", error);
      showError(error.response?.data?.message || "Failed to delete release view. Please try again.");
    } finally {
      setIsDeleting(false);
    }
  };

  return (
    <>
      {/* Trigger Button */}
      <button
        onClick={handleOpenModal}
        className="p-2 bg-red-500/20 hover:bg-red-500/30 text-red-200 rounded-lg border border-red-400/30 flex items-center transition-colors"
        title="Delete Release View"
      >
        <Trash2 size={16} />
      </button>

      {/* Modal using Portal */}
      {isModalOpen &&
        createPortal(
          <div className="fixed inset-0 bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900 bg-opacity-95 backdrop-blur-sm overflow-y-auto h-full w-full z-[9999]">
            <div className="relative min-h-screen flex items-center justify-center p-4">
              <div className="bg-white/10 backdrop-blur-xl rounded-2xl border border-white/20 shadow-2xl w-full max-w-lg">
                {/* Header */}
                <div className="flex items-center justify-between mb-6 pb-6 border-b border-white/20 p-8">
                  <div className="flex items-center space-x-4">
                    <div className="w-12 h-12 bg-gradient-to-r from-red-400 to-red-500 rounded-xl flex items-center justify-center">
                      <AlertTriangle size={24} className="text-white" />
                    </div>
                    <div>
                      <h2 className="text-2xl font-bold text-white">
                        Delete Release View
                      </h2>
                      <p className="text-white/70">
                        This action cannot be undone
                      </p>
                    </div>
                  </div>
                  <button
                    onClick={handleCloseModal}
                    className="text-white/60 hover:text-white/90 transition-colors duration-200"
                  >
                    <span className="sr-only">Close</span>
                    <X size={24} />
                  </button>
                </div>

                {/* Content Area */}
                <div className="p-8 space-y-6">
                  <div className="text-center">
                    <div className="bg-red-500/20 border border-red-400/30 rounded-lg p-4 mb-4">
                      <p className="text-white text-lg font-medium mb-2">
                        Are you sure you want to delete this release view?
                      </p>
                      <p className="text-red-200 text-sm mb-4">
                        This will permanently delete the release view "{view.name}" and all its configurations.
                      </p>
                      
                      {/* View Details */}
                      <div className="bg-white/5 rounded-lg p-3 text-left">
                        <h6 className="text-white font-medium mb-2">Release View Details:</h6>
                        <p className="text-white/80 text-sm mb-2">
                          <span className="font-medium">Name:</span> {view.name}
                        </p>
                        <div className="text-white/80 text-sm">
                          <span className="font-medium">Dimensions:</span>
                          <div className="flex flex-wrap gap-1 mt-1">
                            {Array.isArray(view.dimensions) ? view.dimensions.map((item: any, index: number) => (
                              <span
                                key={`${item.key}-${index}`}
                                className="inline-flex items-center px-2 py-1 rounded text-xs bg-blue-500/20 text-blue-200 border border-blue-400/30"
                              >
                                {item.key}: {item.value}
                              </span>
                            )) : null}
                          </div>
                        </div>
                      </div>
                    </div>
                    
                   
                  </div>
                </div>

                {/* Footer with action buttons */}
                <div className="flex justify-end space-x-4 p-8 border-t border-white/20">
                  <button
                    onClick={handleCloseModal}
                    disabled={isDeleting}
                    className="px-6 py-2 bg-white/10 hover:bg-white/20 text-white rounded-lg border border-white/20 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleDeleteView}
                    disabled={isDeleting}
                    className="px-6 py-2 bg-gradient-to-r from-red-500 to-red-600 hover:from-red-600 hover:to-red-700 text-white rounded-lg transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center"
                  >
                    {isDeleting ? (
                      <>
                        <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                        Deleting...
                      </>
                    ) : (
                      <>
                        <Trash2 size={16} className="mr-2" />
                        Delete Release View
                      </>
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

export default DeleteReleaseView;
