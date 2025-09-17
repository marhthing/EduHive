import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { supabase } from "@/integrations/supabase/client";
import { useTwitterToast } from "@/components/ui/twitter-toast";
import { useNavigate } from "react-router-dom";

interface FollowingUser {
  user_id: string;
  username: string;
  name: string | null;
  profile_pic: string | null;
  school: string | null;
  department: string | null;
}

interface FollowingModalProps {
  isOpen: boolean;
  onClose: () => void;
  profileUserId: string;
  currentUserId: string | null;
}

export function FollowingModal({ isOpen, onClose, profileUserId, currentUserId }: FollowingModalProps) {
  const [following, setFollowing] = useState<FollowingUser[]>([]);
  const [loading, setLoading] = useState(false);
  const [processingUnfollows, setProcessingUnfollows] = useState<{[key: string]: boolean}>({});
  const { showToast } = useTwitterToast();
  const navigate = useNavigate();

  const fetchFollowing = async () => {
    if (!profileUserId) return;
    
    setLoading(true);
    try {
      // Get users that this profile is following
      const { data: followingData, error } = await supabase
        .from('follows')
        .select('following_id')
        .eq('follower_id', profileUserId);

      if (error) throw error;

      if (followingData && followingData.length > 0) {
        const followingIds = followingData.map(f => f.following_id);
        const { data: profilesData, error: profilesError } = await supabase
          .from('profiles')
          .select('user_id, username, name, profile_pic, school, department')
          .in('user_id', followingIds);

        if (profilesError) throw profilesError;
        
        const followingList = profilesData || [];
        setFollowing(followingList);
      } else {
        setFollowing([]);
      }
    } catch (error) {
      console.error('Error fetching following:', error);
      showToast('Failed to load following', 'error');
    } finally {
      setLoading(false);
    }
  };

  const handleUnfollow = async (targetUserId: string, targetUsername: string) => {
    if (!currentUserId || processingUnfollows[targetUserId]) return;
    
    // Only allow unfollowing if this is the current user's own profile
    if (currentUserId !== profileUserId) return;

    setProcessingUnfollows(prev => ({ ...prev, [targetUserId]: true }));

    try {
      const { error } = await supabase
        .from('follows')
        .delete()
        .eq('follower_id', currentUserId)
        .eq('following_id', targetUserId);

      if (error) throw error;

      // Remove from local state
      setFollowing(prev => prev.filter(user => user.user_id !== targetUserId));
      showToast(`Unfollowed @${targetUsername}`, 'success');
    } catch (error) {
      console.error('Error unfollowing:', error);
      showToast('Failed to unfollow', 'error');
    } finally {
      setProcessingUnfollows(prev => ({ ...prev, [targetUserId]: false }));
    }
  };

  useEffect(() => {
    if (isOpen) {
      fetchFollowing();
    }
  }, [isOpen, profileUserId]);

  const isOwnProfile = currentUserId === profileUserId;

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-md max-h-[80vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle>Following</DialogTitle>
        </DialogHeader>
        
        <div className="flex-1 overflow-y-auto">
          {loading ? (
            <div className="text-center py-8">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto"></div>
              <p className="mt-2 text-muted-foreground">Loading following...</p>
            </div>
          ) : following.length === 0 ? (
            <div className="text-center py-8">
              <p className="text-muted-foreground">Not following anyone yet</p>
            </div>
          ) : (
            <div className="space-y-3">
              {following.map((user) => (
                <div key={user.user_id} className="flex items-center justify-between p-3 rounded-lg hover:bg-muted/50">
                  <div className="flex items-center gap-3 flex-1 min-w-0">
                    <Avatar 
                      className="w-10 h-10 cursor-pointer" 
                      onClick={() => {
                        navigate(`/profile/${user.username}`);
                        onClose();
                      }}
                    >
                      <AvatarImage src={user.profile_pic || ""} />
                      <AvatarFallback>
                        {user.username.charAt(0).toUpperCase()}
                      </AvatarFallback>
                    </Avatar>
                    <div className="flex-1 min-w-0">
                      <p 
                        className="font-medium truncate cursor-pointer hover:underline"
                        onClick={() => {
                          navigate(`/profile/${user.username}`);
                          onClose();
                        }}
                      >
                        {user.name || user.username}
                      </p>
                      <p className="text-sm text-muted-foreground truncate">@{user.username}</p>
                      {user.school && (
                        <p className="text-xs text-muted-foreground truncate">{user.school}</p>
                      )}
                    </div>
                  </div>
                  
                  {isOwnProfile && (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleUnfollow(user.user_id, user.username)}
                      disabled={processingUnfollows[user.user_id]}
                    >
                      {processingUnfollows[user.user_id] ? "..." : "Unfollow"}
                    </Button>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}