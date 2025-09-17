import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";

const Index = () => {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let didNavigate = false;
    let timeoutId: NodeJS.Timeout;
    let subscription: any;

    const performNavigation = (session: any) => {
      if (!didNavigate) {
        didNavigate = true;
        setLoading(false);
        navigate(session ? "/home" : "/auth", { replace: true });
        if (timeoutId) clearTimeout(timeoutId);
        if (subscription) subscription.unsubscribe();
      }
    };

    // Set up timeout fallback - if auth check takes too long, go to auth page
    timeoutId = setTimeout(() => {
      console.error("Auth check timeout - redirecting to auth page");
      performNavigation(null);
    }, 3000);

    // Get initial session
    supabase.auth.getSession()
      .then(({ data: { session } }) => {
        performNavigation(session);
      })
      .catch((error) => {
        console.error("getSession failed:", error);
        performNavigation(null);
      });

    // Listen for auth changes
    const { data: { subscription: authSubscription } } = supabase.auth.onAuthStateChange(
      (_event, session) => {
        performNavigation(session);
      }
    );
    subscription = authSubscription;

    return () => {
      if (timeoutId) clearTimeout(timeoutId);
      if (subscription) subscription.unsubscribe();
    };
  }, [navigate]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-4"></div>
          <p className="text-muted-foreground">Loading...</p>
        </div>
      </div>
    );
  }

  return null;
};

export default Index;
