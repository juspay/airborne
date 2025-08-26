import { Outlet, useNavigate } from "react-router-dom";
import Sidebar from "./Sidebar";
import Header from "../Header";
import { Configuration } from "../../types";
import { useUser } from "../../hooks/useUser";

interface DashboardLayoutProps {
  configuration: Configuration;
}

export default function DashboardLayout({ 
  configuration 
}: DashboardLayoutProps) {
  const {user,logout}= useUser();
  const navigate = useNavigate();

  const handleLogout = () => {
    try {
      logout();
      navigate("/dashboard/", { replace: true });
    } catch (error) {
      console.error("Error logging out:", error);
    }
  };

  // All navigation logic moved to Sidebar component

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900 relative overflow-hidden">
      {/* Animated Background Elements */}
      <div className="absolute inset-0 overflow-hidden">
        <div className="absolute -top-40 -right-40 w-80 h-80 bg-gradient-to-r from-purple-400 to-pink-400 rounded-full mix-blend-multiply filter blur-xl opacity-20 animate-blob"></div>
        <div className="absolute -bottom-40 -left-40 w-80 h-80 bg-gradient-to-r from-cyan-400 to-blue-400 rounded-full mix-blend-multiply filter blur-xl opacity-20 animate-blob animation-delay-2000"></div>
        <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 w-80 h-80 bg-gradient-to-r from-indigo-400 to-purple-400 rounded-full mix-blend-multiply filter blur-xl opacity-20 animate-blob animation-delay-4000"></div>
      </div>

      <Header
        userName={user.name}
        userEmail={user.email}
        onLogout={handleLogout}
      />
      
      <div className="flex h-[calc(100vh-4rem)] relative z-10">
        <Sidebar
          configuration={configuration}
        />

        <main className="flex-1 relative overflow-y-auto">
          <Outlet />
        </main>
      </div>
    </div>
  );

}