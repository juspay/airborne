import { useState } from "react";
import { X, Plus, Building2 } from "lucide-react";
import { useUser } from "../../../hooks/useUser";
import { useParams } from "react-router-dom";
import { createPortal } from "react-dom";
import useToast from "../../../utils/useToast";
import axios from "../../../api/axios";
interface CreateApplicationProps {
  text: string;
}

export default function CreateApplication({ text }: CreateApplicationProps) {
  const { user,setUser } = useUser();
  const { org: encodedOrg } = useParams();
  const org = decodeURIComponent(encodedOrg || '');
  const {showSuccess, showError} = useToast();
  const [name, setName] = useState<string>("");
  const [isModalOpen, setIsModalOpen] = useState<boolean>(false);
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);

  const handleSubmit = async () => {
    setIsSubmitting(true);
    try{
      const res = await axios.post("/organisations/applications/create",{
        organisation: org,
        application: name.trim()
      },{
        headers: { "x-organisation": org }
      })

      setUser({
        ...user,
        organisations: user.organisations.map(o => 
          o.name === org
            ? { 
                ...o, 
                applications: [...o.applications, res.data] 
              } 
            : o
        )
      })
      setIsModalOpen(false);
      showSuccess("Application created successfully");
    } catch (error) {
      showError("Failed to create application");
    } finally {
      setIsSubmitting(false);
    }   
  };


  if (!isModalOpen) {
    return (
      <button
        onClick={() => setIsModalOpen(true)}
        className="px-6 py-3 bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-600 hover:to-blue-700 text-white rounded-xl font-semibold transition-all duration-300 transform hover:scale-105 shadow-lg shadow-blue-500/20 flex items-center"
      >
        <Plus size={18} className="mr-2" />
        {text}
      </button>
    );
  }

  return createPortal(
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-white/10 backdrop-blur-xl rounded-3xl border border-white/20 shadow-2xl max-w-lg w-full relative overflow-hidden">
        {/* Background gradient overlay */}
        <div className="absolute inset-0 bg-gradient-to-br from-cyan-500/10 to-blue-600/10"></div>

        {/* Close button */}
        <button
          onClick={() => setIsModalOpen(false)}
          className="absolute top-6 right-6 p-2 rounded-lg bg-white/10 hover:bg-white/20 text-white/70 hover:text-white transition-all duration-200 z-10"
        >
          <X size={20} />
        </button>

        <div className="relative p-8">
          {/* Header */}
          <div className="text-center mb-8">
            <div className="w-16 h-16 bg-gradient-to-r from-cyan-400 to-blue-500 rounded-2xl flex items-center justify-center mx-auto mb-4 shadow-lg shadow-blue-500/20">
              <Plus size={28} className="text-white" />
            </div>
            <h2 className="text-2xl font-bold text-white mb-2">
              Create New Application
            </h2>
            <p className="text-white/60">
              Add a new application to your organization
            </p>
          </div>

          {/* Organization info */}
          <div className="bg-white/5 rounded-2xl p-4 border border-white/10 mb-6">
            <div className="flex items-center">
              <div className="w-10 h-10 bg-gradient-to-r from-purple-400 to-pink-400 rounded-lg flex items-center justify-center mr-3">
                <Building2 size={20} className="text-white" />
              </div>
              <div>
                <p className="text-white/60 text-sm">Organization</p>
                <p className="text-white font-semibold">
                  {org}
                </p>
              </div>
            </div>
          </div>

          {/* Form */}
          <form onSubmit={handleSubmit} className="space-y-6">
            <div>
              <label
                htmlFor="applicationName"
                className="block text-sm font-semibold text-white mb-3"
              >
                Application Name
              </label>
              <input
                id="applicationName"
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Enter application name"
                className="w-full px-4 py-3 bg-white/10 border border-white/20 rounded-xl text-white placeholder-white/50 focus:outline-none focus:ring-2 focus:ring-cyan-400 focus:border-transparent backdrop-blur-sm transition-all duration-200"
                autoFocus
              />
            </div>

            {/* Action buttons */}
            <div className="flex gap-4 pt-4">
              <button
                type="button"
                onClick={() => setIsModalOpen(false)}
                className="flex-1 px-6 py-3 bg-white/10 hover:bg-white/20 text-white rounded-xl font-semibold transition-all duration-300 border border-white/20"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={!name.trim() || isSubmitting}
                className={`flex-1 px-6 py-3 rounded-xl font-semibold transition-all duration-300 transform ${
                  name.trim()
                    ? "bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-600 hover:to-blue-700 text-white hover:scale-105 shadow-lg shadow-blue-500/20"
                    : "bg-white/5 text-white/40 cursor-not-allowed border border-white/10"
                }`}
              >
                <div className="flex items-center justify-center">
                  <Plus size={18} className="mr-2" />
                  {isSubmitting ? "Creating Application..." : "Create Application"}
                </div>
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  ,
  document.body
  );
}
