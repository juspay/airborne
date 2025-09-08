import { useState, useEffect } from "react";
import {
  Search,
  Plus,
  Mail,
  Users,
  UserPlus,
  Crown,
  ArrowLeft,
  UserRoundX,
  PencilLineIcon,
  BookLockIcon,
} from "lucide-react";
import { Application } from "../../types";
import { applicationUserService } from "../../services/applicationUserService";

interface ApplicationUser {
  id: string;
  username: string;
  email: string;
  roles: string[];
}

interface ApplicationUserManagementProps {
  application: Application;
  organization: { name: string };
  onInviteUser: (email: string, role: string) => void;
  onRemoveUser: (username: string) => void;
  onUpdateUser?: (username: string, role: string) => void;
}

export function ApplicationUserManagement({
  application,
  organization,
  onInviteUser,
  onRemoveUser,
}: ApplicationUserManagementProps) {
  const [activeTab, setActiveTab] = useState<"members" | "invite">("members");
  const [userSearchQuery, setUserSearchQuery] = useState("");
  const [inviteEmail, setInviteEmail] = useState("");
  const [selectedRole, setSelectedRole] = useState<"ADMIN" | "READ" | "WRITE">("READ");
  const [users, setUsers] = useState<ApplicationUser[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Load users when component mounts
  useEffect(() => {
    loadUsers();
  }, [organization.name, application.application]);

  const loadUsers = async () => {
    try {
      setLoading(true);
      setError(null);
      const response = await applicationUserService.listUsers(organization.name, application.application);
      setUsers(response.users);
    } catch (err) {
      console.error("Failed to load users:", err);
      setError("Failed to load users");
    } finally {
      setLoading(false);
    }
  };

  const handleInviteUser = async () => {
    if (inviteEmail.trim()) {
      try {
        await applicationUserService.addUser(organization.name, application.application, {
          user: inviteEmail.trim(),
          access: selectedRole.toLowerCase()
        });
        onInviteUser(inviteEmail.trim(), selectedRole.toLowerCase());
        setInviteEmail("");
        setActiveTab("members");
        await loadUsers(); // Refresh the list
      } catch (err: any) {
        console.error("Failed to invite user:", err);
        // Extract error message from response if available
        const errorMessage = err?.response?.data?.message || 
                            err?.response?.data || 
                            err?.message || 
                            "Failed to invite user";
        setError(typeof errorMessage === 'string' ? errorMessage : "Failed to invite user");
      }
    }
  };

  const handleRemoveUser = async (username: string) => {
    if (
      prompt(
        `Are you sure you want to remove ${username} from ${application.application}? This action cannot be undone. Type "remove" to confirm.`,
        ""
      )?.toLowerCase() === "remove"
    ) {
      try {
        await applicationUserService.removeUser(organization.name, application.application, username);
        onRemoveUser(username);
        await loadUsers(); // Refresh the list
      } catch (err: any) {
        console.error("Failed to remove user:", err);
        // Extract error message from response if available
        const errorMessage = err?.response?.data?.message || 
                            err?.response?.data || 
                            err?.message || 
                            "Failed to remove user";
        setError(typeof errorMessage === 'string' ? errorMessage : "Failed to remove user");
      }
    }
  };

  // const handleUpdateUserRole = async (username: string, newRole: string) => {
  //   if (onUpdateUser) {
  //     try {
  //       await applicationUserService.updateUser(organization.name, application.application, {
  //         user: username,
  //         access: newRole
  //       });
  //       onUpdateUser(username, newRole);
  //       await loadUsers(); // Refresh the list
  //     } catch (err: any) {
  //       console.error("Failed to update user role:", err);
  //       // Extract error message from response if available
  //       const errorMessage = err?.response?.data?.message || 
  //                           err?.response?.data || 
  //                           err?.message || 
  //                           "Failed to update user role";
  //       setError(typeof errorMessage === 'string' ? errorMessage : "Failed to update user role");
  //     }
  //   }
  // };

  // Check if current user has admin access in this application
  const hasAdminAccess = application.access.includes("admin");

  // Filter users based on search query
  const filteredUsers = users.filter((user) =>
    user.username.toLowerCase().includes(userSearchQuery.toLowerCase()) ||
    user.email?.toLowerCase().includes(userSearchQuery.toLowerCase())
  );

  const getRoleIcon = (role: string) => {
    switch (role.toLowerCase()) {
      case "admin":
        return <Crown size={16} className="text-yellow-400" />;
      case "write":
        return <PencilLineIcon size={16} className="text-green-400" />;
      case "read":
        return <BookLockIcon size={16} className="text-blue-400" />;
      default:
        return <Users size={16} className="text-gray-400" />;
    }
  };

  const getRoleBadgeColor = (role: string) => {
    switch (role.toLowerCase()) {
      case "admin":
        return "bg-yellow-500/20 text-yellow-400 border-yellow-500/30";
      case "write":
        return "bg-green-500/20 text-green-400 border-green-500/30";
      case "read":
        return "bg-blue-500/20 text-blue-400 border-blue-500/30";
      default:
        return "bg-gray-500/20 text-gray-400 border-gray-500/30";
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-16">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-white"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {error && (
        <div className="bg-red-500/20 border border-red-500/30 text-red-400 px-4 py-3 rounded-xl">
          {error}
          <button
            onClick={() => setError(null)}
            className="ml-4 text-red-300 hover:text-red-100"
          >
            ×
          </button>
        </div>
      )}

      {/* Members Tab Content */}
      {activeTab === "members" && (
        <div className="bg-white/10 backdrop-blur-xl rounded-2xl border border-white/20 shadow-xl overflow-hidden">
          {/* Header */}
          <div className="px-6 py-6 border-b border-white/10">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-xl font-semibold text-white mb-1">
                  Application Members
                </h3>
                <p className="text-white/60 text-sm">
                  Manage access to {application.application}
                </p>
              </div>
              {hasAdminAccess && (
                <button
                  onClick={() => setActiveTab("invite")}
                  className="px-6 py-3 bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-600 hover:to-blue-700 text-white rounded-xl font-semibold transition-all duration-300 transform hover:scale-105 shadow-lg shadow-blue-500/20 flex items-center"
                >
                  <Plus size={18} className="mr-2" />
                  Add User
                </button>
              )}
            </div>

            {/* Search */}
            <div className="mt-6">
              <div className="relative">
                <Search
                  size={20}
                  className="absolute left-4 top-1/2 transform -translate-y-1/2 text-white/50"
                />
                <input
                  type="text"
                  placeholder="Search application members..."
                  className="w-full pl-12 pr-4 py-3 bg-white/10 border border-white/20 rounded-xl text-white placeholder-white/50 focus:outline-none focus:ring-2 focus:ring-cyan-400 focus:border-transparent backdrop-blur-sm transition-all duration-200"
                  value={userSearchQuery}
                  onChange={(e) => setUserSearchQuery(e.target.value)}
                />
              </div>
            </div>
          </div>

          {/* Members List */}
          <div className="p-6">
            {filteredUsers && filteredUsers.length > 0 ? (
              <div className="space-y-4">
                {filteredUsers.map((appUser) => (
                  <div
                    key={appUser.id}
                    className="bg-white/5 rounded-xl p-6 border border-white/10 hover:bg-white/10 transition-all duration-300"
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center">
                        <div className="w-12 h-12 bg-gradient-to-r from-cyan-400 to-blue-500 rounded-xl flex items-center justify-center mr-4 text-white font-bold text-lg">
                          {appUser?.username?.charAt(0).toUpperCase() || "U"}
                        </div>
                        <div>
                          <h4 className="font-semibold text-white text-lg">
                            {appUser.username || "Unknown User"}
                          </h4>
                        </div>
                      </div>
                      <div className="flex items-center gap-3">
                        {/* Role Badges */}
                        <div className="flex flex-wrap gap-2">
                          {appUser.roles.map((role) => (
                            <span
                              key={role}
                              className={`px-3 py-1 rounded-full text-xs font-semibold border flex items-center gap-1 ${getRoleBadgeColor(
                                role
                              )}`}
                            >
                              {getRoleIcon(role)}
                              {role.charAt(0).toUpperCase() + role.slice(1)}
                            </span>
                          ))}
                        </div>
                        {/* Action Buttons */}
                        {hasAdminAccess && (
                          <div className="flex gap-2">
                            {/* {onUpdateUser && (
                              <select
                                value={appUser.roles[0] || "read"}
                                onChange={(e) =>
                                  handleUpdateUserRole(appUser.username, e.target.value)
                                }
                                className="px-3 py-1 bg-white/10 border border-white/20 rounded-lg text-white text-sm focus:outline-none focus:ring-2 focus:ring-cyan-400"
                              >
                                <option value="read" className="bg-gray-800 text-white">
                                  Read
                                </option>
                                <option value="write" className="bg-gray-800 text-white">
                                  Write
                                </option>
                                <option value="admin" className="bg-gray-800 text-white">
                                  Admin
                                </option>
                              </select>
                            )} */}
                            <button
                              onClick={() => handleRemoveUser(appUser.username)}
                              className="p-2 rounded-lg bg-red-500/20 hover:bg-red-500/30 text-red-400 hover:text-red-300 transition-all duration-200 border border-red-500/30"
                              title="Remove user"
                            >
                              <UserRoundX size={16} />
                            </button>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-16">
                <div className="w-20 h-20 bg-gradient-to-r from-gray-400/20 to-gray-500/20 rounded-2xl flex items-center justify-center mx-auto mb-6">
                  <Users size={32} className="text-white/40" />
                </div>
                <h3 className="text-xl font-semibold text-white mb-2">
                  {userSearchQuery ? "No Members Found" : "No Members Yet"}
                </h3>
                <p className="text-white/60 mb-6 max-w-md mx-auto">
                  {userSearchQuery
                    ? `No members match "${userSearchQuery}"`
                    : hasAdminAccess
                    ? "Add the first member to this application."
                    : "No members have been added to this application yet."}
                </p>
                {hasAdminAccess && !userSearchQuery && (
                  <button
                    onClick={() => setActiveTab("invite")}
                    className="px-6 py-3 bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-600 hover:to-blue-700 text-white rounded-xl font-semibold transition-all duration-300 transform hover:scale-105 shadow-lg shadow-blue-500/20"
                  >
                    Add First Member
                  </button>
                )}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Invite Users Tab Content */}
      {activeTab === "invite" && (
        <div className="bg-white/10 backdrop-blur-xl rounded-2xl border border-white/20 shadow-xl p-8">
          {/* Header */}
          <div className="flex items-center mb-8">
            <button
              onClick={() => setActiveTab("members")}
              className="p-2 rounded-lg bg-white/10 hover:bg-white/20 text-white/80 hover:text-white transition-all duration-200 mr-4"
            >
              <ArrowLeft size={20} />
            </button>
            <div>
              <h3 className="text-2xl font-bold text-white">
                Add Application Member
              </h3>
              <p className="text-white/60">
                Add new members to {application.application}
              </p>
            </div>
          </div>

          {/* Invite Form */}
          <div className="space-y-6">
            {/* Email Input */}
            <div>
              <label className="block text-sm font-semibold text-white mb-3">
                Username
              </label>
              <div className="relative">
                <Mail
                  size={20}
                  className="absolute left-4 top-1/2 transform -translate-y-1/2 text-white/50"
                />
                <input
                  type="text"
                  placeholder="Enter username"
                  className="w-full pl-12 pr-4 py-3 bg-white/10 border border-white/20 rounded-xl text-white placeholder-white/50 focus:outline-none focus:ring-2 focus:ring-cyan-400 focus:border-transparent backdrop-blur-sm transition-all duration-200"
                  value={inviteEmail}
                  onChange={(e) => setInviteEmail(e.target.value)}
                />
              </div>
            </div>

            {/* Role Selection */}
            <div>
              <label className="block text-sm font-semibold text-white mb-3">
                Application Role & Permissions
              </label>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <button
                  type="button"
                  className={`p-6 rounded-xl border transition-all duration-300 text-left ${
                    selectedRole === "READ"
                      ? "bg-gradient-to-r from-blue-500/20 to-purple-500/20 border-blue-400/50 shadow-lg shadow-blue-500/10"
                      : "bg-white/5 border-white/20 hover:bg-white/10"
                  }`}
                  onClick={() => setSelectedRole("READ")}
                >
                  <div className="flex items-center mb-3">
                    <div
                      className={`w-10 h-10 rounded-lg flex items-center justify-center mr-3 ${
                        selectedRole === "READ"
                          ? "bg-gradient-to-r from-blue-400 to-purple-500"
                          : "bg-white/10"
                      }`}
                    >
                      <BookLockIcon size={20} className="text-white" />
                    </div>
                    <h4 className="font-semibold text-white">Read</h4>
                  </div>
                  <p className="text-white/60 text-sm">
                    Can view application releases and configurations but cannot make changes.
                  </p>
                </button>
                
                <button
                  type="button"
                  className={`p-6 rounded-xl border transition-all duration-300 text-left ${
                    selectedRole === "WRITE"
                      ? "bg-gradient-to-r from-blue-500/20 to-purple-500/20 border-blue-400/50 shadow-lg shadow-blue-500/10"
                      : "bg-white/5 border-white/20 hover:bg-white/10"
                  }`}
                  onClick={() => setSelectedRole("WRITE")}
                >
                  <div className="flex items-center mb-3">
                    <div
                      className={`w-10 h-10 rounded-lg flex items-center justify-center mr-3 ${
                        selectedRole === "WRITE"
                          ? "bg-gradient-to-r from-blue-400 to-purple-500"
                          : "bg-white/10"
                      }`}
                    >
                      <PencilLineIcon size={20} className="text-white" />
                    </div>
                    <h4 className="font-semibold text-white">Write</h4>
                  </div>
                  <p className="text-white/60 text-sm">
                    Can create releases, manage configurations, and modify application settings.
                  </p>
                </button>
                
                <button
                  type="button"
                  className={`p-6 rounded-xl border transition-all duration-300 text-left ${
                    selectedRole === "ADMIN"
                      ? "bg-gradient-to-r from-blue-500/20 to-purple-500/20 border-blue-400/50 shadow-lg shadow-blue-500/10"
                      : "bg-white/5 border-white/20 hover:bg-white/10"
                  }`}
                  onClick={() => setSelectedRole("ADMIN")}
                >
                  <div className="flex items-center mb-3">
                    <div
                      className={`w-10 h-10 rounded-lg flex items-center justify-center mr-3 ${
                        selectedRole === "ADMIN"
                          ? "bg-gradient-to-r from-blue-400 to-purple-500"
                          : "bg-white/10"
                      }`}
                    >
                      <Crown size={20} className="text-white" />
                    </div>
                    <h4 className="font-semibold text-white">Admin</h4>
                  </div>
                  <p className="text-white/60 text-sm">
                    Full application control, including user management and all configurations.
                  </p>
                </button>
              </div>
            </div>

            {/* Action Buttons */}
            <div className="flex gap-4 pt-6">
              <button
                onClick={() => setActiveTab("members")}
                className="flex-1 px-6 py-3 bg-white/10 hover:bg-white/20 text-white rounded-xl font-semibold transition-all duration-300 border border-white/20"
              >
                Cancel
              </button>
              <button
                onClick={handleInviteUser}
                disabled={!inviteEmail.trim()}
                className={`flex-1 px-6 py-3 rounded-xl font-semibold transition-all duration-300 transform ${
                  inviteEmail.trim()
                    ? "bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-600 hover:to-blue-700 text-white hover:scale-105 shadow-lg shadow-blue-500/20"
                    : "bg-white/5 text-white/40 cursor-not-allowed border border-white/10"
                }`}
              >
                <div className="flex items-center justify-center">
                  <UserPlus size={18} className="mr-2" />
                  Add User
                </div>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
