import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";

const Index = () => {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let didNavigate = false;
    let timeoutId: ReturnType<typeof setTimeout>;
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

    // Set up timeout fallback - if auth check takes too long, stop loading but keep waiting for auth
    timeoutId = setTimeout(() => {
      console.error("Auth check timeout - stopping spinner but continuing to wait for auth");
      setLoading(false);
    }, 3000);

    // Get initial session
    supabase.auth.getSession()
      .then(async ({ data: { session }, error }) => {
        if (error) {
          console.error('Session error:', error);
          // Clear any problematic session
          await supabase.auth.signOut();
          performNavigation(null);
          return;
        }
        if (session?.user) {
          // Check if account is deactivated
          try {
            const { data: profileData, error } = await supabase
              .from('profiles')
              .select('is_deactivated, scheduled_deletion_at')
              .eq('user_id', session.user.id)
              .single();

            if (!error && profileData?.is_deactivated) {
              const deletionDate = new Date(profileData.scheduled_deletion_at);
              const now = new Date();
              
              if (deletionDate > now) {
                // Redirect to reactivation page
                didNavigate = true;
                setLoading(false);
                navigate(`/reactivate?email=${encodeURIComponent(session.user.email || '')}`, { replace: true });
                if (timeoutId) clearTimeout(timeoutId);
                if (subscription) subscription.unsubscribe();
                return;
              } else {
                // Account expired - sign out
                await supabase.auth.signOut();
                performNavigation(null);
                return;
              }
            }
          } catch (error) {
            console.error('Error checking deactivation status:', error);
          }
        }
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
          <img src="/logo-animated.svg" alt="Loading" className="h-28 w-28 mx-auto mb-4" />
          <p className="text-muted-foreground animate-pulse">Welcome to EduHive</p>
        </div>
      </div>
    );
  }

  // If loading stopped but still here, show a fallback
  return (
    <div className="min-h-screen flex items-center justify-center bg-background">
      <div className="text-center">
        <p className="text-muted-foreground mb-4">Connection is taking longer than expected...</p>
        <button 
          onClick={() => navigate("/auth", { replace: true })}
          className="text-primary hover:underline"
        >
          Continue to Sign In
        </button>
      </div>
    </div>
  );
};

export default Index;
