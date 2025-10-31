"use client";

import { useState, useEffect } from "react";
import { X, Sparkles } from "lucide-react";
import { RequestAccountModal } from "./request-account-modal";

export function SignupBanner() {
  const [isDismissed, setIsDismissed] = useState(true);

  useEffect(() => {
    const dismissed = sessionStorage.getItem("banner-dismissed");
    setIsDismissed(dismissed === "true");
  }, []);

  const handleDismiss = () => {
    setIsDismissed(true);
    sessionStorage.setItem("banner-dismissed", "true");
  };

  if (isDismissed) return null;

  return (
    <>
      <div className="bg-gradient-to-r from-primary via-primary to-primary/90 text-primary-foreground">
        <div className="flex items-center justify-between px-6 py-4 max-w-full">
          <div className="flex items-center gap-3 flex-1">
            <Sparkles className="h-5 w-5 flex-shrink-0" />
            <div>
              <p className="font-semibold text-sm">Join Us</p>
              <p className="text-xs opacity-90">Request an account to explore our platform and collaborate with us</p>
            </div>
          </div>
          <div className="flex items-center gap-2 ml-4">
            <RequestAccountModal onSubmit={handleDismiss} />
            <button
              onClick={handleDismiss}
              className="p-1 hover:bg-primary/20 rounded transition-colors"
              aria-label="Dismiss banner"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>
      </div>
    </>
  );
}
