
import { useState, useEffect } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useTwitterToast } from "@/components/ui/twitter-toast";
import { Lock, Eye, EyeOff } from "lucide-react";

export default function ResetPasswordOTP() {
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [isValidToken, setIsValidToken] = useState(false);
  const [tokenLoading, setTokenLoading] = useState(true);
  const [email, setEmail] = useState("");
  
  const { showToast } = useTwitterToast();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();

  useEffect(() => {
    const checkToken = async () => {
      try {
        const token = searchParams.get('token');
        const emailParam = searchParams.get('email');
        
        if (!token || !emailParam) {
          setIsValidToken(false);
          setTokenLoading(false);
          return;
        }

        setEmail(decodeURIComponent(emailParam));

        // Verify reset token
        const { data: tokenData, error: tokenError } = await supabase
          .from('password_reset_tokens')
          .select('*')
          .eq('reset_token', token)
          .eq('email', decodeURIComponent(emailParam))
          .eq('used', false)
          .gt('expires_at', new Date().toISOString())
          .single();

        if (tokenError || !tokenData) {
          console.error('Invalid token:', tokenError);
          setIsValidToken(false);
        } else {
          setIsValidToken(true);
        }
      } catch (error) {
        console.error('Error checking token:', error);
        setIsValidToken(false);
      } finally {
        setTokenLoading(false);
      }
    };

    checkToken();
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
      const token = searchParams.get('token');
      
      // Mark token as used
      const { error: tokenUpdateError } = await supabase
        .from('password_reset_tokens')
        .update({ used: true })
        .eq('reset_token', token);

      if (tokenUpdateError) {
        console.error('Error updating token:', tokenUpdateError);
      }

      // Get user by email to update password
      const { data: profileData, error: profileError } = await supabase
        .from('profiles')
        .select('user_id')
        .eq('email', email)
        .single();

      if (profileError || !profileData) {
        showToast("User not found", "error");
        setLoading(false);
        return;
      }

      // Update password using admin function (you'll need to create this)
      const { error: updateError } = await supabase.rpc('update_user_password', {
        user_id: profileData.user_id,
        new_password: password
      });

      if (updateError) {
        console.error('Error updating password:', updateError);
        showToast("Failed to update password. Please try again.", "error");
        setLoading(false);
        return;
      }

      showToast("Password updated successfully!", "success");
      navigate("/auth", { 
        state: { 
          message: "Password reset successful! Please sign in with your new password.",
          type: "success"
        }
      });
    } catch (error: any) {
      console.error('Error resetting password:', error);
      showToast(`Failed to reset password: ${error.message}`, "error");
    } finally {
      setLoading(false);
    }
  };

  if (tokenLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto"></div>
          <p className="mt-2 text-muted-foreground">Verifying reset token...</p>
        </div>
      </div>
    );
  }

  if (!isValidToken) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background px-4">
        <Card className="w-full max-w-md">
          <CardHeader className="text-center space-y-2">
            <div className="flex items-center justify-center gap-3 mb-2">
              <img src="/logo.svg" alt="EduHive Logo" className="h-8 w-8" />
              <CardTitle className="text-2xl font-bold text-primary">EduHive</CardTitle>
            </div>
            <CardDescription>
              Invalid or expired reset session
            </CardDescription>
          </CardHeader>

          <CardContent className="space-y-4">
            <div className="text-center space-y-4">
              <p className="text-muted-foreground">
                This password reset session is invalid or has expired. Please start the process again.
              </p>
              <Button
                onClick={() => navigate("/forgot-password-otp")}
                className="w-full"
              >
                Start password reset
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
