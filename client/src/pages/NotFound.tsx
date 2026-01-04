import { useLocation, Link } from "react-router-dom";
import { useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Ghost, ArrowLeft } from "lucide-react";

const NotFound = () => {
  const location = useLocation();

  useEffect(() => {
    console.error(
      "404 Error: User attempted to access non-existent route:",
      location.pathname
    );
  }, [location.pathname]);

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-linear-to-br from-background via-background to-primary/5 p-4 text-center">
      <div className="relative mb-8">
        <div className="absolute inset-0 bg-primary/20 blur-3xl rounded-full animate-pulse" />
        <div className="relative bg-card/50 backdrop-blur-xl border border-border/50 p-6 rounded-full shadow-2xl animate-bounce duration-3000ms">
          <Ghost className="w-24 h-24 text-primary" />
        </div>
      </div>
      <h1 className="text-9xl font-black text-transparent bg-clip-text bg-linear-to-b from-foreground to-foreground/20 select-none mb-2">
        404
      </h1>

      <h2 className="text-2xl font-bold mb-3">Page not found</h2>

      <p className="text-muted-foreground max-w-md mb-8 leading-relaxed">
        Oops! It seems like the page you are looking for has vanished into the
        void or never existed in the first place.
      </p>
      <Button asChild size="lg" className="group">
        <Link to="/">
          <ArrowLeft className="mr-2 h-4 w-4 group-hover:-translate-x-1 transition-transform" />
          Return Home
        </Link>
      </Button>
    </div>
  );
};

export default NotFound;
