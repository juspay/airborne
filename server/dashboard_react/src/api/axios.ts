import axios from "axios";
import { handleApiError } from "../utils/errorHandler";

const axiosInstance = axios.create({
  baseURL: "/", // Base URL for all requests
  timeout: 10000, // 10 seconds timeout
});

// Request interceptor to add auth token
axiosInstance.interceptors.request.use(
  (config) => {
    const token =
      localStorage.getItem("userToken") || sessionStorage.getItem("userToken");
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

// Response interceptor to handle common errors
axiosInstance.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      // Check if this request was configured to skip auto-logout
      const skipAutoLogout = error.config?.skipAutoLogout;
      
      // Don't auto-logout for user management endpoints or when explicitly skipped
      const isUserManagementEndpoint = error.config?.url?.includes('/users') || 
                                       error.config?.url?.includes('/user') ||
                                       error.config?.url?.includes('/admin');
      
      if (!skipAutoLogout && !isUserManagementEndpoint) {
        // Clear tokens on unauthorized for authentication-related requests
        localStorage.removeItem("userToken");
        sessionStorage.removeItem("userToken");
        window.location.href = "/dashboard";
      }
    }

    // Handle all API errors with our error handler
    handleApiError(error);

    return Promise.reject(error);
  }
);

// Helper method to make requests without auto-logout on 401
(axiosInstance as any).withoutAutoLogout = (config: any) => {
  return axiosInstance({
    ...config,
    skipAutoLogout: true
  });
};

export default axiosInstance;
