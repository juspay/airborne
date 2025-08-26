import React, { useEffect, useState } from "react";
import {
  Building2,
  Zap,
  ArrowLeft,
  ChevronDown,
  ChevronRight,
} from "lucide-react";
import { useNavigate, useParams } from "react-router-dom";
import { Application, Configuration, Organisation } from "../../types";
import CreateOrganization from "../organization/CreateOrganization";
import { useUser } from "../../hooks/useUser";
import RequestAccess from "../organization/RequestAccess";
import DeleteOrganisation from "../organization/DeleteOrganisation";
import DeleteApplication from "../organization/application/DeleteApplication";
import CreateApplication from "../organization/application/CreateApplication";

interface SidebarProps {
  configuration: Configuration;
}

const applicationMenuItems = [
  { label: "Dashboard", path: "" },
  { label: "Current Release Info", path: "release"},
  { label: "Release History", path: "release-history" },
  { label: "Release Views", path: "release-views" },
  { label: "Manage Dimensions", path: "dimensions" }
];

const Sidebar: React.FC<SidebarProps> = ({ configuration }) => {
  const { user } = useUser();
  const organisations = user.organisations;
  const navigate = useNavigate();
  const { org: orgParam, app: appParam } = useParams();
  const [expandedApp, setExpandedApp] = useState<string | null>(null);
  const [selectedOrg, setSelectedOrg] = useState<Organisation | null>(null);

  const handleOrgSelect = (org: Organisation | null) => {
    if (org) {
      navigate(`/dashboard/${encodeURIComponent(org.name)}`);
    } else {
      navigate("/dashboard");
    }
  };

  const handleAppSelect = (app: Application) => {
    if (selectedOrg) {
      navigate(
        `/dashboard/${encodeURIComponent(
          selectedOrg.name
        )}/${encodeURIComponent(app.application)}`
      );
      setExpandedApp(app.application);
    }
  };

  useEffect(() => {
    if (!user) return;

    // find org by URL param
    const org = user.organisations.find(
      (o) => o.name === decodeURIComponent(orgParam ?? "")
    );
    setSelectedOrg(org ?? null);

    // find app inside org by URL param
    if (org && appParam) {
      const app = org.applications.find(
        (a) => a.application === decodeURIComponent(appParam)
      );
      setExpandedApp(app?.application ?? null);
    } else{
      setExpandedApp(null);
    }
  }, [user, orgParam, appParam]);

  if (selectedOrg) {
    return (
      <div className="w-80 bg-white/5 backdrop-blur-xl border-r border-white/10 flex flex-col">
        {/* App View Header */}
        <div className="p-6 border-b border-white/10">
          <button
            onClick={() => handleOrgSelect(null)}
            className="flex items-center space-x-2 text-white/60 hover:text-white mb-4"
          >
            <ArrowLeft size={16} />
            <span>All Organizations</span>
          </button>
          <div className="flex items-center space-x-3 mb-6">
            <div className="w-10 h-10 bg-gradient-to-r from-blue-400 to-purple-500 rounded-lg flex items-center justify-center">
              <Building2 size={18} className="text-white" />
            </div>
            <div>
              <h1 className="text-xl font-bold text-white truncate">
                {selectedOrg.name}
              </h1>
              <p className="text-xs text-white/60">Application Management</p>
            </div>
          </div>
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-semibold text-white/80 uppercase tracking-wider">
              Applications
            </h2>
            <span className="text-xs text-white/50 bg-white/10 px-2 py-1 rounded-full">
              {selectedOrg.applications?.length || 0}
            </span>
          </div>
        </div>

        {/* Applications List */}
        <div className="flex-1 overflow-y-auto p-4 space-y-2">
          {selectedOrg.applications.map((app) => (
            <div
              key={app.application}
              onClick={() => handleAppSelect(app)}
              className="group p-4 rounded-xl cursor-pointer transition-all duration-300 bg-white/5 hover:bg-white/10 border border-white/10"
            >
              <div className="flex flex-col space-y-2">
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-3">
                    <div className="w-10 h-10 rounded-lg flex items-center justify-center bg-white/10">
                      <Zap size={18} className="text-white" />
                    </div>
                    <div>
                      <h3 className="font-semibold text-white">
                        {app.application}
                      </h3>
                    </div>
                  </div>
                  <div className="flex items-center space-x-2">
                    <DeleteApplication application={app} />
                    {expandedApp === app.application ? (
                      <ChevronDown
                        onClick={(e) => {
                          e.stopPropagation();
                          setExpandedApp(null);
                        }}
                        size={16}
                        className="text-white/40 hover:text-white/60 cursor-pointer transition-colors"
                      />
                    ) : (
                      <ChevronRight
                        onClick={(e) => {
                          e.stopPropagation();
                          setExpandedApp(app.application);
                        }}
                        size={16}
                        className="text-white/40 hover:text-white/60 cursor-pointer transition-colors"
                      />
                    )}
                  </div>
                </div>
                {expandedApp === app.application && (
                  <div className="pl-13 space-y-1">
                    {applicationMenuItems.map((item) => (
                      <div
                        key={item.path}
                        onClick={(e) => {
                          e.stopPropagation();
                          navigate(
                            `/dashboard/${encodeURIComponent(
                              selectedOrg.name
                            )}/${encodeURIComponent(app.application)}/${
                              item.path
                            }`
                          );
                        }}
                        className="flex items-center space-x-2 p-2 rounded-lg hover:bg-white/10 text-white/70 hover:text-white cursor-pointer"
                      >
                        <div className="w-1.5 h-1.5 rounded-full bg-white/50"></div>
                        <span className="text-sm">{item.label}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>

        {/* Add Application Button */}
        <div className="p-4 border-t border-white/10 flex items-center justify-center">
          <CreateApplication text="New Application" />
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
          <span className="text-xs text-white/50 bg-white/10 px-2 py-1 rounded-full">
            {organisations.length}
          </span>
        </div>
      </div>

      {/* Organizations List */}
      <div className="flex-1 overflow-y-auto p-4 space-y-2">
        {organisations.map((org) => (
          <div
            key={org.name}
            onClick={() => handleOrgSelect(org)}
            className={`group relative p-4 rounded-xl cursor-pointer transition-all duration-300 ${
              selectedOrg?.name === org.name
                ? "bg-gradient-to-r from-blue-500/20 to-purple-500/20 border border-blue-400/30 shadow-lg shadow-blue-500/10"
                : "bg-white/5 hover:bg-white/10 border border-white/10"
            }`}
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-3 flex-1 min-w-0">
                <div
                  className={`w-10 h-10 rounded-lg flex items-center justify-center ${
                    selectedOrg?.name === org.name
                      ? "bg-gradient-to-r from-blue-400 to-purple-500"
                      : "bg-white/10"
                  }`}
                >
                  <Building2 size={18} className="text-white" />
                </div>
                <div className="flex-1 min-w-0">
                  <h3 className="font-semibold text-white truncate">
                    {org.name}
                  </h3>
                  <p className="text-xs text-white/60">
                    {org.applications?.length || 0} apps
                  </p>
                </div>
              </div>
              <DeleteOrganisation organisation={org} />
            </div>
          </div>
        ))}
      </div>

      <div className="p-4 border-t border-white/10">
        {configuration.organisationCreationDisabled &&
        (!user.organisations || user.organisations.length === 0) ? (
          <RequestAccess />
        ) : (
          <CreateOrganization text="Create New Organization" />
        )}
      </div>
    </div>
  );
};

export default Sidebar;
