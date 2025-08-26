// Copyright 2025 Juspay Technologies
//
// Licensed under the Apache License, Version 2.0 (the "License");
// you may not use this file except in compliance with the License.
// You may obtain a copy of the License at
//
//    http://www.apache.org/licenses/LICENSE-2.0
//
// Unless required by applicable law or agreed to in writing, software
// distributed under the License is distributed on an "AS IS" BASIS,
// WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
// See the License for the specific language governing permissions and
// limitations under the License.

import React, { useState, useEffect } from "react";
import {
  BrowserRouter as Router,
  Routes,
  Route,
  Navigate,
} from "react-router-dom";
import { Login } from "./components/Login";
import { Signup } from "./components/Signup";
import Release from "./components/Release";
import Analytics from "./components/Analytics";
import axios from "./api/axios";
import Toast from "./components/Toast";
import { Configuration } from "./types";
import { useUser } from "./hooks/useUser";
import DashboardLayout from "./components/layouts/DashboardLayout";
import OrganizationDashboard from "./components/organization/OrganizationDashboard";
import Home from "./components/Home";
import ApplicationDashboard from "./components/organization/application/ApplicationDashboard";
import ReleaseViewsList from "./components/organization/release-views/ReleaseViewsList";
import DimensionPriority from "./components/dimension/DimensionPriority";
import ReleaseHistory from "./components/release/ReleaseHistory";


// // Response types
// type HomeResponse =
//   | { type: "CREATE_ORGANISATION"; name: string }
//   | { type: "CREATE_APPLICATION"; organisation: string; name: string }
//   | { type: "INVITE_USER"; organisation: string; email: string; role: string }
//   | {
//       type: "REQUEST_ORGANISATION";
//       orgName: string;
//       name: string;
//       email: string;
//       phoneNumber?: string;
//       appStoreLink?: string;
//       playStoreLink?: string;
//       errorCb?: (message: string) => void;
//       successCb?: () => void;
//     };

