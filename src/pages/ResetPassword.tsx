
import { useState, useEffect } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useTwitterToast } from "@/components/ui/twitter-toast";
import { Lock, Eye, EyeOff } from "lucide-react";

export default function ResetPassword() {
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [isValidSession, setIsValidSession] = useState(false);
  const [sessionLoading, setSessionLoading] = useState(true);
  
  const { showToast } = useTwitterToast();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();

  useEffect(() => {
    // Parse both URL fragments and query parameters
    const parseUrlTokens = () => {
      // First check URL query parameters
      const accessToken = searchParams.get('access_token');
      const refreshToken = searchParams.get('refresh_token');
      const type = searchParams.get('type');
      
      if (accessToken && refreshToken) {
        return { accessToken, refreshToken, type, source: 'query' };
      }
      
      // If not found in query params, check URL fragments
      const hash = window.location.hash.substring(1);
      if (hash) {
        const fragmentParams = new URLSearchParams(hash);
        const fragmentAccessToken = fragmentParams.get('access_token');
        const fragmentRefreshToken = fragmentParams.get('refresh_token');
        const fragmentType = fragmentParams.get('type');
        
        // Check for error states in fragments
        const error = fragmentParams.get('error');
        const errorDescription = fragmentParams.get('error_description');
        
        if (error) {
          return { error, errorDescription, source: 'fragment' };
        }
        
        if (fragmentAccessToken && fragmentRefreshToken) {
          return { 
            accessToken: fragmentAccessToken, 
            refreshToken: fragmentRefreshToken, 
            type: fragmentType, 
            source: 'fragment' 
          };
        }
      }
      
      return null;
    };

    // Check if we have a valid password reset session
    const checkSession = async () => {
      try {
        const tokens = parseUrlTokens();
        console.log("Processing password reset tokens from", tokens?.source || 'none');
        
        // Handle error states
        if (tokens?.error) {
          console.error("Reset link error:", tokens.error, tokens.errorDescription);
          if (tokens.error === 'access_denied' && tokens.errorDescription?.includes('expired')) {
            console.log("Link has expired");
          }
          setIsValidSession(false);
          setSessionLoading(false);
          return;
        }
        
        if (tokens?.accessToken && tokens?.refreshToken && tokens?.type === 'recovery') {
          console.log(`Setting session from ${tokens.source}`);
          
          // Set the session from tokens for password recovery
          const { data, error: sessionError } = await supabase.auth.setSession({
            access_token: tokens.accessToken,
            refresh_token: tokens.refreshToken,
          });
          
          if (sessionError) {
            console.error("Failed to set session:", sessionError);
            setIsValidSession(false);
          } else {
            console.log("Session set successfully from tokens");
            setIsValidSession(true);
            
            // Clear URL to prevent reprocessing and token leakage
            window.history.replaceState({}, document.title, '/reset-password');
          }
        } else {
          // Check existing session
          const { data: { session }, error } = await supabase.auth.getSession();
          
          if (error) {
            console.error("Session error:", error);
            setIsValidSession(false);
          } else if (session && session.user) {
            console.log("Valid existing session found");
            setIsValidSession(true);
          } else {
            console.log("No valid session or tokens found");
            setIsValidSession(false);
          }
        }
      } catch (error) {
        console.error("Error checking session:", error);
        setIsValidSession(false);
      } finally {
        setSessionLoading(false);
      }
    };

    checkSession();
    
    // Set up auth state change listener for PASSWORD_RECOVERY events
    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
      console.log('Auth state change event:', event, session?.user?.id);
      
      if (event === 'PASSWORD_RECOVERY') {
        console.log('PASSWORD_RECOVERY event detected');
        setIsValidSession(true);
        setSessionLoading(false);
      } else if (event === 'SIGNED_IN' && session) {
        console.log('User signed in during password recovery');
        // This might happen after setting the session
        setIsValidSession(true);
        setSessionLoading(false);
      }
    });
    
    // Cleanup subscription
    return () => {
      subscription?.unsubscribe();
    };
  }, [searchParams]);

  const handleResetPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (password !== confirmPassword) {
      showToast("Passwords do not match", "error");
      return;
    }

    if (password.length < 6) {
      showToast("Password must be at least 6 characters long", "error");
      return;
    }

    setLoading(true);

    try {
      const { error } = await supabase.auth.updateUser({
        password: password
      });

      if (error) throw error;

      showToast("Password updated successfully!", "success");
      
      // Sign out and redirect to login
      await supabase.auth.signOut();
      navigate("/auth", { 
        state: { 
          message: "Password reset successful! Please sign in with your new password.",
          type: "success"
        }
      });
    } catch (error: any) {
      showToast(`Failed to reset password: ${error.message}`, "error");
    } finally {
      setLoading(false);
    }
  };

  if (sessionLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto"></div>
          <p className="mt-2 text-muted-foreground">Verifying reset link...</p>
        </div>
      </div>
    );
  }

  if (!isValidSession) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background px-4">
        <Card className="w-full max-w-md">
          <CardHeader className="text-center space-y-2">
            <div className="flex items-center justify-center gap-3 mb-2">
              <img src="/logo.svg" alt="EduHive Logo" className="h-8 w-8" />
              <CardTitle className="text-2xl font-bold text-primary">EduHive</CardTitle>
            </div>
            <CardDescription>
              Invalid or expired reset link
            </CardDescription>
          </CardHeader>

          <CardContent className="space-y-4">
            <div className="text-center space-y-4">
              <p className="text-muted-foreground">
                This password reset link is invalid or has expired. Please request a new one.
              </p>
              <Button
                onClick={() => navigate("/forgot-password")}
                className="w-full"
              >
                Request new reset link
              </Button>
              <Button
                variant="ghost"
                onClick={() => navigate("/auth")}
                className="w-full"
              >
                Back to sign in
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-background px-4">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center space-y-2">
          <div className="flex items-center justify-center gap-3 mb-2">
            <img src="/logo.svg" alt="EduHive Logo" className="h-8 w-8" />
            <CardTitle className="text-2xl font-bold text-primary">EduHive</CardTitle>
          </div>
          <CardDescription>
            Enter your new password
          </CardDescription>
        </CardHeader>

        <CardContent>
          <form onSubmit={handleResetPassword} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="password">New Password</Label>
              <div className="relative">
                <Lock className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                <Input
                  id="password"
                  type={showPassword ? "text" : "password"}
                  placeholder="Enter new password"
                  className="pl-10 pr-10"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  minLength={6}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-3 text-muted-foreground hover:text-foreground"
                >
                  {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="confirmPassword">Confirm New Password</Label>
              <div className="relative">
                <Lock className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                <Input
                  id="confirmPassword"
                  type={showConfirmPassword ? "text" : "password"}
                  placeholder="Confirm new password"
                  className="pl-10 pr-10"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  required
                  minLength={6}
                />
                <button
                  type="button"
                  onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                  className="absolute right-3 top-3 text-muted-foreground hover:text-foreground"
                >
                  {showConfirmPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </div>

            {password && confirmPassword && password !== confirmPassword && (
              <p className="text-sm text-red-500">Passwords do not match</p>
            )}

            <Button 
              type="submit" 
              className="w-full" 
              disabled={loading || password !== confirmPassword || !password}
            >
              {loading ? "Updating..." : "Update password"}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
