import { ChevronRight, Trash2 } from "lucide-react";
import React, { useState } from "react";
import { createPortal } from "react-dom";
import { Organisation } from "../../types";
import axios from "../../api/axios";
import { useToast } from "../../utils";
import { useUser } from "../../hooks/useUser";


interface DeleteOrganisationProps {
  organisation: Organisation;
}

const DeleteOrganisation: React.FC<DeleteOrganisationProps> = ({ organisation }) => {
  const {showSuccess, showError} = useToast();
  const {user, setUser} = useUser();
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isDeletingOrg, setIsDeletingOrg] = useState<boolean>(false);

  const handleDeleteOrg = async () => {
    setIsDeletingOrg(true);
    try {
      await axios.delete(`/organisations/${organisation.name}`, {
        headers: { "x-organisation": organisation.name },
      });

      setUser({
        ...user,
        organisations: user.organisations.filter(org => org.name !== organisation.name)
      });
      setIsModalOpen(false);
      showSuccess(`Successfully deleted organisation ${organisation.name}`);
    } catch (error) {
      showError(`Failed to delete organisation ${organisation.name}`);
    } finally {
      setIsDeletingOrg(false);
    }
  }


  const isOrgAdmin = () => true; // Placeholder

  return (
    <div>
      <div className="flex items-center space-x-2">
        {isOrgAdmin() && (
          <button
            onClick={(e) => {
              e.stopPropagation(); 
              setIsModalOpen(true);
            }}
            className={`p-1.5 rounded-lg bg-red-500/10 text-red-400 hover:bg-red-500/20 transition-colors `}
          >
            <Trash2 size={14} />
          </button>
        )}
        <ChevronRight size={16} className="text-white/40" />
      </div>
      {isModalOpen && createPortal(
        <div 
          className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50"
          onClick={(e) => {
            e.stopPropagation();
            setIsModalOpen(false);
          }}
        >
          <div 
            className="bg-slate-800 p-6 rounded-xl shadow-xl border border-slate-700/50 max-w-md w-full mx-4 animate-fade-in"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex flex-col items-center text-center">
              <div className="w-12 h-12 bg-red-500/10 rounded-full flex items-center justify-center mb-4">
                <Trash2 className="h-6 w-6 text-red-400" />
              </div>
              <h2 className="text-xl font-semibold text-white mb-2">Delete Organisation</h2>
              <p className="text-slate-400 mb-6">
                Are you sure you want to delete <span className="font-semibold text-white">{organisation.name}</span>? This action cannot be undone.
              </p>
              <div className="flex gap-3 w-full">
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    setIsModalOpen(false);
                  }}
                  className="flex-1 px-4 py-2 bg-slate-700 hover:bg-slate-600 text-white rounded-lg transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    handleDeleteOrg();
                    setIsModalOpen(false);
                  }}
                  disabled={isDeletingOrg}
                  className="flex-1 px-4 py-2 bg-red-500 hover:bg-red-600 text-white rounded-lg transition-colors"
                >
                  {isDeletingOrg ? "Deleting..." : "Delete"}
                </button>
              </div>
            </div>
          </div>
        </div>,
        document.body
      )}
    </div>
  );
};

export default DeleteOrganisation;
