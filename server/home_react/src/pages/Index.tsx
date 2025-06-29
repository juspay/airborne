
import { Hero } from "@/components/Hero";
import { Features } from "@/components/Features";
import { HowItWorks } from "@/components/HowItWorks";
import { CodeExample } from "@/components/CodeExample";
import { Footer } from "@/components/Footer";
import { Header } from "@/components/Header";

const Index = () => {
  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-blue-900 to-indigo-900">
      <Header />
      <Hero />
      <Features />
      <HowItWorks />
      <CodeExample />
      <Footer />
    </div>
  );
};

export default Index;
