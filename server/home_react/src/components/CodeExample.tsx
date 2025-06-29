
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Copy, Code } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

export function CodeExample() {
  const { toast } = useToast();

  const sdkCode = `import { OTAUpdater } from '@yourplatform/sdk';

// Initialize the SDK
const updater = new OTAUpdater({
  apiKey: 'your-api-key',
  appVersion: '1.0.0'
});

// Check for updates
const update = await updater.checkForUpdate();
if (update.available) {
  await updater.applyUpdate(update);
}`;

  const serverCode = `// Dashboard Configuration
{
  "targetRules": {
    "beta_users": {
      "userSegment": "beta",
      "rolloutPercentage": 10
    },
    "ios_users": {
      "platform": "iOS",
      "osVersion": ">=15.0",
      "rolloutPercentage": 50
    }
  },
  "safetyChecks": {
    "errorRate": "< 1%",
    "crashRate": "< 0.1%",
    "autoRollback": true
  }
}`;

  const copyToClipboard = (code: string, type: string) => {
    navigator.clipboard.writeText(code);
    toast({
      title: "Copied!",
      description: `${type} code copied to clipboard`,
    });
  };

  return (
    <section className="py-24 px-6">
      <div className="max-w-6xl mx-auto">
        <div className="text-center mb-16">
          <h2 className="text-4xl md:text-5xl font-bold text-white mb-6">
            Simple Integration
          </h2>
          <p className="text-xl text-white/70 max-w-3xl mx-auto">
            Get started with just a few lines of code. Our SDK handles the complexity 
            while you focus on building great features.
          </p>
        </div>
        
        {/* <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          <Card className="bg-slate-800/50 backdrop-blur-sm border-slate-700">
            <CardHeader className="flex flex-row items-center justify-between">
              <div className="flex items-center gap-2">
                <Code className="h-5 w-5 text-blue-400" />
                <CardTitle className="text-white">SDK Integration</CardTitle>
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={() => copyToClipboard(sdkCode, 'SDK')}
                className="border-slate-600 text-slate-300 hover:bg-slate-700"
              >
                <Copy className="h-4 w-4 mr-2" />
                Copy
              </Button>
            </CardHeader>
            <CardContent>
              <pre className="text-sm text-slate-300 overflow-x-auto bg-slate-900/50 p-4 rounded-lg border border-slate-700">
                <code>{sdkCode}</code>
              </pre>
            </CardContent>
          </Card>
          
          <Card className="bg-slate-800/50 backdrop-blur-sm border-slate-700">
            <CardHeader className="flex flex-row items-center justify-between">
              <div className="flex items-center gap-2">
                <Code className="h-5 w-5 text-purple-400" />
                <CardTitle className="text-white">Server Configuration</CardTitle>
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={() => copyToClipboard(serverCode, 'Server')}
                className="border-slate-600 text-slate-300 hover:bg-slate-700"
              >
                <Copy className="h-4 w-4 mr-2" />
                Copy
              </Button>
            </CardHeader>
            <CardContent>
              <pre className="text-sm text-slate-300 overflow-x-auto bg-slate-900/50 p-4 rounded-lg border border-slate-700">
                <code>{serverCode}</code>
              </pre>
            </CardContent>
          </Card>
        </div> */}
        
        <div className="text-center mt-12">
          <a href="/docs/home">
            <Button size="lg" className="bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 text-white px-8 py-4 text-lg rounded-full transition-all duration-300 hover:scale-105">
              View Full Documentation
            </Button>
          </a>
        </div>
      </div>
    </section>
  );
}
