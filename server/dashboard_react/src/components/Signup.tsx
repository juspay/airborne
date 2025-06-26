import React from "react"; // Removed unused useState, useEffect
// Removed User type as it's not directly used by Signup page wrapper
import { AuthLayout } from './layouts/AuthLayout';
import { SignupForm } from './auth/SignupForm';
import { Configuration } from "../types";

// Signup page typically doesn't need to set auth state directly,
// that's handled by login or token validation after signup.
// If props were needed, they would be defined here.
// interface SignupPageProps {}

interface SignupPageProps {
  configuration: Configuration;
}

export const Signup: React.FC<SignupPageProps> = ({ configuration }) => { // Removed props if not needed by SignupForm directly
  return (
    <AuthLayout>
      <SignupForm configuration={configuration} />
    </AuthLayout>
  );
};
