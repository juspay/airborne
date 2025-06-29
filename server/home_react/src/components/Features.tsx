
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Code, Server, Target, Shield, Gauge, Users } from "lucide-react";

export function Features() {
  const features = [
    {
      icon: Code,
      title: "Lightweight SDK",
      description: "Drop-in SDK that integrates seamlessly with your existing app. Minimal footprint, maximum power.",
      color: "text-blue-400"
    },
    {
      icon: Server,
      title: "Robust Server",
      description: "Enterprise-grade server infrastructure that handles targeting, rollouts, and rollbacks automatically.",
      color: "text-purple-400"
    },
    {
      icon: Target,
      title: "Precise Targeting",
      description: "Target users by device, OS version, location, user segments, or custom attributes.",
      color: "text-green-400"
    },
    {
      icon: Shield,
      title: "Multi-Tenancy",
      description: "Complete isolation between organizations with dedicated namespaces for each app and team.",
      color: "text-yellow-400"
    },
    {
      icon: Gauge,
      title: "Real-time Analytics",
      description: "Monitor deployment success rates, performance metrics, and user adoption in real-time.",
      color: "text-red-400"
    },
    {
      icon: Users,
      title: "A/B Testing",
      description: "Test different versions with specific user groups before full deployment.",
      color: "text-indigo-400"
    }
  ];

  return (
    <section className="py-24 px-6">
      <div className="max-w-6xl mx-auto">
        <div className="text-center mb-16">
          <h2 className="text-4xl md:text-5xl font-bold text-white mb-6">
            Everything You Need for
            <span className="block bg-gradient-to-r from-blue-400 to-purple-400 bg-clip-text text-transparent">
              Seamless Updates
            </span>
          </h2>
          <p className="text-xl text-white/70 max-w-3xl mx-auto">
            Our platform combines a powerful SDK with intelligent server infrastructure 
            to give you complete control over your app updates.
          </p>
        </div>
        
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
          {features.map((feature, index) => (
            <Card key={index} className="bg-white/5 backdrop-blur-sm border-white/10 hover:bg-white/10 transition-all duration-300 hover:scale-105 hover:shadow-xl">
              <CardHeader>
                <feature.icon className={`h-12 w-12 ${feature.color} mb-4`} />
                <CardTitle className="text-white text-xl">{feature.title}</CardTitle>
              </CardHeader>
              <CardContent>
                <CardDescription className="text-white/70 text-base leading-relaxed">
                  {feature.description}
                </CardDescription>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    </section>
  );
}
