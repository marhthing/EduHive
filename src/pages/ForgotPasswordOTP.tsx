
import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useTwitterToast } from "@/components/ui/twitter-toast";
import { Mail, ArrowLeft } from "lucide-react";

export default function ForgotPasswordOTP() {
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [emailSent, setEmailSent] = useState(false);
  const { showToast } = useTwitterToast();
  const navigate = useNavigate();

  const generateOTP = () => {
    return Math.floor(10000000 + Math.random() * 90000000).toString();
  };

  const handleSendOTP = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      // First check if user exists
      const { data: userData, error: userError } = await supabase
        .from('profiles')
        .select('user_id')
        .eq('email', email)
        .single();

      if (userError || !userData) {
        showToast("No account found with this email address.", "error");
        setLoading(false);
        return;
      }

      // Generate OTP
      const otp = generateOTP();
      const expiresAt = new Date(Date.now() + 10 * 60 * 1000); // 10 minutes from now

      // Store OTP in database (you'll need to create this table)
      const { error: otpError } = await supabase
        .from('password_reset_otps')
        .upsert({
          email: email,
          otp_code: otp,
          expires_at: expiresAt.toISOString(),
          used: false
        });

      if (otpError) {
        console.error('Error storing OTP:', otpError);
        showToast("Failed to generate verification code. Please try again.", "error");
        setLoading(false);
        return;
      }

      // Send email with OTP (using Supabase Auth for now as a workaround)
      // You can replace this with a proper email service later
      const { error: emailError } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: `${window.location.origin}/verify-otp?email=${encodeURIComponent(email)}&otp=${otp}`,
      });

      if (emailError) {
        console.error('Error sending email:', emailError);
        showToast("Failed to send verification code. Please try again.", "error");
        setLoading(false);
        return;
      }

      setEmailSent(true);
      showToast(`Verification code sent to ${email}`, "success");
    } catch (error: any) {
      console.error('Error in OTP flow:', error);
      showToast(`Failed to send verification code: ${error.message}`, "error");
    } finally {
      setLoading(false);
    }
  };

  if (emailSent) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background px-4">
        <Card className="w-full max-w-md">
          <CardHeader className="text-center space-y-2">
            <div className="flex items-center justify-center gap-3 mb-2">
              <img src="/logo.svg" alt="EduHive Logo" className="h-8 w-8" />
              <CardTitle className="text-2xl font-bold text-primary">EduHive</CardTitle>
            </div>
            <CardDescription>
              Verification code sent
            </CardDescription>
          </CardHeader>

          <CardContent className="space-y-4">
            <div className="text-center space-y-4">
              <div className="mx-auto w-16 h-16 bg-green-100 rounded-full flex items-center justify-center">
                <Mail className="w-8 h-8 text-green-600" />
              </div>
              <div>
                <h3 className="text-lg font-semibold">Check your email</h3>
                <p className="text-muted-foreground mt-2">
                  We've sent an 8-digit verification code to <strong>{email}</strong>
                </p>
              </div>
              <div className="text-sm text-muted-foreground">
                <p>The code will expire in 10 minutes.</p>
              </div>
            </div>

            <div className="flex flex-col gap-2">
              <Button
                onClick={() => navigate(`/verify-otp?email=${encodeURIComponent(email)}`)}
                className="w-full"
              >
                Enter verification code
              </Button>
              <Button
                variant="outline"
                onClick={() => setEmailSent(false)}
                className="w-full"
              >
                Try different email
              </Button>
              <Button
                variant="ghost"
                onClick={() => navigate("/auth")}
                className="w-full"
              >
                <ArrowLeft className="w-4 h-4 mr-2" />
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
            Enter your email to receive a verification code
          </CardDescription>
        </CardHeader>

        <CardContent>
          <form onSubmit={handleSendOTP} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <div className="relative">
                <Mail className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                <Input
                  id="email"
                  type="email"
                  placeholder="Enter your email"
                  className="pl-10"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                />
              </div>
            </div>

            <Button type="submit" className="w-full" disabled={loading}>
              {loading ? "Sending..." : "Send verification code"}
            </Button>

            <div className="text-center">
              <Link 
                to="/auth" 
                className="text-sm text-muted-foreground hover:text-primary transition-colors"
              >
                <ArrowLeft className="w-4 h-4 inline mr-1" />
                Back to sign in
              </Link>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
