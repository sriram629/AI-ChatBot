import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Sparkles, Zap } from "lucide-react";
import logo from "@/assets/transparent-logo.png";

const Index = () => {
  return (
    <div className="flex min-h-screen items-center justify-center bg-background relative overflow-hidden">
      <div className="absolute inset-0 pointer-events-none">
        <div className="absolute top-20 left-10 w-32 h-32 bg-primary/20 rounded-full blur-3xl animate-float"></div>
        <div className="absolute bottom-20 right-10 w-40 h-40 bg-accent/20 rounded-full blur-3xl animate-float-delayed"></div>
        <div className="absolute top-1/2 left-1/4 w-24 h-24 bg-primary/10 rotate-45 blur-2xl animate-float"></div>
      </div>

      <div className="text-center space-y-8 px-4 max-w-2xl relative z-10">
        <div className="flex justify-center mb-4">
          <img src={logo} alt="AI Chat Logo" className="w-24 h-24" />
        </div>
        <h1 className="text-5xl md:text-6xl font-bold tracking-tight">
          Your AI Assistant
        </h1>
        <p className="text-xl text-muted-foreground max-w-lg mx-auto">
          Experience intelligent conversations powered by advanced AI. Get help
          with coding, writing, and more.
        </p>

        <div className="flex flex-col sm:flex-row gap-4 justify-center">
          <Link to="/register">
            <Button size="lg" className="text-lg px-8">
              Get Started
              <Sparkles className="ml-2 h-5 w-5" />
            </Button>
          </Link>
          <Link to="/login">
            <Button size="lg" variant="outline" className="text-lg px-8">
              Sign In
              <Zap className="ml-2 h-5 w-5" />
            </Button>
          </Link>
        </div>

        <div className="pt-8 grid grid-cols-1 md:grid-cols-3 gap-6 text-left">
          <div className="p-6 rounded-lg bg-card border border-border">
            <h3 className="font-semibold mb-2">Smart Responses</h3>
            <p className="text-sm text-muted-foreground">
              Get intelligent, context-aware answers to your questions
            </p>
          </div>
          <div className="p-6 rounded-lg bg-card border border-border">
            <h3 className="font-semibold mb-2">Code Assistance</h3>
            <p className="text-sm text-muted-foreground">
              Receive help with coding, debugging, and best practices
            </p>
          </div>
          <div className="p-6 rounded-lg bg-card border border-border">
            <h3 className="font-semibold mb-2">Always Available</h3>
            <p className="text-sm text-muted-foreground">
              24/7 access to your personal AI assistant
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Index;
