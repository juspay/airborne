import React from "react"; // Removed unused useState, useEffect
import { Configuration } from "../types";
import { AuthLayout } from './layouts/AuthLayout';
import { LoginForm } from './auth/LoginForm';

// Props expected by the original Login page, to be passed to LoginForm
interface LoginPageProps {
  configuration: Configuration;
}

export const Login: React.FC<LoginPageProps> = ({ configuration }) => {
  return (
    <AuthLayout>
      <LoginForm configuration={configuration} />
    </AuthLayout>
  );
};