const App: React.FC = () => {
  // const [isAuthenticated, setIsAuthenticated] = useState<boolean>(false);
  // const [user, setUser] = useState<User | null>(null);
  const { user, isAuthenticated, checkAuth } = useUser();

  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [configurations, setConfigurations] = useState<Configuration>({
    enableGoogleSignIn: false,
    organisationCreationDisabled: false,
  });
  console.log("rendering app");

  const getGlobalConfigurations = async () => {
    try {
      const { data } = await axios.get("/dashboard/configuration/");
      console.log("Global Configurations:", data);
      setConfigurations({
        enableGoogleSignIn: data.google_signin_enabled || false,
        organisationCreationDisabled:
          data.organisation_creation_disabled || false,
      });
    } catch (error) {
      console.error("Failed to fetch global configurations:", error);
    }
  };

  // Consolidate authentication check into a single useEffect
  useEffect(() => {
    const init = async () => {
      try {
        await getGlobalConfigurations();
        await checkAuth();
      } finally {
        setIsLoading(false);
      }
    };
    init();

    // getGlobalConfigurations();
    // const checkAuthStatus = async () => {
    //   const token =
    //     localStorage.getItem("userToken") ||
    //     sessionStorage.getItem("userToken");

    //   if (!token) {
    //     setIsAuthenticated(false);
    //     setIsLoading(false);
    //     return;
    //   }

    //   try {
    //     const { data: userData } = await axios.get("/user");
    //     setUser(userData);
    //     setIsAuthenticated(true);
    //   } catch (error) {
    //     console.error("Authentication check failed:", error);
    //     // Clear invalid token
    //     localStorage.removeItem("userToken");
    //     sessionStorage.removeItem("userToken");
    //     setIsAuthenticated(false);
    //     setUser(null);
    //   } finally {
    //     setIsLoading(false);
    //   }
    // };

    // checkAuth();
  }, []); // Empty dependency array - only run once on mount

  // const handleHomeResponse = async (response: HomeResponse) => {
  //   try {
  //     let endpoint: string;
  //     let payload: any;
  //     const headers: Record<string, string> = {};

  //     if (response.type === "CREATE_ORGANISATION") {
  //       endpoint = "/organisations/create";
  //       payload = { name: response.name };
  //     } else if (response.type === "CREATE_APPLICATION") {
  //       endpoint = "/organisations/applications/create";
  //       payload = {
  //         organisation: response.organisation,
  //         application: response.name,
  //       };
  //       headers["x-organisation"] = response.organisation;
  //     } else if (response.type === "INVITE_USER") {
  //       endpoint = "/organisations/user/create";
  //       payload = {
  //         user: response.email,
  //         access: response.role,
  //       };
  //       headers["x-organisation"] = response.organisation;
  //     } else if (response.type === "REQUEST_ORGANISATION") {
  //       endpoint = "/organisations/request";
  //       payload = {
  //         organisation_name: response.orgName,
  //         name: response.name,
  //         email: response.email,
  //         phone: response.phoneNumber,
  //         app_store_link: response.appStoreLink,
  //         play_store_link: response.playStoreLink,
  //       };
  //     }

  //     await axios.post(endpoint, payload, { headers });

  //     // Refresh organizations list using the new organizations endpoint
  //     if (response.type !== "REQUEST_ORGANISATION") {
  //       const { data: organisations } = await axios.get<Organisation[]>(
  //         "/organisations"
  //       );

  //       // Update user state with the new organizations data
  //       // setUser((prev) => (prev ? { ...prev, organisations } : null));
  //     } else {
  //       response.successCb?.();
  //       console.log("Organisation request submitted successfully");
  //     }
  //   } catch (error) {
  //     if (response.type == "REQUEST_ORGANISATION") {
  //       response.errorCb?.(
  //         "We could not process your request. Please try again later."
  //       );
  //     }
  //     console.error("API request failed:", error);
  //   }
  // };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-screen">
        Loading...
      </div>
    );
  }

  console.log("user", user);
  console.log("isAuthenticated", isAuthenticated);

  return (
    <Router>
      {/* Toast component for notifications */}
      <Toast />

      <Routes>
        <Route
          path="/dashboard/login"
          element={
            user && isAuthenticated ? (
              <Navigate to="/dashboard" replace />
            ) : (
              <Login configuration={configurations} />
            )
          }
        />
        <Route
          path="/dashboard/signup"
          element={<Signup configuration={configurations}></Signup>}
        />

        <Route
          path="/dashboard"
          element={
            isAuthenticated && user ? (
              <DashboardLayout configuration={configurations} />
            ) : (
              <Navigate to="/dashboard/login" replace />
            )
          }
        >
          <Route index element={<Home configuration={configurations} />} />
          <Route path="/dashboard/:org" element={<OrganizationDashboard />} />
          <Route path="/dashboard/:org/:app" element={<ApplicationDashboard />} />
          <Route path="/dashboard/:org/:app/release-views" element={<ReleaseViewsList />} />
          <Route path="/dashboard/:org/:app/dimensions" element={<DimensionPriority />} />
          <Route path="/dashboard/:org/:app/release-history" element={<ReleaseHistory />} />
          <Route path="/dashboard/:org/:app/release" element={<Release />} />
          <Route path="/dashboard/:org/:app/release/:releaseId" element={<Release />} />
          
        </Route>

        <Route
          path="/dashboard/analytics/:org/:app"
          element={
            isAuthenticated && user ? (
              <Analytics user={user} />
            ) : (
              <Navigate to="/dashboard/login" replace />
            )
          }
        />
        <Route
          path="/dashboard/analytics/:org/:app/:release"
          element={
            isAuthenticated && user ? (
              <Analytics user={user} />
            ) : (
              <Navigate to="/dashboard/login" replace />
            )
          }
        />
        <Route
          path="/"
          element={
            <Navigate
              to={isAuthenticated ? "/dashboard" : "/dashboard/login"}
              replace
            />
          }
        />
      </Routes>
    </Router>
  );
};

export default App;
