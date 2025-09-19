import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Camera, Save, LogOut, Trash2, X, Key, Eye, EyeOff } from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { supabase } from "@/integrations/supabase/client";
import { useTwitterToast } from "@/components/ui/twitter-toast";
import { format } from "date-fns";

interface Profile {
  id: string;
  user_id: string;
  username: string;
  name: string | null;
  email: string;
  bio: string | null;
  school: string | null;
  department: string | null;
  year: number | null;
  profile_pic: string | null;
  last_username_change: string | null;
}

// Mapping between display labels and database numeric codes
const ACADEMIC_YEAR_MAPPING = {
  1: "Junior Secondary",
  2: "Senior Secondary", 
  3: "Undergraduate",
  4: "Graduate",
  5: "Postgraduate"
} as const;

// Reverse mapping for saving to database
const ACADEMIC_YEAR_REVERSE_MAPPING = Object.fromEntries(
  Object.entries(ACADEMIC_YEAR_MAPPING).map(([key, value]) => [value, parseInt(key)])
) as Record<string, number>;

export default function Settings() {
  const navigate = useNavigate();
  const { showToast } = useTwitterToast();
  const [loading, setLoading] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [formData, setFormData] = useState({
    username: "",
    name: "",
    bio: "",
    school: "",
    department: "",
    year: "",
  });
  const [canChangeUsername, setCanChangeUsername] = useState(true);
  const [nextUsernameChange, setNextUsernameChange] = useState<Date | null>(null);
  const [passwordData, setPasswordData] = useState({
    currentPassword: "",
    newPassword: "",
    confirmPassword: "",
  });
  const [showCurrentPassword, setShowCurrentPassword] = useState(false);
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [changingPassword, setChangingPassword] = useState(false);

  const fetchProfile = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        navigate('/auth');
        return;
      }

      const { data: profileData, error } = await supabase
        .from("profiles")
        .select("*")
        .eq("user_id", user.id)
        .single();

      if (error) throw error;

      setProfile(profileData);
      
      // Check if user can change username (once per month)
      const lastChange = profileData.last_username_change ? new Date(profileData.last_username_change) : null;
      const now = new Date();
      
      if (lastChange) {
        // Calculate next allowed change date (30 days after last change)
        const nextChange = new Date(lastChange.getTime() + (30 * 24 * 60 * 60 * 1000));
        
        const canChange = now >= nextChange;
        setCanChangeUsername(canChange);
        
        if (!canChange) {
          setNextUsernameChange(nextChange);
        }
      } else {
        // No previous change, can change anytime
        setCanChangeUsername(true);
      }
      
      setFormData({
        username: profileData.username || "",
        name: profileData.name || "",
        bio: profileData.bio || "",
        school: profileData.school || "",
        department: profileData.department || "",
        year: profileData.year ? ACADEMIC_YEAR_MAPPING[profileData.year as keyof typeof ACADEMIC_YEAR_MAPPING] || "" : "",
      });
    } catch (error) {
      console.error("Error fetching profile:", error);
      showToast("Failed to load profile data", "error");
    }
  };

  const handleRemoveAvatar = async () => {
    if (!profile?.profile_pic) return;

    setUploading(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("User not authenticated");

      // Update profile to remove avatar URL
      const { error: updateError } = await supabase
        .from('profiles')
        .update({ profile_pic: null })
        .eq('user_id', user.id);

      if (updateError) throw updateError;

      setProfile({ ...profile, profile_pic: null });
      showToast("Profile picture removed", "success");
    } catch (error: any) {
      console.error('Avatar removal error:', error);
      showToast(error.message || "Failed to remove avatar", "error");
    } finally {
      setUploading(false);
    }
  };

  const handleAvatarUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    // Validate file type
    if (!file.type.startsWith('image/')) {
      showToast("Please select an image file", "error");
      return;
    }

    // Validate file size (max 5MB)
    if (file.size > 5 * 1024 * 1024) {
      showToast("Please select an image smaller than 5MB", "error");
      return;
    }

    setUploading(true);

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("User not authenticated");

      // Upload to Supabase Storage with user ID in path
      const fileExt = file.name.split('.').pop();
      const fileName = `avatar_${Date.now()}.${fileExt}`;
      const filePath = `${user.id}/${fileName}`;

      const { error: uploadError } = await supabase.storage
        .from('avatars')
        .upload(filePath, file, { upsert: true });

      if (uploadError) throw uploadError;

      // Get public URL
      const { data: { publicUrl } } = supabase.storage
        .from('avatars')
        .getPublicUrl(filePath);

      // Update profile with new avatar URL
      const { error: updateError } = await supabase
        .from('profiles')
        .update({ profile_pic: publicUrl })
        .eq('user_id', user.id);

      if (updateError) throw updateError;

      setProfile({ ...profile, profile_pic: publicUrl });

      // Removed success notification - Twitter style minimalism
    } catch (error: any) {
      console.error('Avatar upload error:', error);
      showToast(error.message || "Failed to upload avatar", "error");
    } finally {
      setUploading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!profile) return;

    // Validate username
    if (formData.username.length < 3) {
      showToast("Username must be at least 3 characters long", "error");
      return;
    }

    setLoading(true);

    try {
      const updateData: any = {
        name: formData.name.trim() || null,
        bio: formData.bio.trim() || null,
        school: formData.school.trim() || null,
        department: formData.department.trim() || null,
      };

      // Only update year if user has selected a value (preserve existing values)
      if (formData.year && formData.year !== "none") {
        updateData.year = ACADEMIC_YEAR_REVERSE_MAPPING[formData.year] || null;
      }

      // Only update username if it's changed and user can change it
      const usernameChanged = formData.username.trim() !== profile.username;
      if (usernameChanged) {
        if (!canChangeUsername) {
          throw new Error("You can only change your username once per month");
        }
        updateData.username = formData.username.trim();
        updateData.last_username_change = new Date().toISOString();
      }

      const { error } = await supabase
        .from('profiles')
        .update(updateData)
        .eq('user_id', profile.user_id);

      if (error) {
        if (error.code === '23505') {
          throw new Error("Username is already taken");
        }
        throw error;
      }

      // Redirect to updated profile
      navigate(`/profile/${formData.username}`);
    } catch (error: any) {
      console.error('Error updating profile:', error);
      showToast(error.message || "Failed to update profile", "error");
    } finally {
      setLoading(false);
    }
  };

  const handleSignOut = async () => {
    try {
      const { error } = await supabase.auth.signOut();
      if (error) throw error;
      navigate('/');
    } catch (error) {
      console.error('Error signing out:', error);
      showToast("Failed to sign out", "error");
    }
  };

  const handleDeleteAccount = async () => {
    if (!profile) return;

    try {
      const { data, error } = await supabase.rpc('deactivate_account', {
        target_user_id: profile.user_id
      });

      if (error) throw error;

      showToast("Account deactivated. You have 60 days to reactivate before permanent deletion.", "info");
      
      // Sign out the user
      await handleSignOut();
    } catch (error: any) {
      console.error('Error deactivating account:', error);
      showToast(error.message || "Failed to deactivate account", "error");
    }
  };

  const handlePasswordChange = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (passwordData.newPassword !== passwordData.confirmPassword) {
      showToast("New passwords don't match", "error");
      return;
    }
    
    if (passwordData.newPassword.length < 6) {
      showToast("Password must be at least 6 characters long", "error");
      return;
    }
    
    setChangingPassword(true);
    
    try {
      const { error } = await supabase.auth.updateUser({
        password: passwordData.newPassword
      });
      
      if (error) throw error;
      
      showToast("Password updated successfully", "success");
      setPasswordData({
        currentPassword: "",
        newPassword: "",
        confirmPassword: "",
      });
    } catch (error: any) {
      console.error('Password change error:', error);
      showToast(error.message || "Failed to change password", "error");
    } finally {
      setChangingPassword(false);
    }
  };

  useEffect(() => {
    fetchProfile();
  }, []);

  if (!profile) {
    return (
      <div className="container mx-auto px-4 py-6 max-w-2xl">
        <div className="text-center py-8">
          <img src="/logo-animated.svg" alt="Loading" className="h-8 w-8 mx-auto" />
          <p className="mt-2 text-muted-foreground">Loading settings...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-6 max-w-2xl">
      <Card>
        <CardHeader>
          <CardTitle>Profile Settings</CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Avatar Section */}
          <div className="flex flex-col items-center space-y-4">
            <div className="relative">
              <Avatar className="w-24 h-24">
                <AvatarImage src={profile.profile_pic || ""} />
                <AvatarFallback className="text-2xl">
                  {profile.username.charAt(0).toUpperCase()}
                </AvatarFallback>
              </Avatar>
              {profile.profile_pic && (
                <Button
                  variant="destructive"
                  size="sm"
                  className="absolute -top-2 -right-2 rounded-full w-8 h-8 p-0"
                  onClick={handleRemoveAvatar}
                  disabled={uploading}
                >
                  <X className="w-4 h-4" />
                </Button>
              )}
            </div>
            <Button
              variant="outline"
              size="sm"
              disabled={uploading}
              asChild
            >
              <label htmlFor="avatar-upload" className="cursor-pointer">
                <Camera className="w-4 h-4 mr-2" />
                {uploading ? "Uploading..." : "Change Picture"}
              </label>
            </Button>
            <input
              id="avatar-upload"
              type="file"
              accept="image/*"
              onChange={handleAvatarUpload}
              className="hidden"
              disabled={uploading}
            />
          </div>

          {/* Profile Form */}
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                value={profile.email}
                disabled
                className="bg-muted"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="name">Full Name</Label>
              <Input
                id="name"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                placeholder="Enter your full name"
                disabled={loading}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="username">Username</Label>
              <Input
                id="username"
                value={formData.username}
                onChange={(e) => setFormData({ ...formData, username: e.target.value })}
                placeholder="Enter your username"
                disabled={loading || !canChangeUsername}
                required
                minLength={3}
              />
              {!canChangeUsername && nextUsernameChange && (
                <p className="text-sm text-muted-foreground">
                  You can change your username again on {format(nextUsernameChange, 'MMMM d, yyyy')}
                </p>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="bio">Bio</Label>
              <Textarea
                id="bio"
                value={formData.bio}
                onChange={(e) => setFormData({ ...formData, bio: e.target.value })}
                placeholder="Tell us about yourself..."
                className="resize-none"
                rows={3}
                disabled={loading}
                maxLength={500}
              />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="school">School/University</Label>
                <Input
                  id="school"
                  value={formData.school}
                  onChange={(e) => setFormData({ ...formData, school: e.target.value })}
                  placeholder="e.g., University of Lagos"
                  disabled={loading}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="department">Department</Label>
                <Input
                  id="department"
                  value={formData.department}
                  onChange={(e) => setFormData({ ...formData, department: e.target.value })}
                  placeholder="e.g., Computer Science"
                  disabled={loading}
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="year">Academic Year</Label>
              <Select value={formData.year || "none"} onValueChange={(value) => setFormData({ ...formData, year: value === "none" ? "" : value })}>
                <SelectTrigger>
                  <SelectValue placeholder="Select your year" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Not specified</SelectItem>
                  {Object.values(ACADEMIC_YEAR_MAPPING).map((label) => (
                    <SelectItem key={label} value={label}>{label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <Button type="submit" disabled={loading} className="w-full">
              <Save className="w-4 h-4 mr-2" />
              {loading ? "Saving..." : "Save Changes"}
            </Button>
          </form>

          {/* Password Change Section */}
          <div className="border-t pt-6">
            <h3 className="text-lg font-semibold mb-4">Change Password</h3>
            <form onSubmit={handlePasswordChange} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="current-password">Current Password</Label>
                <div className="relative">
                  <Input
                    id="current-password"
                    type={showCurrentPassword ? "text" : "password"}
                    value={passwordData.currentPassword}
                    onChange={(e) => setPasswordData({ ...passwordData, currentPassword: e.target.value })}
                    placeholder="Enter your current password"
                    disabled={changingPassword}
                    required
                  />
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="absolute right-0 top-0 h-full px-3 py-2 hover:bg-transparent"
                    onClick={() => setShowCurrentPassword(!showCurrentPassword)}
                  >
                    {showCurrentPassword ? (
                      <EyeOff className="h-4 w-4" />
                    ) : (
                      <Eye className="h-4 w-4" />
                    )}
                  </Button>
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="new-password">New Password</Label>
                <div className="relative">
                  <Input
                    id="new-password"
                    type={showNewPassword ? "text" : "password"}
                    value={passwordData.newPassword}
                    onChange={(e) => setPasswordData({ ...passwordData, newPassword: e.target.value })}
                    placeholder="Enter your new password"
                    disabled={changingPassword}
                    required
                    minLength={6}
                  />
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="absolute right-0 top-0 h-full px-3 py-2 hover:bg-transparent"
                    onClick={() => setShowNewPassword(!showNewPassword)}
                  >
                    {showNewPassword ? (
                      <EyeOff className="h-4 w-4" />
                    ) : (
                      <Eye className="h-4 w-4" />
                    )}
                  </Button>
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="confirm-password">Confirm New Password</Label>
                <div className="relative">
                  <Input
                    id="confirm-password"
                    type={showConfirmPassword ? "text" : "password"}
                    value={passwordData.confirmPassword}
                    onChange={(e) => setPasswordData({ ...passwordData, confirmPassword: e.target.value })}
                    placeholder="Confirm your new password"
                    disabled={changingPassword}
                    required
                    minLength={6}
                  />
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="absolute right-0 top-0 h-full px-3 py-2 hover:bg-transparent"
                    onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                  >
                    {showConfirmPassword ? (
                      <EyeOff className="h-4 w-4" />
                    ) : (
                      <Eye className="h-4 w-4" />
                    )}
                  </Button>
                </div>
              </div>

              <Button type="submit" disabled={changingPassword} className="w-full">
                <Key className="w-4 h-4 mr-2" />
                {changingPassword ? "Changing..." : "Change Password"}
              </Button>
            </form>
          </div>

          {/* Danger Zone */}
          <div className="border-t pt-6 space-y-4">
            <h3 className="text-lg font-semibold text-destructive">Danger Zone</h3>

            <div className="flex gap-4">
              <Button
                variant="outline"
                onClick={handleSignOut}
                className="flex-1"
              >
                <LogOut className="w-4 h-4 mr-2" />
                Sign Out
              </Button>

              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <Button variant="destructive" className="flex-1">
                    <Trash2 className="w-4 h-4 mr-2" />
                    Delete Account
                  </Button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>Delete Account</AlertDialogTitle>
                    <AlertDialogDescription>
                      This action cannot be undone. This will permanently delete your
                      account and remove your data from our servers.
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>Cancel</AlertDialogCancel>
                    <AlertDialogAction
                      onClick={handleDeleteAccount}
                      className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                    >
                      Delete Account
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}