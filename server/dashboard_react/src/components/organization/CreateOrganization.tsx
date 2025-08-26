import { useState } from "react";
import { useUser } from "../../hooks/useUser";
import axios from "../../api/axios";
import { Plus } from "lucide-react";
import { createPortal } from "react-dom";
import { useToast } from "../../utils/useToast";

interface CreateOrganizationProps {
  text: string;
}

export default function CreateOrganization({ text }: CreateOrganizationProps) {
  const { showSuccess, showError } = useToast();
  const { user, setUser } = useUser();
  const [orgName, setOrgName] = useState<string>("");
  const [isModalOpen, setIsModalOpen] = useState<boolean>(false);
  const [isCreating, setIsCreating] = useState<boolean>(false);
  const onCreateOrg = async () => {
    try {
      setIsCreating(true);
      const { data: organisation } = await axios.post("/organisations/create", {
        name: orgName,
      });
      console.log(organisation);
      console.log(user);
      setUser({
        ...user,
        organisations: [...user.organisations, organisation],
      });

      setOrgName("");
      setIsModalOpen(false);
      showSuccess("Organization created successfully");
    } catch (error: any) {
      console.error("Failed to create organization:", error);
      showError("Failed to create organization");
    } finally {
      setIsCreating(false);
    }
  };

  const onCancel = () => {
    setIsModalOpen(false);
    setOrgName("");
  };

  if (!isModalOpen) {
    return (
      <button
        onClick={() => setIsModalOpen(true)}
        className="w-full p-4 bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-600 hover:to-blue-700 text-white rounded-xl font-semibold transition-all duration-300 transform hover:scale-105 shadow-lg shadow-blue-500/20 group"
      >
        <div className="flex items-center justify-center space-x-2">
          <Plus
            size={24}
            className="group-hover:rotate-90 transition-transform duration-300"
          />
          <span>{text}</span>
        </div>
      </button>
    );
  }

  return createPortal(
    <div className="fixed inset-0 z-50 overflow-y-auto">
      <div className="flex min-h-full items-center justify-center p-4 text-center sm:p-0">
        <div
          className="fixed inset-0 bg-slate-900/75 transition-opacity"
          onClick={onCancel}
        />

        <div className="relative transform overflow-hidden rounded-lg bg-slate-800 px-4 pb-4 pt-5 text-left shadow-xl transition-all sm:my-8 sm:w-full sm:max-w-lg sm:p-6">
          <div className="bg-slate-800 rounded-xl shadow-2xl border border-slate-700/50 font-sans">
            <h2 className="text-2xl font-semibold mb-6 text-slate-100">
              Create New Organisation
            </h2>
            <div className="space-y-6">
              <div>
                <label
                  htmlFor="orgName"
                  className="block text-sm font-medium text-slate-300 mb-1"
                >
                  Organisation Name
                </label>
                <input
                  id="orgName"
                  type="text"
                  value={orgName}
                  onChange={(e) => setOrgName(e.target.value)}
                  placeholder="Enter organisation name"
                  className="appearance-none block w-full px-4 py-2.5 border border-slate-700 rounded-md shadow-sm bg-slate-700 text-white placeholder-slate-400 focus:outline-none focus:ring-1 focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
                />
              </div>
              <div className="flex flex-col sm:flex-row gap-3">
                <button
                  type="button"
                  onClick={onCancel}
                  className="w-full sm:w-auto flex justify-center py-2.5 px-4 border border-slate-600 rounded-md shadow-sm text-sm font-medium text-slate-300 bg-slate-700 hover:bg-slate-600 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-slate-800 focus:ring-blue-500"
                >
                  Cancel
                </button>
                <button
                  onClick={onCreateOrg}
                  disabled={!orgName.trim() || isCreating}
                  className={`w-full sm:flex-1 flex justify-center py-2.5 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white ${
                    orgName.trim()
                      ? "bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-700 hover:to-blue-800 focus:ring-blue-500"
                      : "bg-slate-600 text-slate-400 cursor-not-allowed"
                  } focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-slate-800 disabled:opacity-70`}
                >
                  {isCreating ? "Creating..." : "Create Organization"}
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>,
    document.body
  );
}
