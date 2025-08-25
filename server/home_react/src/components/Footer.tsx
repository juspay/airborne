import { Button } from "@/components/ui/button";
import { Github } from "lucide-react";

export function Footer() {
  const links = {
    product: [
      { name: "Documentation", href: "/docs/home" }
    ],
    resources: [
      { name: "Getting Started", href: "/dashboard" }
    ]
  };

  return (
    <footer className="py-20 px-6 bg-slate-900/80 backdrop-blur-sm border-t border-white/10">
      <div className="max-w-6xl mx-auto">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-8 mb-12">
          <div className="lg:col-span-2">
            <h3 className="text-2xl font-bold text-white mb-4">Airborne</h3>
            <p className="text-white/70 mb-6 leading-relaxed">
              The most powerful platform for targeted over-the-air updates. 
              Deploy with confidence, scale with ease.
            </p>
            <div className="flex gap-4">
              <a href="https://github.com/juspay/airborne" target="_blank" rel="noopener noreferrer">
                <Button variant="outline" size="sm" className="border-white/30 text-white hover:bg-white/10 bg-white/5">
                  <Github className="h-4 w-4" />
                </Button>
              </a>
            </div>
          </div>
          
          <div>
            <h4 className="text-white font-semibold mb-4">Product</h4>
            <ul className="space-y-3">
              {links.product.map((link) => (
                <li key={link.name}>
                  <a href={link.href} className="text-white/70 hover:text-white transition-colors">
                    {link.name}
                  </a>
                </li>
              ))}
            </ul>
          </div>
          
          
          <div>
            <h4 className="text-white font-semibold mb-4">Resources</h4>
            <ul className="space-y-3">
              {links.resources.map((link) => (
                <li key={link.name}>
                  <a href={link.href} className="text-white/70 hover:text-white transition-colors">
                    {link.name}
                  </a>
                </li>
              ))}
            </ul>
          </div>
        </div>
        
        <div className="border-t border-white/10 pt-8 flex flex-col md:flex-row justify-between items-center">
          <p className="text-white/50 text-sm">
            © {new Date().getFullYear()} Airborne. All rights reserved.
          </p>

          <p className="text-white/50 text-sm">
            <span className="mr-4">
              <a target="_blank" className="hover:text-white transition-colors" href="/privacy-policy">Privacy Policy</a>
            </span>
            <span>
              <a target="_blank" className="hover:text-white transition-colors" href="/terms-of-use">Terms of Use</a>
            </span>
          </p>
        </div>
      </div>
    </footer>
  );
}
