import { useNavigate, useParams } from 'react-router-dom'
import { Package } from 'lucide-react'
import { useUser } from '../../hooks/useUser';
import { ReleaseEntry } from '../organization/application/ApplicationDashboard';





interface ReleaseListProps {
  releases?: ReleaseEntry[];
  isLoading?: boolean;
}

const ReleaseList: React.FC<ReleaseListProps> = ({ releases, isLoading }: ReleaseListProps) => {
  const navigate = useNavigate();
  const {user} = useUser();
  const {org: orgParam, app: appParam} = useParams();
  const org = decodeURIComponent(orgParam || '');
  const app = decodeURIComponent(appParam || '');
  const organization = user.organisations.find(o => o.name === org);
  const application = organization?.applications.find(a => a.application === app);
  
  const handleReleaseClick = (release: ReleaseEntry) => {
    navigate(`/dashboard/${organization.name}/${application.application}/release/${release.id}`);
  };

  return (
    <div className="bg-white/10 backdrop-blur-xl rounded-2xl border border-white/20 p-6 shadow-xl ">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h4 className="text-xl font-semibold text-white">Active Releases</h4>
          <p className="text-white/60">
            View all active releases for this application ({releases.length} total)
          </p>
        </div>
      </div>

      {/* Loading state */}
      {isLoading ? (
        <div className="flex items-center justify-center py-12">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-white"></div>
        </div>
      ) : (
        <div className="space-y-4 overflow-y-auto">
          {releases.length > 0 ? (
            releases.map((release) => (
              <div
                key={release.id}
                className="bg-white/5 border border-white/10 rounded-lg p-4 hover:bg-white/10 transition-colors cursor-pointer"
                onClick={() => handleReleaseClick(release)}
              >
                <div className="flex items-start justify-between mb-3">
                  <div className="flex-1">
                    <div className="flex items-center space-x-3">
                      <h5 className="text-white font-medium">Release {release.id.slice(0, 8)}</h5>
                      <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-green-500/20 text-green-200 border border-green-400/30">
                        v{release.package_version}
                      </span>
                    </div>
                    <p className="text-white/60 text-sm mt-1">
                      Config: {release.config_version} • Created by: {release.created_by}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="text-white/60 text-sm">
                      {new Date(release.created_at).toLocaleDateString()}
                    </p>
                    <p className="text-white/40 text-xs">
                      {new Date(release.created_at).toLocaleTimeString()}
                    </p>
                  </div>
                </div>
                
              </div>
            ))
          ) : (
            // Empty state
            <div className="text-center py-12">
              <div className="w-16 h-16 bg-gradient-to-r from-gray-400/20 to-gray-500/20 rounded-2xl flex items-center justify-center mx-auto mb-4">
                <Package size={28} className="text-white/40" />
              </div>
              <p className="text-white/60">No releases found</p>
              <p className="text-white/40 text-sm mt-1">
                Create your first release to see it here
              </p>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

export default ReleaseList