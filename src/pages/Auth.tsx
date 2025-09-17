import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useTwitterToast } from "@/components/ui/twitter-toast";
import { Mail, Lock, User, GraduationCap, Building2 } from "lucide-react";

export default function Auth() {
  const [loading, setLoading] = useState(false);
  const [isSignUp, setIsSignUp] = useState(false);
  const [showReactivation, setShowReactivation] = useState(false);
  const [deactivationInfo, setDeactivationInfo] = useState<{
    deactivated_at: string;
    scheduled_deletion_at: string;
  } | null>(null);
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
  const { showToast } = useTwitterToast();

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
          setDeactivationInfo({
            deactivated_at: profileData.deactivated_at,
            scheduled_deletion_at: profileData.scheduled_deletion_at
          });
          setShowReactivation(true);
          return;
        }
      }

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
        }
      });
      if (error) throw error;
    } catch (error: any) {
      showToast(error.message || "Failed to sign in with Google", "error");
    } finally {
      setLoading(false);
    }
  };

  const handleReactivateAccount = async () => {
    try {
      setLoading(true);

      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('No user found');

      const { error } = await supabase.rpc('reactivate_account', {
        target_user_id: user.id
      });

      if (error) throw error;

      showToast("Account reactivated successfully! Welcome back.", "success");
      setShowReactivation(false);
      navigate("/");
    } catch (error: any) {
      console.error('Error reactivating account:', error);
      showToast(error.message || "Failed to reactivate account", "error");
    } finally {
      setLoading(false);
    }
  };

  if (showReactivation && deactivationInfo) {
    const deletionDate = new Date(deactivationInfo.scheduled_deletion_at);
    const daysLeft = Math.ceil((deletionDate.getTime() - Date.now()) / (1000 * 60 * 60 * 24));

    return (
      <div className="min-h-screen flex items-center justify-center bg-background px-4">
        <Card className="w-full max-w-md">
          <CardHeader className="text-center">
            <AlertCircle className="w-12 h-12 text-amber-500 mx-auto mb-2" />
            <CardTitle>Account Deactivated</CardTitle>
            <CardDescription>
              Your account was deactivated on {new Date(deactivationInfo.deactivated_at).toLocaleDateString()}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <Alert>
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>
                You have {daysLeft} days left to reactivate your account before it's permanently deleted.
              </AlertDescription>
            </Alert>

            <div className="space-y-3">
              <Button
                onClick={handleReactivateAccount}
                className="w-full"
                disabled={loading}
              >
                <RefreshCw className="w-4 h-4 mr-2" />
                {loading ? "Reactivating..." : "Reactivate Account"}
              </Button>

              <Button
                variant="outline"
                onClick={() => {
                  setShowReactivation(false);
                  supabase.auth.signOut();
                }}
                className="w-full"
              >
                Sign Out
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
              >
                Sign in with Google
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
      </Card>
    </div>
  );
}