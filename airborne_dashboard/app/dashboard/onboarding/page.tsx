"use client";

import { useState } from "react";
import { Card, CardContent, CardDescription, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Rocket, Check, ChevronRight, Smartphone, Globe, Users, Target, Zap, Shield, BarChart3 } from "lucide-react";

export default function OnboardingPage() {
  const [currentStep, setCurrentStep] = useState(1);
  const totalSteps = 3;

  const [formData, setFormData] = useState({
    appName: "",
    appDescription: "",
    platform: "",
    teamSize: "",
    useCase: "",
    goals: [] as string[],
  });

  const platforms = [
    { value: "ios", label: "iOS", icon: Smartphone },
    { value: "android", label: "Android", icon: Smartphone },
    { value: "web", label: "Web", icon: Globe },
    { value: "react-native", label: "React Native", icon: Smartphone },
    { value: "flutter", label: "Flutter", icon: Smartphone },
  ];

  const teamSizes = [
    { value: "1", label: "Just me" },
    { value: "2-5", label: "2-5 people" },
    { value: "6-20", label: "6-20 people" },
    { value: "21-100", label: "21-100 people" },
    { value: "100+", label: "100+ people" },
  ];

  const useCases = [
    { value: "feature-flags", label: "Feature flags & A/B testing", icon: Target },
    { value: "hotfixes", label: "Critical bug fixes", icon: Zap },
    { value: "content-updates", label: "Content & asset updates", icon: BarChart3 },
    { value: "gradual-rollouts", label: "Gradual feature rollouts", icon: Users },
    { value: "compliance", label: "Compliance & security", icon: Shield },
  ];

  const goals = [
    "Reduce app store review time",
    "Improve user experience",
    "Faster bug fixes",
    "Better feature testing",
    "Increase deployment frequency",
    "Reduce rollback time",
  ];

  const handleNext = () => {
    if (currentStep < totalSteps) {
      setCurrentStep(currentStep + 1);
    }
  };

  const handlePrevious = () => {
    if (currentStep > 1) {
      setCurrentStep(currentStep - 1);
    }
  };

  const handleComplete = () => {
    // Simulate onboarding completion
    setTimeout(() => {
      window.location.href = "/";
    }, 1000);
  };

  const toggleGoal = (goal: string) => {
    setFormData((prev) => ({
      ...prev,
      goals: prev.goals.includes(goal) ? prev.goals.filter((g) => g !== goal) : [...prev.goals, goal],
    }));
  };

  const canProceed = () => {
    switch (currentStep) {
      case 1:
        return formData.appName && formData.platform;
      case 2:
        return formData.teamSize && formData.useCase;
      case 3:
        return formData.goals.length > 0;
      default:
        return false;
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-background to-primary/5 flex items-center justify-center p-4">
      <div className="w-full max-w-2xl">
        {/* Header */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center gap-3 mb-6">
            <div className="h-12 w-12 rounded-xl bg-primary flex items-center justify-center">
              <Rocket className="h-6 w-6 text-primary-foreground" />
            </div>
            <span className="text-2xl font-bold font-[family-name:var(--font-space-grotesk)]">Airborne</span>
          </div>
          <h1 className="text-3xl font-bold font-[family-name:var(--font-space-grotesk)] text-balance mb-2">
            Welcome to Airborne
          </h1>
          <p className="text-muted-foreground">Let&#39;s set up your first application in just a few steps</p>
        </div>

        {/* Progress Steps */}
        <div className="flex items-center justify-center gap-4 mb-8">
          {[
            { number: 1, title: "App Details" },
            { number: 2, title: "Team & Use Case" },
            { number: 3, title: "Goals" },
          ].map((step, index) => (
            <div key={step.number} className="flex items-center">
              <div className="flex items-center gap-3">
                <div
                  className={`
                    flex items-center justify-center w-10 h-10 rounded-full border-2 transition-colors
                    ${
                      step.number < currentStep
                        ? "bg-primary border-primary text-primary-foreground"
                        : step.number === currentStep
                          ? "border-primary text-primary bg-primary/10"
                          : "border-muted-foreground/30 text-muted-foreground"
                    }
                  `}
                >
                  {step.number < currentStep ? <Check className="h-5 w-5" /> : step.number}
                </div>
                <div className="hidden sm:block">
                  <div
                    className={`font-medium text-sm ${
                      step.number <= currentStep ? "text-foreground" : "text-muted-foreground"
                    }`}
                  >
                    {step.title}
                  </div>
                </div>
              </div>
              {index < 2 && <ChevronRight className="h-4 w-4 text-muted-foreground mx-4" />}
            </div>
          ))}
        </div>

        <Card className="border-0 shadow-lg">
          <CardContent className="p-8">
            {/* Step 1: App Details */}
            {currentStep === 1 && (
              <div className="space-y-6">
                <div className="text-center mb-6">
                  <CardTitle className="text-xl font-[family-name:var(--font-space-grotesk)] mb-2">
                    Tell us about your app
                  </CardTitle>
                  <CardDescription>Basic information about the application you want to deploy</CardDescription>
                </div>

                <div className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="appName">Application name *</Label>
                    <Input
                      id="appName"
                      placeholder="My Awesome App"
                      value={formData.appName}
                      onChange={(e) => setFormData((prev) => ({ ...prev, appName: e.target.value }))}
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="appDescription">Description (optional)</Label>
                    <Textarea
                      id="appDescription"
                      placeholder="Brief description of your app..."
                      rows={3}
                      value={formData.appDescription}
                      onChange={(e) => setFormData((prev) => ({ ...prev, appDescription: e.target.value }))}
                    />
                  </div>

                  <div className="space-y-2">
                    <Label>Platform *</Label>
                    <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                      {platforms.map((platform) => {
                        const Icon = platform.icon;
                        return (
                          <Button
                            key={platform.value}
                            variant={formData.platform === platform.value ? "default" : "outline"}
                            className="h-16 flex-col gap-2"
                            onClick={() => setFormData((prev) => ({ ...prev, platform: platform.value }))}
                          >
                            <Icon className="h-5 w-5" />
                            <span className="text-sm">{platform.label}</span>
                          </Button>
                        );
                      })}
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Step 2: Team & Use Case */}
            {currentStep === 2 && (
              <div className="space-y-6">
                <div className="text-center mb-6">
                  <CardTitle className="text-xl font-[family-name:var(--font-space-grotesk)] mb-2">
                    Team & use case
                  </CardTitle>
                  <CardDescription>Help us understand your team and primary use case</CardDescription>
                </div>

                <div className="space-y-6">
                  <div className="space-y-2">
                    <Label>Team size *</Label>
                    <Select
                      value={formData.teamSize}
                      onValueChange={(value) => setFormData((prev) => ({ ...prev, teamSize: value }))}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Select team size" />
                      </SelectTrigger>
                      <SelectContent>
                        {teamSizes.map((size) => (
                          <SelectItem key={size.value} value={size.value}>
                            {size.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-2">
                    <Label>Primary use case *</Label>
                    <div className="grid grid-cols-1 gap-3">
                      {useCases.map((useCase) => {
                        const Icon = useCase.icon;
                        return (
                          <Button
                            key={useCase.value}
                            variant={formData.useCase === useCase.value ? "default" : "outline"}
                            className="h-16 justify-start gap-4 px-4"
                            onClick={() => setFormData((prev) => ({ ...prev, useCase: useCase.value }))}
                          >
                            <Icon className="h-5 w-5" />
                            <span>{useCase.label}</span>
                          </Button>
                        );
                      })}
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Step 3: Goals */}
            {currentStep === 3 && (
              <div className="space-y-6">
                <div className="text-center mb-6">
                  <CardTitle className="text-xl font-[family-name:var(--font-space-grotesk)] mb-2">
                    What are your goals?
                  </CardTitle>
                  <CardDescription>Select all that apply - this helps us customize your experience</CardDescription>
                </div>

                <div className="space-y-3">
                  {goals.map((goal) => (
                    <Button
                      key={goal}
                      variant={formData.goals.includes(goal) ? "default" : "outline"}
                      className="w-full h-12 justify-start gap-3"
                      onClick={() => toggleGoal(goal)}
                    >
                      <div
                        className={`h-4 w-4 rounded border-2 flex items-center justify-center ${
                          formData.goals.includes(goal)
                            ? "bg-primary-foreground border-primary-foreground"
                            : "border-current"
                        }`}
                      >
                        {formData.goals.includes(goal) && <Check className="h-3 w-3 text-primary" />}
                      </div>
                      <span>{goal}</span>
                    </Button>
                  ))}
                </div>

                {formData.goals.length > 0 && (
                  <div className="p-4 bg-muted/50 rounded-lg">
                    <h4 className="font-medium mb-2">Selected goals ({formData.goals.length})</h4>
                    <div className="flex flex-wrap gap-2">
                      {formData.goals.map((goal) => (
                        <Badge key={goal} variant="secondary">
                          {goal}
                        </Badge>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Navigation */}
            <div className="flex items-center justify-between mt-8 pt-6 border-t">
              <div>
                {currentStep > 1 && (
                  <Button variant="outline" onClick={handlePrevious}>
                    Previous
                  </Button>
                )}
              </div>

              <div className="flex gap-2">
                {currentStep < totalSteps ? (
                  <Button onClick={handleNext} disabled={!canProceed()}>
                    Next Step
                  </Button>
                ) : (
                  <Button onClick={handleComplete} disabled={!canProceed()}>
                    Complete Setup
                  </Button>
                )}
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
