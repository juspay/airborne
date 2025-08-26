import {  useParams } from "react-router-dom";
import ReleaseInfo from "../../release/ReleaseInfo";
import {
  Activity,
  AppWindow,
} from "lucide-react";
import ReleaseList from "../../release/ReleaseList";
import { useEffect, useState } from "react";
import axios from "../../../api/axios";


export interface ReleaseEntry {
  id: string;
  package_version: number;
  config_version: string;
  created_at: string;
  created_by: string;
  metadata: Record<string, any>;
}


const ApplicationDashboard = () => {
  const { org: orgParam, app: appParam } = useParams();
  const org = decodeURIComponent(orgParam || "");
  const app = decodeURIComponent(appParam || "");
  
  const [releases, setReleases] = useState<ReleaseEntry[]>([]);
  const [isLoadingReleases, setIsLoadingReleases] = useState(false);


  const fetchReleases = async () => {
    if (!app) return;
    
    setIsLoadingReleases(true);
    try {
      const { data } = await axios.get(
        `/organisations/applications/release/list`,
        {
          headers: {
            "x-application": app,
            "x-organisation": org,
          },
        }
      );
      setReleases(data.releases || []);
    } catch (error) {
      console.error("Error fetching releases:", error);
      setReleases([]);
    } finally {
      setIsLoadingReleases(false);
    }
  };

  useEffect(() => {
    if (app) {
      fetchReleases();
    }
  }, [app, org]);

  return (
    <div className="space-y-6 pb-6 h-full p-8 overflow-y-auto">
      {/* Header */}
      <div className="bg-white/10 backdrop-blur-xl rounded-2xl border border-white/20 p-6 shadow-xl">
        <div className="flex items-center justify-between">
          <div className="flex items-center">
            <div className="flex items-center">
              <div className="w-12 h-12 bg-gradient-to-r from-blue-400 to-purple-500 rounded-xl flex items-center justify-center mr-4">
                <AppWindow size={24} className="text-white" />
              </div>
              <div>
                <h3 className="text-2xl font-bold text-white">
                  {app}
                </h3>
                <p className="text-white/60">Application Details</p>
              </div>
            </div>
          </div>
          <div className="flex items-center space-x-3">
            <div className="px-3 py-1 bg-green-500/20 text-green-400 rounded-full text-sm font-medium border border-green-500/30">
              <Activity size={14} className="inline mr-1" />
              Active
            </div>
          </div>
        </div>
      </div>

      <ReleaseInfo onReleaseCreated={fetchReleases} />
      <ReleaseList releases={releases} isLoading={isLoadingReleases} />

    </div>
  );
};

export default ApplicationDashboard;
