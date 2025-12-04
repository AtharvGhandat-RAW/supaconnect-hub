import { useLocation, useNavigate } from "react-router-dom";
import { useEffect } from "react";
import { motion } from "framer-motion";
import { Home, ArrowLeft, AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";
import FloatingOrbs from "@/components/ui/FloatingOrbs";
import ritLogo from "@/assets/rit-logo.jpg";

const NotFound = () => {
  const location = useLocation();
  const navigate = useNavigate();

  useEffect(() => {
    console.error("404 Error: User attempted to access non-existent route:", location.pathname);
  }, [location.pathname]);

  return (
    <div className="relative min-h-screen flex items-center justify-center overflow-hidden bg-gradient-to-br from-indigo-900 via-purple-900 to-black">
      <FloatingOrbs />
      
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6 }}
        className="relative z-10 text-center px-6"
      >
        {/* Logo */}
        <motion.div
          initial={{ scale: 0.8, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ delay: 0.2, duration: 0.5 }}
          className="flex justify-center mb-8"
        >
          <div className="relative">
            <img 
              src={ritLogo} 
              alt="RIT Logo" 
              className="w-20 h-20 rounded-full object-cover border-2 border-white/20"
            />
            <div className="absolute inset-0 -z-10 rounded-full bg-primary/30 blur-xl animate-pulse" />
          </div>
        </motion.div>

        {/* 404 Number */}
        <motion.div
          initial={{ scale: 0.5, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ delay: 0.3, duration: 0.5 }}
          className="mb-6"
        >
          <h1 className="text-8xl md:text-9xl font-display font-bold bg-gradient-to-r from-indigo-400 via-purple-400 to-pink-400 bg-clip-text text-transparent">
            404
          </h1>
        </motion.div>

        {/* Error Icon */}
        <motion.div
          initial={{ rotate: -10, opacity: 0 }}
          animate={{ rotate: 0, opacity: 1 }}
          transition={{ delay: 0.4, duration: 0.4 }}
          className="flex justify-center mb-6"
        >
          <div className="p-4 rounded-full bg-warning/10 border border-warning/30">
            <AlertTriangle className="w-8 h-8 text-warning" />
          </div>
        </motion.div>

        {/* Message */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.5, duration: 0.5 }}
          className="mb-8"
        >
          <h2 className="text-2xl md:text-3xl font-semibold text-foreground mb-3">
            Page Not Found
          </h2>
          <p className="text-muted-foreground max-w-md mx-auto">
            The page you're looking for doesn't exist or has been moved.
            Let's get you back on track.
          </p>
          <p className="text-sm text-muted-foreground/60 mt-2 font-mono">
            {location.pathname}
          </p>
        </motion.div>

        {/* Action Buttons */}
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.6, duration: 0.4 }}
          className="flex flex-col sm:flex-row gap-4 justify-center"
        >
          <Button
            onClick={() => navigate(-1)}
            variant="outline"
            className="border-border/50 hover:bg-white/5"
          >
            <ArrowLeft className="w-4 h-4 mr-2" />
            Go Back
          </Button>
          <Button
            onClick={() => navigate("/")}
            className="btn-gradient"
          >
            <Home className="w-4 h-4 mr-2" />
            Return Home
          </Button>
        </motion.div>

        {/* Footer */}
        <motion.p
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.8 }}
          className="mt-12 text-sm text-muted-foreground/50"
        >
          RIT Polytechnic • AIML Department
        </motion.p>
      </motion.div>
    </div>
  );
};

export default NotFound;
