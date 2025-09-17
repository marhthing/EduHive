
import { useState, useEffect } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useTwitterToast } from "@/components/ui/twitter-toast";
import { ArrowLeft, Shield } from "lucide-react";
import { InputOTP, InputOTPGroup, InputOTPSlot } from "@/components/ui/input-otp";

export default function VerifyOTP() {
  const [otp, setOtp] = useState("");
  const [loading, setLoading] = useState(false);
  const [email, setEmail] = useState("");
  const { showToast } = useTwitterToast();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();

  useEffect(() => {
    const emailParam = searchParams.get('email');
    if (emailParam) {
      setEmail(decodeURIComponent(emailParam));
    } else {
      navigate('/forgot-password-otp');
    }
  }, [searchParams, navigate]);

  const handleVerifyOTP = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (otp.length !== 8) {
      showToast("Please enter the complete 8-digit code", "error");
      return;
    }

    setLoading(true);

    try {
      // Verify OTP
      const { data: otpData, error: otpError } = await supabase
        .from('password_reset_otps')
        .select('*')
        .eq('email', email)
        .eq('otp_code', otp)
        .eq('used', false)
        .gt('expires_at', new Date().toISOString())
        .single();

      if (otpError || !otpData) {
        showToast("Invalid or expired verification code", "error");
        setLoading(false);
        return;
      }

      // Mark OTP as used
      const { error: updateError } = await supabase
        .from('password_reset_otps')
        .update({ used: true })
        .eq('id', otpData.id);

      if (updateError) {
        console.error('Error marking OTP as used:', updateError);
      }

      // Generate a temporary session token for password reset
      const resetToken = Math.random().toString(36).substring(2) + Date.now().toString(36);
      const expiresAt = new Date(Date.now() + 30 * 60 * 1000); // 30 minutes

      const { error: tokenError } = await supabase
        .from('password_reset_tokens')
        .insert({
          email: email,
          reset_token: resetToken,
          expires_at: expiresAt.toISOString(),
          used: false
        });

      if (tokenError) {
        console.error('Error creating reset token:', tokenError);
        showToast("Failed to create reset session. Please try again.", "error");
        setLoading(false);
        return;
      }

      showToast("Verification successful!", "success");
      navigate(`/reset-password-otp?token=${resetToken}&email=${encodeURIComponent(email)}`);
    } catch (error: any) {
      console.error('Error verifying OTP:', error);
      showToast(`Verification failed: ${error.message}`, "error");
    } finally {
      setLoading(false);
    }
  };

  const handleResendOTP = async () => {
    setLoading(true);
    try {
      const otp = Math.floor(10000000 + Math.random() * 90000000).toString();
      const expiresAt = new Date(Date.now() + 10 * 60 * 1000);

      await supabase
        .from('password_reset_otps')
        .upsert({
          email: email,
          otp_code: otp,
          expires_at: expiresAt.toISOString(),
          used: false
        });

      // Send new email
      await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: `${window.location.origin}/verify-otp?email=${encodeURIComponent(email)}&otp=${otp}`,
      });

      showToast("New verification code sent!", "success");
    } catch (error: any) {
      showToast(`Failed to resend code: ${error.message}`, "error");
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
            Enter the 8-digit verification code
          </CardDescription>
        </CardHeader>

        <CardContent className="space-y-6">
          <div className="text-center space-y-2">
            <div className="mx-auto w-16 h-16 bg-blue-100 rounded-full flex items-center justify-center">
              <Shield className="w-8 h-8 text-blue-600" />
            </div>
            <p className="text-sm text-muted-foreground">
              We sent a verification code to <strong>{email}</strong>
            </p>
          </div>

          <form onSubmit={handleVerifyOTP} className="space-y-6">
            <div className="space-y-2">
              <Label htmlFor="otp" className="text-center block">Verification Code</Label>
              <div className="flex justify-center">
                <InputOTP
                  maxLength={8}
                  value={otp}
                  onChange={setOtp}
                >
                  <InputOTPGroup>
                    <InputOTPSlot index={0} />
                    <InputOTPSlot index={1} />
                    <InputOTPSlot index={2} />
                    <InputOTPSlot index={3} />
                    <InputOTPSlot index={4} />
                    <InputOTPSlot index={5} />
                    <InputOTPSlot index={6} />
                    <InputOTPSlot index={7} />
                  </InputOTPGroup>
                </InputOTP>
              </div>
            </div>

            <Button 
              type="submit" 
              className="w-full" 
              disabled={loading || otp.length !== 8}
            >
              {loading ? "Verifying..." : "Verify Code"}
            </Button>

            <div className="flex flex-col gap-2">
              <Button
                type="button"
                variant="outline"
                onClick={handleResendOTP}
                disabled={loading}
                className="w-full"
              >
                Resend Code
              </Button>
              <Button
                variant="ghost"
                onClick={() => navigate("/forgot-password-otp")}
                className="w-full"
              >
                <ArrowLeft className="w-4 h-4 mr-2" />
                Try different email
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
