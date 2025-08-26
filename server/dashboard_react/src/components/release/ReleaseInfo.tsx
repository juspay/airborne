import { useState, useEffect} from "react";
import { Package, ChevronDown, ChevronUp, Rocket } from "lucide-react";
import axios from "../../api/axios";
import ReleaseWorkflow from "./ReleaseWorkflow";
import { ReleaseInfo as ReleaseInfoData } from "./Release";
import { useUser } from "../../hooks/useUser";
import { useParams } from "react-router-dom";

interface ReleaseInfoProps {
  dimensions?: Array<{key: string; value: string}>;
  onReleaseCreated?: () => void;
}



const ReleaseInfo: React.FC<ReleaseInfoProps> = ({ dimensions, onReleaseCreated }) => {
  const {user} = useUser();
  const {org: orgParam, app: appParam} = useParams();
  const org = decodeURIComponent(orgParam || '');
  const app = decodeURIComponent(appParam || '');
  const organization = user.organisations.find(o => o.name === org);
  const application = organization?.applications.find(a => a.application === app);
  const [releaseInfo, setReleaseInfo] = useState<ReleaseInfoData | null>(null);
  const [loadingRelease, setLoadingRelease] = useState(true);
  const [showConfigDetails, setShowConfigDetails] = useState(false);
  const [isReleaseModalOpen, setIsReleaseModalOpen] = useState(false);

  const handleRelease = () => {
    setIsReleaseModalOpen(true);
  };

  const handleCloseRelease = () => {
    setIsReleaseModalOpen(false);
  };

  const fetchReleaseInfo = async () => {
    if (!application) return;

    setLoadingRelease(true);
    try {
      const { data } = await axios.get(
        `/release/v2/${organization.name}/${application.application}`
      );
      setReleaseInfo(data);
    } catch (error) {
      console.error("Failed to fetch release info:", error);
      setReleaseInfo(null);
    } finally {
      setLoadingRelease(false);
    }
  };

  useEffect(() => {
    

    fetchReleaseInfo();
  }, [application, organization.name]);

  // If release modal is open, show the release workflow
  if (isReleaseModalOpen) {
    return (
      <ReleaseWorkflow
        application={application}
        organization={organization}
        onClose={handleCloseRelease}
        onComplete={() => {
          handleCloseRelease();
          fetchReleaseInfo();
          if (onReleaseCreated) onReleaseCreated();
        }}
        dimensions={dimensions}
        onReleaseCreated={onReleaseCreated}
      />
    );
  }


  return (
    <div className="bg-white/10 backdrop-blur-xl rounded-2xl border border-white/20 p-6 shadow-xl">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h4 className="text-xl font-semibold text-white">Current Release</h4>
          <p className="text-white/60">Active deployment information</p>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={handleRelease}
            className="px-6 py-3 bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-600 hover:to-blue-700 text-white rounded-xl font-semibold transition-all duration-300 transform hover:scale-105 shadow-lg shadow-blue-500/20 flex items-center"
          >
            <Rocket size={18} className="mr-2" />
            Create Release
          </button>
          {loadingRelease ? (
            <div className="animate-pulse bg-white/20 h-8 w-24 rounded-lg"></div>
          ) : releaseInfo ? (
            <div className="flex items-center gap-3">
              <div className="px-3 py-1 bg-green-500/20 text-green-400 rounded-full text-sm font-medium border border-green-500/30">
                Live
              </div>
              <span className="text-xl font-bold text-white">v{releaseInfo.package.version}</span>
            </div>
          ) : (
            <span className="text-white/50">No release found</span>
          )}
        </div>
      </div>

      {releaseInfo ? (
        <div className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="bg-white/5 rounded-xl p-4 border border-white/10">
              <h5 className="text-white font-medium mb-2">Configuration</h5>
              <div className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-white/60">Config Version:</span>
                  <span className="text-white font-mono">{releaseInfo.config.version}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-white/60">Release Timeout:</span>
                  <span className="text-white font-mono">{releaseInfo.config.release_config_timeout}ms</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-white/60">Package Timeout:</span>
                  <span className="text-white font-mono">{releaseInfo.config.package_timeout}ms</span>
                </div>
              </div>
            </div>
            
            <div className="bg-white/5 rounded-xl p-4 border border-white/10">
              <h5 className="text-white font-medium mb-2">Package Info</h5>
              <div className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-white/60">Package Name:</span>
                  <span className="text-white font-mono">{releaseInfo.package.name}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-white/60">Important Files:</span>
                  <span className="text-white font-mono">{releaseInfo.package.important.length}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-white/60">Lazy Files:</span>
                  <span className="text-white font-mono">{releaseInfo.package.lazy.length}</span>
                </div>
                <div className="col-span-2">
                  <span className="text-white/60">Assets Domain:</span>
                  <div className="text-white font-mono text-xs mt-1 break-all bg-white/5 p-2 rounded border border-white/10">
                    {releaseInfo.config.properties.tenant_info.assets_domain}
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Expandable Config Details */}
          <div className="border-t border-white/10 pt-4">
            <button
              onClick={() => setShowConfigDetails(!showConfigDetails)}
              className="flex items-center justify-between w-full p-3 bg-white/5 hover:bg-white/10 rounded-xl border border-white/10 transition-all duration-200"
            >
              <span className="text-white font-medium">Complete Configuration</span>
              {showConfigDetails ? <ChevronUp size={20} className="text-white/60" /> : <ChevronDown size={20} className="text-white/60" />}
            </button>
            {showConfigDetails && (
              <div className="mt-4 bg-black/20 rounded-xl p-4 border border-white/10 overflow-auto max-h-96">
                <pre className="text-xs text-white/80">
                  {JSON.stringify(releaseInfo, null, 2)}
                </pre>
              </div>
            )}
          </div>
        </div>
      ) : (
        <div className="text-center py-8">
          <div className="w-16 h-16 bg-gradient-to-r from-gray-400/20 to-gray-500/20 rounded-2xl flex items-center justify-center mx-auto mb-4">
            <Package size={28} className="text-white/40" />
          </div>
          <p className="text-white/60">No release information available</p>
        </div>
      )}
    </div>
  );
};



export default ReleaseInfo;
