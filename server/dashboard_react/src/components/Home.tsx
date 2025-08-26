import React, { useState } from "react";
import { Configuration, Organisation } from "../types";
import { useUser } from "../hooks/useUser";
import CreateOrganization from "./organization/CreateOrganization";
import RequestAccess from "./organization/RequestAccess";
import smallLogoImage from "../assets/airborne-cube-logo.png";
import { Building2, Users, Zap } from "lucide-react";
interface HomeProps {
  configuration: Configuration;
}

const Home: React.FC<HomeProps> = ({ configuration }) => {
  const { user } = useUser();

  const [organisations, _setOrganisations] = useState<Organisation[]>(
    user.organisations || []
  );

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900 relative overflow-hidden">
      {/* Animated Background Elements */}
      <div className="absolute inset-0 overflow-hidden">
        <div className="absolute -top-40 -right-40 w-80 h-80 bg-gradient-to-r from-purple-400 to-pink-400 rounded-full mix-blend-multiply filter blur-xl opacity-20 animate-blob"></div>
        <div className="absolute -bottom-40 -left-40 w-80 h-80 bg-gradient-to-r from-cyan-400 to-blue-400 rounded-full mix-blend-multiply filter blur-xl opacity-20 animate-blob animation-delay-2000"></div>
        <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 w-80 h-80 bg-gradient-to-r from-indigo-400 to-purple-400 rounded-full mix-blend-multiply filter blur-xl opacity-20 animate-blob animation-delay-4000"></div>
      </div>
      <div className="flex h-[calc(100vh-4rem)] relative z-10">
        <main className="flex-1 relative">
          <div className="h-full flex items-center justify-center p-8">
            <div className="text-center max-w-2xl">
              {/* Welcome Card */}
              <div className="bg-white/10 backdrop-blur-xl rounded-3xl p-12 border border-white/20 shadow-2xl">
                {/* Logo and Title */}
                <div className="mb-8">
                  <div className="w-20 h-20 bg-gradient-to-r from-cyan-400 to-blue-500 rounded-2xl flex items-center justify-center mx-auto mb-6 shadow-lg shadow-blue-500/20">
                    <img
                      src={smallLogoImage}
                      alt="Airborne Logo"
                      className="w-12 h-12"
                    />
                  </div>
                  <h1 className="text-4xl font-bold text-white mb-4 bg-gradient-to-r from-cyan-400 to-blue-400 bg-clip-text text-transparent">
                    Welcome to Airborne
                  </h1>
                  <p className="text-lg text-white/70 leading-relaxed">
                    {organisations.length === 0
                      ? "Create and manage your organizations to get started with over-the-air updates for your applications."
                      : "Select an organization from the sidebar to manage your applications and team members, or create a new organization."}
                  </p>
                </div>

                {/* Features Grid */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-10">
                  <div className="bg-white/5 rounded-2xl p-6 border border-white/10">
                    <div className="w-12 h-12 bg-gradient-to-r from-purple-400 to-pink-400 rounded-xl flex items-center justify-center mx-auto mb-4">
                      <Building2 size={24} className="text-white" />
                    </div>
                    <h3 className="font-semibold text-white mb-2">
                      Organizations
                    </h3>
                    <p className="text-sm text-white/60">
                      Manage multiple teams and projects
                    </p>
                  </div>

                  <div className="bg-white/5 rounded-2xl p-6 border border-white/10">
                    <div className="w-12 h-12 bg-gradient-to-r from-green-400 to-emerald-400 rounded-xl flex items-center justify-center mx-auto mb-4">
                      <Zap size={24} className="text-white" />
                    </div>
                    <h3 className="font-semibold text-white mb-2">
                      Applications
                    </h3>
                    <p className="text-sm text-white/60">
                      Deploy updates instantly
                    </p>
                  </div>

                  <div className="bg-white/5 rounded-2xl p-6 border border-white/10">
                    <div className="w-12 h-12 bg-gradient-to-r from-orange-400 to-red-400 rounded-xl flex items-center justify-center mx-auto mb-4">
                      <Users size={24} className="text-white" />
                    </div>
                    <h3 className="font-semibold text-white mb-2">Team</h3>
                    <p className="text-sm text-white/60">
                      Collaborate with your team
                    </p>
                  </div>
                </div>

                {/* CTA Button */}
                {organisations.length === 0 &&
                configuration.organisationCreationDisabled ? (
                  <RequestAccess />
                ) : (
                  <CreateOrganization text="Create New Organization" />
                )}

                <p className="mt-6 text-sm text-white/50">
                  {organisations.length === 0
                    ? "Start managing your applications and invite team members once your organization is set up."
                    : `You currently have ${organisations.length} organization${
                        organisations.length === 1 ? "" : "s"
                      }. Select one from the sidebar or create a new one.`}
                </p>
              </div>
            </div>
          </div>
        </main>
      </div>
    </div>
  );
};

export default Home;
