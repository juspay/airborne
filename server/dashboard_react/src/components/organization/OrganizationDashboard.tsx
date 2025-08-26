import { AppWindow } from "lucide-react";
import { useUser } from "../../hooks/useUser";
import { useNavigate, useParams } from "react-router-dom";
import CreateApplication from "./application/CreateApplication";

const OrganizationDashboard = () => {
  const navigate = useNavigate();
  const { org: encodedOrg } = useParams();
  const org = decodeURIComponent(encodedOrg || '');
  const { user } = useUser();
  const selectedOrganization = user.organisations.find((o) => o.name === org);

  return (
    <div className="h-full p-8 overflow-y-auto">
      <div className="bg-white/10 backdrop-blur-xl rounded-2xl border border-white/20 shadow-xl overflow-hidden">
        <div className="px-6 py-6 border-b border-white/10">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-xl font-semibold text-white mb-1">
                Applications
              </h3>
              <p className="text-white/60 text-sm">
                Manage your application deployments
              </p>
            </div>
            <CreateApplication text="Create New Application" />
          </div>
        </div>

        <div className="p-4">
          {selectedOrganization.applications.length > 0 ? (
            <div className="space-y-3">
              {selectedOrganization.applications.map((app) => (
                <button
                  key={app.application}
                  onClick={() =>
                    navigate(`/dashboard/${org}/${app.application}`)
                  }
                  className={`w-full p-6 rounded-xl transition-all duration-300 border bg-gradient-to-r from-blue-500/20 to-purple-500/20 border-blue-400/30 shadow-lg shadow-blue-500/10 `}
                >
                  <div className="flex items-center">
                    <div
                      className={`w-12 h-12 rounded-xl flex items-center justify-center mr-4 bg-gradient-to-r from-blue-400 to-purple-500" `}
                    >
                      <AppWindow size={24} className="text-white" />
                    </div>
                    <div className="flex-1 text-left">
                      <h4 className="font-semibold text-white text-lg">
                        {app.application}
                      </h4>
                    </div>
                  </div>
                </button>
              ))}
            </div>
          ) : (
            <div className="text-center py-16">
              <div className="w-20 h-20 bg-gradient-to-r from-gray-400/20 to-gray-500/20 rounded-2xl flex items-center justify-center mx-auto mb-6">
                <AppWindow size={32} className="text-white/40" />
              </div>
              <h3 className="text-xl font-semibold text-white mb-2">
                No Applications Yet
              </h3>
              <p className="text-white/60 mb-6 max-w-md mx-auto">
                Create your first application to start deploying over-the-air
                updates
              </p>
              <div className="flex justify-center items-center">
                <CreateApplication text="Create First Application" />
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default OrganizationDashboard;
