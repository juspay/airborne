import React from 'react';
import { Plus, ChevronRight, Trash2, Building2, Zap, ArrowLeft } from "lucide-react";

// Keep the same type definitions as in Home.tsx for now
interface OrganisationUser {
  id: string;
  username: string;
  email: string;
  role: string[];
}

interface Application {
  id: string;
  application: string;
  versions: string[];
}

interface Organisation {
  id: string;
  name: string;
  applications: Application[];
  users?: OrganisationUser[];
}

interface SidebarProps {
  organisations: Organisation[];
  selectedOrg: Organisation | null;
  isDeletingOrg: string | null;
  onOrgSelect: (org: Organisation | null) => void;
  onAppSelect: (app: Application | null) => void;
  onCreateOrg: () => void;
  onCreateApp: () => void;
  onDeleteOrg: (orgName: string, e: React.MouseEvent) => void;
  onDeleteApp: (appName: string, e: React.MouseEvent) => void;
}

const Sidebar: React.FC<SidebarProps> = ({
  organisations,
  selectedOrg,
  isDeletingOrg,
  onOrgSelect,
  onAppSelect,
  onCreateOrg,
  onCreateApp,
  onDeleteOrg,
  onDeleteApp,
}) => {
  const isOrgAdmin = () => true; // Placeholder

  if (selectedOrg) {
    return (
      <div className="w-80 bg-white/5 backdrop-blur-xl border-r border-white/10 flex flex-col">
        {/* App View Header */}
        <div className="p-6 border-b border-white/10">
          <button onClick={() => onOrgSelect(null)} className="flex items-center space-x-2 text-white/60 hover:text-white mb-4">
            <ArrowLeft size={16} />
            <span>All Organizations</span>
          </button>
          <div className="flex items-center space-x-3 mb-6">
            <div className="w-10 h-10 bg-gradient-to-r from-blue-400 to-purple-500 rounded-lg flex items-center justify-center">
              <Building2 size={18} className="text-white" />
            </div>
            <div>
              <h1 className="text-xl font-bold text-white truncate">{selectedOrg.name}</h1>
              <p className="text-xs text-white/60">Application Management</p>
            </div>
          </div>
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-semibold text-white/80 uppercase tracking-wider">Applications</h2>
            <span className="text-xs text-white/50 bg-white/10 px-2 py-1 rounded-full">{selectedOrg.applications?.length || 0}</span>
          </div>
        </div>

        {/* Applications List */}
        <div className="flex-1 overflow-y-auto p-4 space-y-2">
          {selectedOrg.applications.map((app) => (
            <div
              key={app.id}
              onClick={() => onAppSelect(app)}
              className="group p-4 rounded-xl cursor-pointer transition-all duration-300 bg-white/5 hover:bg-white/10 border border-white/10"
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-3">
                  <div className="w-10 h-10 rounded-lg flex items-center justify-center bg-white/10">
                    <Zap size={18} className="text-white" />
                  </div>
                  <div>
                    <h3 className="font-semibold text-white">{app.application}</h3>
                    <p className="text-xs text-white/60">{app.versions?.length || 0} versions</p>
                  </div>
                </div>
                <button
                  onClick={(e) => onDeleteApp(app.application, e)}
                  className="p-1.5 rounded-lg bg-red-500/10 text-red-400 hover:bg-red-500/20 transition-colors"
                >
                  <Trash2 size={14} />
                </button>
              </div>
            </div>
          ))}
        </div>

        {/* Add Application Button */}
        <div className="p-4 border-t border-white/10">
          <button
            onClick={onCreateApp}
            className="w-full p-4 bg-gradient-to-r from-green-500 to-teal-600 hover:from-green-600 hover:to-teal-700 text-white rounded-xl font-semibold transition-all duration-300 transform hover:scale-105 shadow-lg shadow-green-500/20"
          >
            <div className="flex items-center justify-center space-x-2">
              <Plus size={18} />
              <span>New Application</span>
            </div>
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="w-80 bg-white/5 backdrop-blur-xl border-r border-white/10 flex flex-col">
      {/* Org View Header */}
      <div className="p-6 border-b border-white/10">
        <div className="flex items-center justify-between">
          <h1 className="text-lg font-bold text-white">Organizations</h1>
          <span className="text-xs text-white/50 bg-white/10 px-2 py-1 rounded-full">{organisations.length}</span>
        </div>
      </div>

      {/* Organizations List */}
      <div className="flex-1 overflow-y-auto p-4 space-y-2">
        {organisations.map((org) => (
          <div
            key={org.name}
            onClick={() => onOrgSelect(org)}
            className={`group relative p-4 rounded-xl cursor-pointer transition-all duration-300 ${
              selectedOrg?.name === org.name 
                ? "bg-gradient-to-r from-blue-500/20 to-purple-500/20 border border-blue-400/30 shadow-lg shadow-blue-500/10" 
                : "bg-white/5 hover:bg-white/10 border border-white/10"
            }`}
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-3 flex-1 min-w-0">
                <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${
                  selectedOrg?.name === org.name 
                    ? "bg-gradient-to-r from-blue-400 to-purple-500" 
                    : "bg-white/10"
                }`}>
                  <Building2 size={18} className="text-white" />
                </div>
                <div className="flex-1 min-w-0">
                  <h3 className="font-semibold text-white truncate">{org.name}</h3>
                  <p className="text-xs text-white/60">{org.applications?.length || 0} apps</p>
                </div>
              </div>
              <div className="flex items-center space-x-2">
                {isOrgAdmin() && (
                  <button
                    onClick={(e) => onDeleteOrg(org.name, e)}
                    className={`p-1.5 rounded-lg bg-red-500/10 text-red-400 hover:bg-red-500/20 transition-colors ${
                      isDeletingOrg === org.name ? "opacity-50 cursor-not-allowed" : ""
                    }`}
                    disabled={isDeletingOrg === org.name}
                  >
                    <Trash2 size={14} />
                  </button>
                )}
                <ChevronRight size={16} className="text-white/40" />
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Add Organization Button */}
      <div className="p-4 border-t border-white/10">
        <button
          onClick={onCreateOrg}
          className="w-full p-4 bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-600 hover:to-blue-700 text-white rounded-xl font-semibold transition-all duration-300 transform hover:scale-105 shadow-lg shadow-blue-500/20"
        >
          <div className="flex items-center justify-center space-x-2">
            <Plus size={18} />
            <span>New Organization</span>
          </div>
        </button>
      </div>
    </div>
  );
};

export default Sidebar;
