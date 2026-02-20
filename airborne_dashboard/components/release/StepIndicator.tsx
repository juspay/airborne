"use client";

import React from "react";
import { Check, ChevronRight } from "lucide-react";
import { ReleaseStep } from "@/types/release";

interface StepIndicatorProps {
  steps: ReleaseStep[];
  currentStep: number;
}

export function StepIndicator({ steps, currentStep }: StepIndicatorProps) {
  return (
    <div className="flex items-center gap-4 mt-6">
      {steps.map((step, index) => {
        const status = step.number < currentStep ? "completed" : step.number === currentStep ? "current" : "upcoming";
        const Icon = step.icon;

        return (
          <div key={step.number} className="flex items-center">
            <div className="flex items-center gap-3">
              <div
                className={`
                  flex items-center justify-center w-10 h-10 rounded-full border-2 transition-colors
                  ${
                    status === "completed"
                      ? "bg-primary border-primary text-primary-foreground"
                      : status === "current"
                        ? "border-primary text-primary bg-primary/10"
                        : "border-muted-foreground/30 text-muted-foreground"
                  }
                `}
              >
                {status === "completed" ? <Check className="h-5 w-5" /> : <Icon className="h-5 w-5" />}
              </div>
              <div className="hidden sm:block">
                <div
                  className={`font-medium text-sm ${
                    status !== "upcoming" ? "text-foreground" : "text-muted-foreground"
                  }`}
                >
                  {step.title}
                </div>
                <div className="text-xs text-muted-foreground">Step {step.number}</div>
              </div>
            </div>
            {index < steps.length - 1 && <ChevronRight className="h-4 w-4 text-muted-foreground mx-4" />}
          </div>
        );
      })}
    </div>
  );
}

export default StepIndicator;
