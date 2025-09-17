
import { useState, useEffect } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useTwitterToast } from "@/components/ui/twitter-toast";
import { AlertCircle, RefreshCw, Calendar, Clock } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";

export default function AccountReactivation() {
  const [loading, setLoading] = useState(false);
  const [deactivationInfo, setDeactivationInfo] = useState<{
    deactivated_at: string;
    scheduled_deletion_at: string;
  } | null>(null);
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { showToast } = useTwitterToast();

  useEffect(() => {
    const fetchDeactivationInfo = async () => {
      try {
        const email = searchParams.get('email');
        if (!email) {
          navigate('/auth');
          return;
        }

        // Get user info from email
        const { data: { user }, error: authError } = await supabase.auth.getUser();
        
        if (authError || !user) {
          navigate('/auth');
          return;
        }

        // Get deactivation info
        const { data: profileData, error: profileError } = await supabase
          .from('profiles')
          .select('is_deactivated, deactivated_at, scheduled_deletion_at')
          .eq('user_id', user.id)
          .single();

        if (profileError || !profileData?.is_deactivated) {
          navigate('/');
          return;
        }

        setDeactivationInfo({
          deactivated_at: profileData.deactivated_at,
          scheduled_deletion_at: profileData.scheduled_deletion_at
        });
      } catch (error) {
        console.error('Error fetching deactivation info:', error);
        navigate('/auth');
      }
    };

    fetchDeactivationInfo();
  }, [searchParams, navigate]);

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
      
      // Sign out and redirect to login to start fresh
      await supabase.auth.signOut();
      navigate('/auth', { 
        state: { 
          message: 'Account reactivated! Please log in again.',
          type: 'success'
        }
      });
    } catch (error: any) {
      console.error('Error reactivating account:', error);
      showToast(error.message || "Failed to reactivate account", "error");
    } finally {
      setLoading(false);
    }
  };

  const handleSignOut = async () => {
    await supabase.auth.signOut();
    navigate('/auth');
  };

  if (!deactivationInfo) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background px-4">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto"></div>
          <p className="mt-2 text-muted-foreground">Loading...</p>
        </div>
      </div>
    );
  }

  const deletionDate = new Date(deactivationInfo.scheduled_deletion_at);
  const deactivatedDate = new Date(deactivationInfo.deactivated_at);
  const daysLeft = Math.ceil((deletionDate.getTime() - Date.now()) / (1000 * 60 * 60 * 24));
  const hoursLeft = Math.ceil((deletionDate.getTime() - Date.now()) / (1000 * 60 * 60));

  return (
    <div className="min-h-screen flex items-center justify-center bg-background px-4">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <AlertCircle className="w-16 h-16 text-amber-500 mx-auto mb-4" />
          <CardTitle className="text-2xl">Account Deactivated</CardTitle>
          <CardDescription>
            Your account was deactivated on {deactivatedDate.toLocaleDateString()}
          </CardDescription>
        </CardHeader>
        
        <CardContent className="space-y-6">
          <Alert className="border-amber-200 bg-amber-50">
            <Clock className="h-4 w-4 text-amber-600" />
            <AlertDescription className="text-amber-800">
              <strong>Time remaining:</strong> {daysLeft > 0 ? `${daysLeft} days` : `${hoursLeft} hours`} to reactivate your account before permanent deletion.
            </AlertDescription>
          </Alert>

          <div className="space-y-4">
            <div className="bg-muted p-4 rounded-lg space-y-2">
              <div className="flex items-center gap-2 text-sm">
                <Calendar className="w-4 h-4 text-muted-foreground" />
                <span className="font-medium">Deactivated:</span>
                <span>{deactivatedDate.toLocaleDateString()}</span>
              </div>
              <div className="flex items-center gap-2 text-sm">
                <AlertCircle className="w-4 h-4 text-destructive" />
                <span className="font-medium">Deletion scheduled:</span>
                <span className="text-destructive">{deletionDate.toLocaleDateString()}</span>
              </div>
            </div>

            <div className="text-sm text-muted-foreground space-y-2">
              <p>
                If you reactivate your account now, all your posts, comments, and connections will be restored.
              </p>
              <p className="text-amber-600 font-medium">
                After the deletion date, your account and all data will be permanently removed and cannot be recovered.
              </p>
            </div>
          </div>

          <div className="space-y-3">
            <Button
              onClick={handleReactivateAccount}
              className="w-full bg-green-600 hover:bg-green-700"
              disabled={loading}
              size="lg"
            >
              <RefreshCw className="w-4 h-4 mr-2" />
              {loading ? "Reactivating..." : "Reactivate My Account"}
            </Button>

            <Button
              variant="outline"
              onClick={handleSignOut}
              className="w-full"
              disabled={loading}
            >
              Cancel & Sign Out
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
