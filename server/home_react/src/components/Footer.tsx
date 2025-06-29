import { Button } from "@/components/ui/button";
import { Github, Twitter, Linkedin, Mail } from "lucide-react";

export function Footer() {
  const links = {
    product: [
      { name: "Features", href: "#features" },
      { name: "Pricing", href: "#pricing" },
      { name: "Documentation", href: "/docs/home" },
      { name: "API Reference", href: "#api" }
    ],
    company: [
      { name: "About", href: "#about" },
      { name: "Blog", href: "#blog" },
      { name: "Careers", href: "#careers" },
      { name: "Contact", href: "#contact" }
    ],
    resources: [
      { name: "Getting Started", href: "/dashboard" },
      { name: "Examples", href: "#examples" },
      { name: "Community", href: "#community" },
      { name: "Support", href: "#support" }
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
              <Button variant="outline" size="sm" className="border-white/30 text-white hover:bg-white/10 bg-white/5">
                <Github className="h-4 w-4" />
              </Button>
              <Button variant="outline" size="sm" className="border-white/30 text-white hover:bg-white/10 bg-white/5">
                <Twitter className="h-4 w-4" />
              </Button>
              <Button variant="outline" size="sm" className="border-white/30 text-white hover:bg-white/10 bg-white/5">
                <Linkedin className="h-4 w-4" />
              </Button>
              <Button variant="outline" size="sm" className="border-white/30 text-white hover:bg-white/10 bg-white/5">
                <Mail className="h-4 w-4" />
              </Button>
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
            <h4 className="text-white font-semibold mb-4">Company</h4>
            <ul className="space-y-3">
              {links.company.map((link) => (
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
            © 2024 Airborne. All rights reserved.
          </p>
          <div className="flex gap-6 mt-4 md:mt-0">
            <a href="#privacy" className="text-white/50 hover:text-white text-sm transition-colors">
              Privacy Policy
            </a>
            <a href="#terms" className="text-white/50 hover:text-white text-sm transition-colors">
              Terms of Service
            </a>
          </div>
        </div>
      </div>
    </footer>
  );
}
