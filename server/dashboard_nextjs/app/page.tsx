"use client";

import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Target, Zap, Shield, BarChart3, Users, Globe, ArrowRight, Play, Star, ChevronRight } from "lucide-react";
import Link from "next/link";
import Image from "next/image";

export default function LandingPage() {
  const features = [
    {
      icon: Target,
      title: "Precise Targeting",
      description: "Deploy to specific user segments with dimension-based targeting",
    },
    {
      icon: Zap,
      title: "Instant Updates",
      description: "Push updates over-the-air without app store delays",
    },
    {
      icon: Shield,
      title: "Safe Rollouts",
      description: "Gradual rollouts with instant rollback capabilities",
    },
    {
      icon: BarChart3,
      title: "Real-time Analytics",
      description: "Monitor deployment success and user adoption",
    },
    {
      icon: Users,
      title: "Team Collaboration",
      description: "Manage releases with role-based access control",
    },
    {
      icon: Globe,
      title: "Global Scale",
      description: "Deploy to millions of users worldwide with confidence",
    },
  ];

  const testimonials = [
    {
      name: "Sarah Chen",
      role: "VP Engineering",
      company: "TechCorp",
      content: "Airborne reduced our deployment time from weeks to minutes. Game changer for our mobile team.",
      rating: 5,
    },
    {
      name: "Marcus Rodriguez",
      role: "CTO",
      company: "StartupXYZ",
      content: "The targeting capabilities are incredible. We can test features with specific user groups seamlessly.",
      rating: 5,
    },
    {
      name: "Emily Watson",
      role: "Product Manager",
      company: "Enterprise Inc",
      content:
        "Finally, we can fix critical bugs without waiting for app store approval. Our users love the faster updates.",
      rating: 5,
    },
  ];

  const stats = [
    { value: "99.9%", label: "Uptime" },
    { value: "10M+", label: "Updates Delivered" },
    { value: "500+", label: "Companies Trust Us" },
    { value: "< 1s", label: "Average Deploy Time" },
  ];

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="border-b border-border bg-card/50 backdrop-blur supports-[backdrop-filter]:bg-card/50 sticky top-0 z-50">
        <div className="container mx-auto px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Image
              src="/airborne-cube-logo.png"
              alt="Airborne Logo"
              width={16}
              height={16}
              className="h-8 w-8 mr-2 text-primary-foreground"
            ></Image>
            <span className="font-bold text-lg font-[family-name:var(--font-space-grotesk)]">Airborne</span>
          </div>

          <nav className="hidden md:flex items-center gap-6">
            <Link href="#features" className="text-sm hover:text-primary transition-colors">
              Features
            </Link>
            <Link href="/docs/" target="_blank" className="text-sm hover:text-primary transition-colors">
              Docs
            </Link>
            <Link href="https://juspay.io" target="_blank" className="text-sm hover:text-primary transition-colors">
              Company
            </Link>
            <Link
              href="https://github.com/juspay/airborne"
              target="_blank"
              className="text-sm hover:text-primary transition-colors"
            >
              Source
            </Link>
          </nav>

          <div className="flex items-center gap-3">
            <Button variant="ghost" asChild>
              <Link href="/login">Sign in</Link>
            </Button>
            <Button asChild>
              <Link href="/register">Get started</Link>
            </Button>
          </div>
        </div>
      </header>

      {/* Hero Section */}
      <section className="container mx-auto px-6 py-20 text-center">
        <div className="max-w-4xl mx-auto">
          <Badge variant="secondary" className="mb-6">
            🚀 Now supporting React Native and any JS based updates
          </Badge>

          <h1 className="text-5xl md:text-6xl font-bold font-[family-name:var(--font-space-grotesk)] text-balance mb-6">
            Ship updates without
            <span className="text-primary"> app store delays</span>
          </h1>

          <p className="text-xl text-muted-foreground mb-8 max-w-2xl mx-auto text-balance">
            Deploy code and assets over-the-air with precise targeting, instant rollbacks, and real-time analytics. Get
            your updates to users in seconds, not weeks.
          </p>

          <div className="flex flex-col sm:flex-row items-center justify-center gap-4 mb-12">
            <Button size="lg" className="h-12 px-8" asChild>
              <Link href="/register">
                Start free trial
                <ArrowRight className="ml-2 h-4 w-4" />
              </Link>
            </Button>
            <Button variant="outline" size="lg" className="h-12 px-8 bg-transparent">
              <Play className="mr-2 h-4 w-4" />
              Watch demo
            </Button>
          </div>

          {/* Stats */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-8 max-w-2xl mx-auto">
            {stats.map((stat, index) => (
              <div key={stat.label + index} className="text-center">
                <div className="text-2xl font-bold text-primary">{stat.value}</div>
                <div className="text-sm text-muted-foreground">{stat.label}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section id="features" className="container mx-auto px-6 py-20">
        <div className="text-center mb-16">
          <h2 className="text-3xl md:text-4xl font-bold font-[family-name:var(--font-space-grotesk)] mb-4">
            Everything you need for modern deployments
          </h2>
          <p className="text-xl text-muted-foreground max-w-2xl mx-auto">
            From precise targeting to instant rollbacks, Airborne gives you complete control over your app updates.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
          {features.map((feature, index) => {
            const Icon = feature.icon;
            return (
              <Card key={index} className="border-0 shadow-sm hover:shadow-md transition-shadow">
                <CardContent className="p-6">
                  <div className="h-12 w-12 rounded-lg bg-primary/10 flex items-center justify-center mb-4">
                    <Icon className="h-6 w-6 text-primary" />
                  </div>
                  <h3 className="font-semibold font-[family-name:var(--font-space-grotesk)] mb-2">{feature.title}</h3>
                  <p className="text-muted-foreground text-sm">{feature.description}</p>
                </CardContent>
              </Card>
            );
          })}
        </div>
      </section>

      {/* How it Works */}
      <section className="bg-muted/30 py-20">
        <div className="container mx-auto px-6">
          <div className="text-center mb-16">
            <h2 className="text-3xl md:text-4xl font-bold font-[family-name:var(--font-space-grotesk)] mb-4">
              Deploy in three simple steps
            </h2>
            <p className="text-xl text-muted-foreground">From upload to user delivery in minutes</p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-8 max-w-4xl mx-auto">
            {[
              {
                step: "01",
                title: "Upload & Package",
                description: "Upload your code and assets, organize them into packages with priority settings",
              },
              {
                step: "02",
                title: "Target & Configure",
                description: "Define your audience with dimension-based targeting and rollout percentage",
              },
              {
                step: "03",
                title: "Deploy & Monitor",
                description: "Push updates instantly and monitor adoption with real-time analytics",
              },
            ].map((step, index) => (
              <div key={index} className="text-center">
                <div className="h-16 w-16 rounded-full bg-primary text-primary-foreground flex items-center justify-center text-xl font-bold mx-auto mb-4">
                  {step.step}
                </div>
                <h3 className="font-semibold font-[family-name:var(--font-space-grotesk)] mb-2">{step.title}</h3>
                <p className="text-muted-foreground text-sm">{step.description}</p>
                {index < 2 && <ChevronRight className="h-6 w-6 text-muted-foreground mx-auto mt-4 hidden md:block" />}
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Testimonials */}
      <section className="container mx-auto px-6 py-20 hidden">
        <div className="text-center mb-16">
          <h2 className="text-3xl md:text-4xl font-bold font-[family-name:var(--font-space-grotesk)] mb-4">
            Trusted by teams worldwide
          </h2>
          <p className="text-xl text-muted-foreground">See what our customers are saying about Airborne</p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          {testimonials.map((testimonial, index) => (
            <Card key={index} className="border-0 shadow-sm">
              <CardContent className="p-6">
                <div className="flex items-center gap-1 mb-4">
                  {Array.from({ length: testimonial.rating }).map((_, i) => (
                    <Star key={i} className="h-4 w-4 fill-primary text-primary" />
                  ))}
                </div>
                <p className="text-muted-foreground mb-4">&ldquo;{testimonial.content}&rdquo;</p>
                <div>
                  <div className="font-medium">{testimonial.name}</div>
                  <div className="text-sm text-muted-foreground">
                    {testimonial.role} at {testimonial.company}
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </section>

      {/* CTA Section */}
      <section className="bg-primary text-primary-foreground py-20">
        <div className="container mx-auto px-6 text-center">
          <h2 className="text-3xl md:text-4xl font-bold font-[family-name:var(--font-space-grotesk)] mb-4">
            Ready to ship faster?
          </h2>
          <p className="text-xl opacity-90 mb-8 max-w-2xl mx-auto">
            Join thousands of developers who trust Airborne for their over-the-air deployments. Start your free trial
            today.
          </p>
          <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
            <Button size="lg" variant="secondary" className="h-12 px-8" asChild>
              <Link href="/register">
                Start free trial
                <ArrowRight className="ml-2 h-4 w-4" />
              </Link>
            </Button>
            <Button
              onClick={() => (window.location.href = "mailto:pp-sdk@juspay.in")}
              size="lg"
              variant="outline"
              className="h-12 px-8 border-primary-foreground/20 text-primary-foreground hover:bg-primary-foreground/10 bg-transparent"
            >
              Contact sales
            </Button>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-border bg-muted/30">
        <div className="container mx-auto px-6 py-12">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-8">
            <div>
              <div className="flex items-center gap-2 mb-4">
                <div className="h-8 w-8 rounded-lg flex items-center justify-center">
                  <Image
                    src="/airborne-cube-logo.png"
                    alt="Airborne Logo"
                    width={16}
                    height={16}
                    className="h-8 w-8"
                  ></Image>
                </div>
                <span className="font-bold text-lg font-[family-name:var(--font-space-grotesk)]">Airborne</span>
              </div>
              <p className="text-sm text-muted-foreground">
                The fastest way to deploy over-the-air updates to your mobile and web applications.
              </p>
            </div>

            <div>
              <h4 className="font-semibold mb-4">Product</h4>
              <div className="space-y-2 text-sm">
                <Link href="/dashboard" className="block text-muted-foreground hover:text-foreground">
                  Get Started
                </Link>
                <Link
                  href="https://github.com/juspay/airborne"
                  target="_blank"
                  className="block text-muted-foreground hover:text-foreground"
                >
                  Github
                </Link>
                {/* <Link href="#" className="block text-muted-foreground hover:text-foreground">
                  Features
                </Link>
                <Link href="#" className="block text-muted-foreground hover:text-foreground">
                  Pricing
                </Link>
                <Link href="#" className="block text-muted-foreground hover:text-foreground">
                  Security
                </Link>
                <Link href="#" className="block text-muted-foreground hover:text-foreground">
                  Integrations
                </Link> */}
              </div>
            </div>

            <div>
              <h4 className="font-semibold mb-4">Resources</h4>
              <div className="space-y-2 text-sm">
                <Link href="/docs/" target="_blank" className="block text-muted-foreground hover:text-foreground">
                  Documentation
                </Link>
                {/* <Link href="#" className="block text-muted-foreground hover:text-foreground">
                  API Reference
                </Link>
                <Link href="#" className="block text-muted-foreground hover:text-foreground">
                  Guides
                </Link>
                <Link href="#" className="block text-muted-foreground hover:text-foreground">
                  Support
                </Link> */}
              </div>
            </div>

            <div className="hidden">
              <h4 className="font-semibold mb-4">Company</h4>
              <div className="space-y-2 text-sm">
                <Link href="#" className="block text-muted-foreground hover:text-foreground">
                  About
                </Link>
                <Link href="#" className="block text-muted-foreground hover:text-foreground">
                  Blog
                </Link>
                <Link href="#" className="block text-muted-foreground hover:text-foreground">
                  Careers
                </Link>
                <Link href="#" className="block text-muted-foreground hover:text-foreground">
                  Contact
                </Link>
              </div>
            </div>
          </div>

          <div className="border-t border-border mt-8 pt-8 flex flex-col md:flex-row items-center justify-between">
            <p className="text-sm text-muted-foreground">
              © {new Date().getFullYear()} Airborne. All rights reserved.
            </p>
            <div className="flex items-center gap-6 mt-4 md:mt-0">
              <Link href="/privacy-policy" className="text-sm text-muted-foreground hover:text-foreground">
                Privacy Policy
              </Link>
              <Link href="/terms-of-use" className="text-sm text-muted-foreground hover:text-foreground">
                Terms of Use
              </Link>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}
