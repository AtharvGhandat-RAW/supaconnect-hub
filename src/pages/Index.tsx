import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { CheckCircle2, XCircle, Loader2 } from "lucide-react";

const Index = () => {
  const [connectionStatus, setConnectionStatus] = useState<'loading' | 'connected' | 'error'>('loading');

  useEffect(() => {
    const checkConnection = async () => {
      try {
        const { error } = await supabase.auth.getSession();
        if (error) throw error;
        setConnectionStatus('connected');
      } catch {
        setConnectionStatus('error');
      }
    };
    checkConnection();
  }, []);

  return (
    <div className="flex min-h-screen items-center justify-center bg-background">
      <div className="text-center space-y-6">
        <h1 className="text-4xl font-bold text-foreground">Supabase Connected</h1>
        
        <div className="flex items-center justify-center gap-3">
          {connectionStatus === 'loading' && (
            <>
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
              <span className="text-muted-foreground">Checking connection...</span>
            </>
          )}
          {connectionStatus === 'connected' && (
            <>
              <CheckCircle2 className="h-6 w-6 text-green-500" />
              <span className="text-green-600">Successfully connected to Supabase</span>
            </>
          )}
          {connectionStatus === 'error' && (
            <>
              <XCircle className="h-6 w-6 text-destructive" />
              <span className="text-destructive">Connection failed</span>
            </>
          )}
        </div>

        <p className="text-sm text-muted-foreground">
          Project ID: gphcfejuurygcetmtpec
        </p>
      </div>
    </div>
  );
};

export default Index;
