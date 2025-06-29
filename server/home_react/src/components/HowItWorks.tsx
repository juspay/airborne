
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Download, Target, Rocket, CheckCircle } from "lucide-react";

export function HowItWorks() {
  const steps = [
    {
      icon: Download,
      title: "Integrate SDK",
      description: "Add our lightweight SDK to your app with just a few lines of code. Compatible with React Native, Flutter, and native platforms.",
      step: "01"
    },
    {
      icon: Target,
      title: "Define Targets",
      description: "Set up targeting rules based on user segments, device types, OS versions, or custom attributes through our dashboard.",
      step: "02"
    },
    {
      icon: Rocket,
      title: "Deploy Updates",
      description: "Push your updates to our servers. Our intelligent system handles safe rollouts with real-time monitoring.",
      step: "03"
    },
    {
      icon: CheckCircle,
      title: "Monitor & Scale",
      description: "Track deployment success, user adoption, and performance metrics. Scale to 100% rollout when ready.",
      step: "04"
    }
  ];

  return (
    <section className="py-24 px-6 bg-gradient-to-r from-slate-900/50 to-indigo-900/50">
      <div className="max-w-6xl mx-auto">
        <div className="text-center mb-16">
          <h2 className="text-4xl md:text-5xl font-bold text-white mb-6">
            How It Works
          </h2>
          <p className="text-xl text-white/70 max-w-3xl mx-auto">
            Get started in minutes with our simple four-step process. 
            From integration to deployment, we've made OTA updates effortless.
          </p>
        </div>
        
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8">
          {steps.map((step, index) => (
            <Card key={index} className="bg-white/5 backdrop-blur-sm border-white/10 relative overflow-hidden hover:bg-white/10 transition-all duration-300">
              <div className="absolute top-4 right-4 text-6xl font-bold text-white/10">
                {step.step}
              </div>
              <CardHeader className="pb-4">
                <step.icon className="h-12 w-12 text-blue-400 mb-4" />
                <CardTitle className="text-white text-xl">{step.title}</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-white/70 leading-relaxed">
                  {step.description}
                </p>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    </section>
  );
}
