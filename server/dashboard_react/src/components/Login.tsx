import React from "react"; // Removed unused useState, useEffect
import { Configuration, User } from "../types";
import { AuthLayout } from './layouts/AuthLayout';
import { LoginForm } from './auth/LoginForm';

// Props expected by the original Login page, to be passed to LoginForm
interface LoginPageProps {
  setIsAuthenticated: (isAuthenticated: boolean) => void;
  setUser: (user: User) => void;
  configuration: Configuration;
}

export const Login: React.FC<LoginPageProps> = ({ setIsAuthenticated, setUser, configuration }) => {
  return (
    <AuthLayout>
      <LoginForm setIsAuthenticated={setIsAuthenticated} setUser={setUser} configuration={configuration} />
    </AuthLayout>
  );
};
