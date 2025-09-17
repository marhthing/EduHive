import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { supabase } from "@/integrations/supabase/client";
import { useTwitterToast } from "@/components/ui/twitter-toast";
import { useNavigate } from "react-router-dom";

interface FollowerUser {
  user_id: string;
  username: string;
  name: string | null;
  profile_pic: string | null;
  school: string | null;
  department: string | null;
}

interface FollowersModalProps {
  isOpen: boolean;
  onClose: () => void;
  profileUserId: string;
  currentUserId: string | null;
}

export function FollowersModal({ isOpen, onClose, profileUserId, currentUserId }: FollowersModalProps) {
  const [followers, setFollowers] = useState<FollowerUser[]>([]);
  const [loading, setLoading] = useState(false);
  const [followStates, setFollowStates] = useState<{[key: string]: boolean}>({});
  const [processingFollows, setProcessingFollows] = useState<{[key: string]: boolean}>({});
  const { showToast } = useTwitterToast();
  const navigate = useNavigate();

  const fetchFollowers = async () => {
    if (!profileUserId) return;
    
    setLoading(true);
    try {
      // Get followers of this profile
      const { data: followersData, error } = await supabase
        .from('follows')
        .select('follower_id')
        .eq('following_id', profileUserId);

      if (error) throw error;

      let followersList: FollowerUser[] = [];
      
      if (followersData && followersData.length > 0) {
        const followerIds = followersData.map(f => f.follower_id);
        const { data: profilesData, error: profilesError } = await supabase
          .from('profiles')
          .select('user_id, username, name, profile_pic, school, department')
          .in('user_id', followerIds);

        if (profilesError) throw profilesError;
        
        followersList = profilesData || [];
      }
      
      setFollowers(followersList);

      // Check follow states for current user
      if (currentUserId && followersList.length > 0) {
        const userIds = followersList.map(user => user.user_id);
        const { data: currentUserFollows } = await supabase
          .from('follows')
          .select('following_id')
          .eq('follower_id', currentUserId)
          .in('following_id', userIds);

        const followStateMap: {[key: string]: boolean} = {};
        followersList.forEach(user => {
          followStateMap[user.user_id] = currentUserFollows?.some(f => f.following_id === user.user_id) || false;
        });
        setFollowStates(followStateMap);
      }
    } catch (error) {
      console.error('Error fetching followers:', error);
      showToast('Failed to load followers', 'error');
    } finally {
      setLoading(false);
    }
  };

  const handleFollowToggle = async (targetUserId: string, targetUsername: string) => {
    if (!currentUserId || processingFollows[targetUserId]) return;

    setProcessingFollows(prev => ({ ...prev, [targetUserId]: true }));

    try {
      const isCurrentlyFollowing = followStates[targetUserId];

      if (isCurrentlyFollowing) {
        // Unfollow
        const { error } = await supabase
          .from('follows')
          .delete()
          .eq('follower_id', currentUserId)
          .eq('following_id', targetUserId);

        if (error) throw error;

        setFollowStates(prev => ({ ...prev, [targetUserId]: false }));
        showToast(`Unfollowed @${targetUsername}`, 'success');
      } else {
        // Follow
        const { error } = await supabase
          .from('follows')
          .insert({
            follower_id: currentUserId,
            following_id: targetUserId
          });

        if (error) {
          if (error.code === '23505') {
            showToast(`You are already following @${targetUsername}`, 'info');
          } else {
            throw error;
          }
        } else {
          setFollowStates(prev => ({ ...prev, [targetUserId]: true }));
          showToast(`Following @${targetUsername}`, 'success');
        }
      }
    } catch (error) {
      console.error('Error toggling follow:', error);
      showToast('Failed to update follow status', 'error');
    } finally {
      setProcessingFollows(prev => ({ ...prev, [targetUserId]: false }));
    }
  };

  useEffect(() => {
    if (isOpen) {
      fetchFollowers();
    }
  }, [isOpen, profileUserId]);

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-md max-h-[80vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle>Followers</DialogTitle>
        </DialogHeader>
        
        <div className="flex-1 overflow-y-auto">
          {loading ? (
            <div className="text-center py-8">
              <img src="/logo-animated.svg" alt="Loading" className="h-8 w-8 mx-auto" />
              <p className="mt-2 text-muted-foreground">Loading followers...</p>
            </div>
          ) : followers.length === 0 ? (
            <div className="text-center py-8">
              <p className="text-muted-foreground">No followers yet</p>
            </div>
          ) : (
            <div className="space-y-3">
              {followers.map((user) => (
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
                  
                  {currentUserId && currentUserId !== user.user_id && (
                    <Button
                      variant={followStates[user.user_id] ? "outline" : "default"}
                      size="sm"
                      onClick={() => handleFollowToggle(user.user_id, user.username)}
                      disabled={processingFollows[user.user_id]}
                    >
                      {processingFollows[user.user_id] 
                        ? "..." 
                        : followStates[user.user_id] 
                          ? "Unfollow" 
                          : "Follow"
                      }
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