import { useState, useEffect } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useTwitterToast } from "@/components/ui/twitter-toast";
import { Mail, Lock, User, GraduationCap, Building2, AlertCircle, RefreshCw } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";

export default function Auth() {
  const [loading, setLoading] = useState(false);
  const [isSignUp, setIsSignUp] = useState(false);
  
  const [loginData, setLoginData] = useState({ email: "", password: "" });
  const [signupData, setSignupData] = useState({
    email: "",
    password: "",
    name: "",
    school: "",
    department: "",
    year: new Date().getFullYear(),
  });
  const navigate = useNavigate();
  const location = useLocation();
  const { showToast } = useTwitterToast();

  useEffect(() => {
    // Show message from navigation state (e.g., after reactivation)
    if (location.state?.message) {
      showToast(location.state.message, location.state.type || "info");
      // Clear the state
      navigate(location.pathname, { replace: true, state: {} });
    }
  }, [location.state, showToast, navigate, location.pathname]);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      const { data, error } = await supabase.auth.signInWithPassword({
        email: loginData.email,
        password: loginData.password,
      });

      if (error) throw error;

      // Check if account is deactivated
      if (data.user) {
        const { data: profileData, error: profileError } = await supabase
          .from('profiles')
          .select('is_deactivated, deactivated_at, scheduled_deletion_at')
          .eq('user_id', data.user.id)
          .single();

        if (profileError) {
          console.error('Error checking profile status:', profileError);
        } else if (profileData?.is_deactivated) {
          // Check if account is still within reactivation period
          const deletionDate = new Date(profileData.scheduled_deletion_at);
          const now = new Date();
          
          if (deletionDate > now) {
            // Account can still be reactivated - redirect to reactivation page
            setLoading(false);
            navigate(`/reactivate?email=${encodeURIComponent(loginData.email)}`);
            return;
          } else {
            // Account is past deletion date
            await supabase.auth.signOut();
            setLoading(false);
            showToast("This account has expired and cannot be recovered.", "error");
            return;
          }
        }
      }

      // Only navigate to home if account is active
      navigate("/");
    } catch (error: any) {
      showToast(`Login failed: ${error.message}`, "error");
    } finally {
      setLoading(false);
    }
  };

  const generateUniqueUsername = async (name: string): Promise<string> => {
    // Clean the name and create base username
    const cleanName = name.toLowerCase().replace(/[^a-z0-9]/g, '');
    let baseUsername = cleanName || 'user';

    // If name is too short, add some random characters
    if (baseUsername.length < 3) {
      baseUsername = 'user' + Math.random().toString(36).substring(2, 6);
    }

    let username = baseUsername;
    let counter = 1;

    // Check if username exists and generate unique one
    while (true) {
      const { data } = await supabase
        .from('profiles')
        .select('username')
        .eq('username', username)
        .single();

      if (!data) {
        // Username is available
        break;
      }

      // Try next variation
      username = `${baseUsername}${Math.random().toString(36).substring(2, 4)}${counter}`;
      counter++;

      if (counter > 10) {
        // Fallback to random username
        username = 'user' + Math.random().toString(36).substring(2, 8);
        break;
      }
    }

    return username;
  };

  const handleSignup = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      // Generate unique username
      const generatedUsername = await generateUniqueUsername(signupData.name);

      const { error } = await supabase.auth.signUp({
        email: signupData.email,
        password: signupData.password,
        options: {
          emailRedirectTo: `${window.location.origin}/`,
          data: {
            name: signupData.name,
            username: generatedUsername,
            school: signupData.school,
            department: signupData.department,
            year: signupData.year,
          },
        },
      });

      if (error) throw error;

      showToast("Account created! Please check your email to verify.", "success");
    } catch (error: any) {
      showToast(`Signup failed: ${error.message}`, "error");
    } finally {
      setLoading(false);
    }
  };

  const handleGoogleAuth = async () => {
    try {
      setLoading(true);
      const { error } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: {
          redirectTo: `${window.location.origin}/`,
          queryParams: {
            access_type: 'offline',
            prompt: 'consent',
          }
        }
      });
      
      if (error) {
        console.error('Google OAuth error:', error);
        throw error;
      }
    } catch (error: any) {
      console.error('Google sign-in failed:', error);
      if (error.message?.includes('OAuth')) {
        showToast("Google sign-in is not properly configured. Please use email/password instead.", "error");
      } else {
        showToast(error.message || "Failed to sign in with Google", "error");
      }
    } finally {
      setLoading(false);
    }
  };

  

  

  return (
    <div className="min-h-screen flex items-center justify-center bg-background px-4">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center space-y-2">
          <div className="flex items-center justify-center gap-3 mb-2">
            <img src="/logo.svg" alt="EduHive Logo" className="h-8 w-8" />
            <CardTitle className="text-2xl font-bold text-primary">EduHive</CardTitle>
          </div>
          <CardDescription>
            Join the student community to share notes and resources
          </CardDescription>
        </CardHeader>

        <CardContent>
          <Tabs value={isSignUp ? "signup" : "signin"} onValueChange={(value) => setIsSignUp(value === "signup")}>
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="signin">Sign In</TabsTrigger>
              <TabsTrigger value="signup">Sign Up</TabsTrigger>
            </TabsList>

          <TabsContent value="signin">
            <form onSubmit={handleLogin} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="login-email">Email</Label>
                <div className="relative">
                  <Mail className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                  <Input
                    id="login-email"
                    type="email"
                    placeholder="Enter your email"
                    className="pl-10"
                    value={loginData.email}
                    onChange={(e) => setLoginData({ ...loginData, email: e.target.value })}
                    required
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="login-password">Password</Label>
                <div className="relative">
                  <Lock className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                  <Input
                    id="login-password"
                    type="password"
                    placeholder="Enter your password"
                    className="pl-10"
                    value={loginData.password}
                    onChange={(e) => setLoginData({ ...loginData, password: e.target.value })}
                    required
                  />
                </div>
              </div>

              <Button type="submit" className="w-full" disabled={loading}>
                {loading ? "Signing in..." : "Sign In"}
              </Button>

              <Button
                variant="outline"
                className="w-full"
                onClick={handleGoogleAuth}
                disabled={loading}
                type="button"
              >
                {loading ? "Connecting to Google..." : "Sign in with Google"}
              </Button>
            </form>
          </TabsContent>

          <TabsContent value="signup">
            <form onSubmit={handleSignup} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="signup-email">Email</Label>
                <div className="relative">
                  <Mail className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                  <Input
                    id="signup-email"
                    type="email"
                    placeholder="Enter your email"
                    className="pl-10"
                    value={signupData.email}
                    onChange={(e) => setSignupData({ ...signupData, email: e.target.value })}
                    required
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="signup-password">Password</Label>
                <div className="relative">
                  <Lock className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                  <Input
                    id="signup-password"
                    type="password"
                    placeholder="Create a password"
                    className="pl-10"
                    value={signupData.password}
                    onChange={(e) => setSignupData({ ...signupData, password: e.target.value })}
                    required
                    minLength={6}
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="signup-name">Full Name</Label>
                <div className="relative">
                  <User className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                  <Input
                    id="signup-name"
                    type="text"
                    placeholder="Enter your full name"
                    className="pl-10"
                    value={signupData.name}
                    onChange={(e) => setSignupData({ ...signupData, name: e.target.value })}
                    required
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="signup-school">School</Label>
                <div className="relative">
                  <GraduationCap className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                  <Input
                    id="signup-school"
                    type="text"
                    placeholder="Your school/university"
                    className="pl-10"
                    value={signupData.school}
                    onChange={(e) => setSignupData({ ...signupData, school: e.target.value })}
                    required
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="signup-department">Department</Label>
                <div className="relative">
                  <Building2 className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                  <Input
                    id="signup-department"
                    type="text"
                    placeholder="Your department/major"
                    className="pl-10"
                    value={signupData.department}
                    onChange={(e) => setSignupData({ ...signupData, department: e.target.value })}
                    required
                  />
                </div>
              </div>

              <Button type="submit" className="w-full" disabled={loading}>
                {loading ? "Creating account..." : "Create Account"}
              </Button>
            </form>
          </TabsContent>
        </Tabs>
        </CardContent>
      </Card>
    </div>
  );
}