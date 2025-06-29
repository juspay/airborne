import { Button } from "@/components/ui/button";
import { ArrowRight, Zap, Shield, Target } from "lucide-react";

export function Hero() {
  return (
    <section className="relative min-h-screen flex items-center justify-center px-6 py-20">
      <div className="absolute inset-0 bg-gradient-to-br from-blue-600/20 via-purple-600/20 to-indigo-600/20" />
      <div className="relative max-w-6xl mx-auto text-center">
        <div className="mb-8 inline-flex items-center gap-2 px-4 py-2 bg-white/10 backdrop-blur-sm rounded-full border border-white/20">
          <Zap className="h-4 w-4 text-yellow-400" />
          <span className="text-sm text-white/90">Ship updates instantly, no app store delays</span>
        </div>
        
        <h1 className="text-5xl md:text-7xl font-bold text-white mb-6 leading-tight">
          Deploy App Updates
          <span className="block bg-gradient-to-r from-blue-400 via-purple-400 to-indigo-400 bg-clip-text text-transparent">
            Without Releases
          </span>
        </h1>
        
        <p className="text-xl md:text-2xl text-white/80 mb-12 max-w-3xl mx-auto leading-relaxed">
          Revolutionary Airborne that lets developers push targeted updates directly to users. 
          No app store approval. No waiting. Just instant, safe deployments.
        </p>
        
        <div className="flex flex-col sm:flex-row gap-4 justify-center items-center mb-16">
          <a href="/dashboard">
            <Button size="lg" className="bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 text-white px-8 py-4 text-lg rounded-full transition-all duration-300 hover:scale-105 shadow-lg hover:shadow-xl">
              Start Building
              <ArrowRight className="ml-2 h-5 w-5" />
            </Button>
          </a>
          <a href="/docs/home">
            <Button variant="outline" size="lg" className="border-white/30 text-white hover:bg-white/10 px-8 py-4 text-lg rounded-full backdrop-blur-sm bg-white/5">
              View Documentation
            </Button>
          </a>
        </div>
        
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8 max-w-4xl mx-auto">
          <div className="flex items-center justify-center gap-3 text-white/90">
            <Target className="h-6 w-6 text-blue-400" />
            <span className="text-lg">Targeted Rollouts</span>
          </div>
          <div className="flex items-center justify-center gap-3 text-white/90">
            <Shield className="h-6 w-6 text-green-400" />
            <span className="text-lg">Multi-Tenancy</span>
          </div>
          <div className="flex items-center justify-center gap-3 text-white/90">
            <Zap className="h-6 w-6 text-yellow-400" />
            <span className="text-lg">Instant Updates</span>
          </div>
        </div>
      </div>
    </section>
  );
}
