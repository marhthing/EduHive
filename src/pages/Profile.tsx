import { useState, useEffect, useCallback } from "react";
import { useParams, Link, useNavigate } from "react-router-dom";
import { Calendar, MapPin, School, Settings, Edit3 } from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { supabase } from "@/integrations/supabase/client";
import { PostItem } from "@/components/PostItem";
import { useTwitterToast } from "@/components/ui/twitter-toast";
import { format } from "date-fns";
import { FollowersModal } from "@/components/FollowersModal";
import { FollowingModal } from "@/components/FollowingModal";

interface Profile {
  id: string; // profiles table primary key
  user_id: string; // auth user id
  username: string;
  name: string | null;
  email: string;
  bio: string | null;
  school: string | null;
  department: string | null;
  year: number | null;
  profile_pic: string | null;
  created_at: string;
  followers_count: number;
  following_count: number;
}

interface Post {
  id: string;
  user_id: string;
  body: string;
  attachment_url: string | null;
  attachment_type: string | null;
  school_tag: string | null;
  course_tag: string | null;
  created_at: string;
  profile: {
    username: string;
    name: string | null;
    profile_pic: string | null;
    school: string | null;
    department: string | null;
  } | null;
  likes_count: number;
  comments_count: number;
  is_liked: boolean;
  is_bookmarked: boolean;
}

export default function Profile() {
  const { username } = useParams<{ username: string }>();
  const [profile, setProfile] = useState<Profile | null>(null);
  const [posts, setPosts] = useState<Post[]>([]);
  const [loading, setLoading] = useState(true);
  const [currentUser, setCurrentUser] = useState<any>(null);
  const [currentUserProfile, setCurrentUserProfile] = useState<any>(null);
  const [activeTab, setActiveTab] = useState("posts");
  const [isFollowing, setIsFollowing] = useState(false);
  const [followingUser, setFollowingUser] = useState(false);
  const { showToast } = useTwitterToast();
  const navigate = useNavigate();

  // State for follower counts, to be managed locally before fetching from DB again if needed
  const [followersCount, setFollowersCount] = useState(0);
  const [followingCount, setFollowingCount] = useState(0);
  
  // Modal states
  const [showFollowersModal, setShowFollowersModal] = useState(false);
  const [showFollowingModal, setShowFollowingModal] = useState(false);
  
  // State for fetching username from localStorage
  const [fetchingUsername, setFetchingUsername] = useState(false);
  const [fetchedUsername, setFetchedUsername] = useState<string>("");


  const fetchProfile = useCallback(async () => {
    try {
      let profileData;
      let error;

      if (username) {
        // Fetch profile by username
        const result = await supabase
          .from("profiles")
          .select("*")
          .eq("username", username)
          .single();
        profileData = result.data;
        error = result.error;
      } else {
        // No username provided, we need to redirect to current user's profile
        // First try to get current user
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) {
          navigate('/auth');
          return;
        }

        // Try localStorage first for faster redirect
        const storedUsername = localStorage.getItem(`username_${user.id}`);
        if (storedUsername) {
          navigate(`/profile/${storedUsername}`, { replace: true });
          return;
        }

        // Fetch current user's profile
        const result = await supabase
          .from("profiles")
          .select("*")
          .eq("user_id", user.id)
          .single();
        
        if (result.error) throw result.error;
        if (!result.data) throw new Error("Profile not found");
        
        // Store for future use
        localStorage.setItem(`username_${user.id}`, result.data.username);
        
        // Immediately redirect to the proper profile URL
        navigate(`/profile/${result.data.username}`, { replace: true });
        return;
      }

      if (error) throw error;
      
      console.log("Profile data fetched:", profileData);
      console.log("Followers count from DB:", profileData.followers_count);
      console.log("Following count from DB:", profileData.following_count);
      
      // Get actual follower count from follows table
      const { count: actualFollowersCount } = await supabase
        .from("follows")
        .select("*", { count: "exact", head: true })
        .eq("following_id", profileData.user_id);

      // Get actual following count from follows table
      const { count: actualFollowingCount } = await supabase
        .from("follows")
        .select("*", { count: "exact", head: true })
        .eq("follower_id", profileData.user_id);

      console.log("Actual followers count:", actualFollowersCount);
      console.log("Actual following count:", actualFollowingCount);
      
      setProfile(profileData);
      setFollowersCount(actualFollowersCount || 0);
      setFollowingCount(actualFollowingCount || 0);

      // Check if current user is following this profile
      if (currentUser && profileData) {
        const { data: followData } = await supabase
          .from("follows")
          .select("id")
          .eq("follower_id", currentUser.id)
          .eq("following_id", profileData.user_id)
          .single();

        setIsFollowing(!!followData);
      }
    } catch (error) {
      console.error("Error fetching profile:", error);
      showToast("Profile not found", "error");
    }
  }, [username, currentUser, showToast]);

  const fetchUserPosts = async (userId: string) => {
    try {
      const { data: postsData, error } = await supabase
        .from("posts")
        .select("*")
        .eq("user_id", userId)
        .order("created_at", { ascending: false });

      if (error) throw error;

      const { data: { user } } = await supabase.auth.getUser();

      const postsWithCounts = await Promise.all(
        (postsData || []).map(async (post) => {
          const [likesResult, commentsResult, userLikeResult, userBookmarkResult, profileResult] = await Promise.all([
            supabase.from("likes").select("id", { count: "exact" }).eq("post_id", post.id),
            supabase.from("comments").select("id", { count: "exact" }).eq("post_id", post.id),
            user ? supabase.from("likes").select("id").eq("post_id", post.id).eq("user_id", user.id).single() : null,
            user ? supabase.from("bookmarks").select("id").eq("post_id", post.id).eq("user_id", user.id).single() : null,
            supabase.from("profiles").select("username, name, profile_pic, school, department").eq("user_id", post.user_id).single()
          ]);

          return {
            ...post,
            profile: profileResult.data,
            likes_count: likesResult.count || 0,
            comments_count: commentsResult.count || 0,
            is_liked: !!userLikeResult?.data,
            is_bookmarked: !!userBookmarkResult?.data,
          };
        })
      );

      setPosts(postsWithCounts);
    } catch (error) {
      console.error("Error fetching user posts:", error);
    }
  };

  const handleToggleLike = async (postId: string) => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const post = posts.find(p => p.id === postId);
      if (!post) return;

      if (post.is_liked) {
        await supabase
          .from("likes")
          .delete()
          .eq("post_id", postId)
          .eq("user_id", user.id);
      } else {
        await supabase
          .from("likes")
          .insert({ post_id: postId, user_id: user.id });
      }

      setPosts(posts.map(p =>
        p.id === postId
          ? {
              ...p,
              is_liked: !p.is_liked,
              likes_count: p.is_liked ? p.likes_count - 1 : p.likes_count + 1
            }
          : p
      ));
    } catch (error) {
      console.error("Error toggling like:", error);
    }
  };

  const handleToggleBookmark = async (postId: string) => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const post = posts.find(p => p.id === postId);
      if (!post) return;

      if (post.is_bookmarked) {
        await supabase
          .from("bookmarks")
          .delete()
          .eq("post_id", postId)
          .eq("user_id", user.id);
      } else {
        await supabase
          .from("bookmarks")
          .insert({ post_id: postId, user_id: user.id });
      }

      setPosts(posts.map(p =>
        p.id === postId
          ? { ...p, is_bookmarked: !p.is_bookmarked }
          : p
      ));
    } catch (error) {
      console.error("Error toggling bookmark:", error);
    }
  };

  const handleDeletePost = async (postId: string) => {
    if (!currentUser) return;

    try {
      const { error } = await supabase
        .from('posts')
        .delete()
        .eq('id', postId)
        .eq('user_id', currentUser.id); // Ensure only owner can delete

      if (error) throw error;

      setPosts(posts.filter(p => p.id !== postId));
      showToast("Post deleted successfully", "success");
    } catch (error) {
      console.error('Error deleting post:', error);
      showToast("Failed to delete post. Please try again.", "error");
    }
  };

  const handleEditPost = (postId: string) => {
    navigate(`/post/edit/${postId}`);
  };

  const handleFollowToggle = async () => {
    if (!currentUser || followingUser) return;

    setFollowingUser(true);
    try {
      if (isFollowing) {
        // Unfollow
        const { error } = await supabase
          .from('follows')
          .delete()
          .eq('follower_id', currentUser.id)
          .eq('following_id', profile.user_id);

        if (error) {
          console.error('Unfollow error:', error);
          throw error;
        }

        setIsFollowing(false);
        showToast(`Unfollowed @${profile.username}`, "success");

        // Force refresh the profile to get updated counts from database
        setTimeout(() => {
          console.log("Refreshing profile after unfollow...");
          fetchProfile();
        }, 1000);
      } else {
        // Follow
        const { error } = await supabase
          .from('follows')
          .insert({
            follower_id: currentUser.id,
            following_id: profile.user_id
          });

        if (error) {
          // error in follow: { code: '23505', message: 'duplicate key value violates unique constraint "follows_follower_id_following_id_key"', ... }
          if (error.code === '23505') {
            showToast(`You are already following @${profile.username}`, "info");
          } else {
            console.error('Follow error:', error);
            throw error;
          }
        } else {
          setIsFollowing(true);
          showToast(`Following @${profile.username}`, "success");

          // Force refresh the profile to get updated counts from database
          setTimeout(() => {
            console.log("Refreshing profile after follow...");
            fetchProfile();
          }, 1000);
        }
      }
    } catch (error) {
      console.error('Error toggling follow:', error);
      showToast("Failed to update follow status. Please try again.", "error");
    } finally {
      setFollowingUser(false);
    }
  };

  const handleFetchUsernameFromDB = async () => {
    setFetchingUsername(true);
    setFetchedUsername("");
    
    try {
      if (!currentUser?.id) {
        showToast("You need to be logged in", "error");
        return;
      }
      
      // Show processing for a bit
      await new Promise(resolve => setTimeout(resolve, 1500));
      
      // Fetch username from database using the current user's ID
      const { data: profileData, error } = await supabase
        .from("profiles")
        .select("username")
        .eq("user_id", currentUser.id)
        .single();
      
      if (error) {
        console.error("Error fetching profile:", error);
        showToast("Error fetching your profile from database", "error");
        return;
      }
      
      if (profileData?.username) {
        setFetchedUsername(profileData.username);
        showToast(`Found your username: @${profileData.username}`, "success");
        
        // Store in localStorage for future use
        localStorage.setItem(`username_${currentUser.id}`, profileData.username);
        
        // Redirect to the proper profile URL
        setTimeout(() => {
          navigate(`/profile/${profileData.username}`, { replace: true });
        }, 1000);
      } else {
        showToast("No username found in your profile", "info");
      }
    } catch (error) {
      console.error("Error fetching username:", error);
      showToast("Error fetching username", "error");
    } finally {
      setFetchingUsername(false);
    }
  };


  useEffect(() => {
    const getCurrentUser = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      setCurrentUser(user);
    };

    getCurrentUser();
  }, []);

  useEffect(() => {
    if (username) {
      fetchProfile();
    }
  }, [username, currentUser, fetchProfile]); // Added fetchProfile dependency

  useEffect(() => {
    if (profile) {
      fetchUserPosts(profile.user_id);
      setLoading(false);

      // Subscribe to follow changes for this profile to refresh data
      const followsSubscription = supabase
        .channel(`profile-follows-${profile.user_id}`)
        .on('postgres_changes', 
          { event: 'INSERT', schema: 'public', table: 'follows', filter: `following_id=eq.${profile.user_id}` },
          (payload) => {
            console.log("Follow INSERT detected for this user being followed:", payload);
            // Someone followed this user - refresh profile data
            setTimeout(() => {
              console.log("Real-time refresh after follow INSERT");
              fetchProfile();
            }, 1000);
          }
        )
        .on('postgres_changes', 
          { event: 'DELETE', schema: 'public', table: 'follows', filter: `following_id=eq.${profile.user_id}` },
          (payload) => {
            console.log("Follow DELETE detected for this user being unfollowed:", payload);
            // Someone unfollowed this user - refresh profile data
            setTimeout(() => {
              console.log("Real-time refresh after follow DELETE");
              fetchProfile();
            }, 1000);
          }
        )
        .on('postgres_changes', 
          { event: 'INSERT', schema: 'public', table: 'follows', filter: `follower_id=eq.${profile.user_id}` },
          (payload) => {
            console.log("Following INSERT detected:", payload);
            // This user followed someone - refresh profile data for following count
            fetchProfile();
          }
        )
        .on('postgres_changes', 
          { event: 'DELETE', schema: 'public', table: 'follows', filter: `follower_id=eq.${profile.user_id}` },
          (payload) => {
            console.log("Following DELETE detected:", payload);
            // This user unfollowed someone - refresh profile data for following count
            fetchProfile();
          }
        )
        .subscribe();

      return () => {
        followsSubscription.unsubscribe();
      };
    }
  }, [profile, fetchProfile]); // Added fetchProfile dependency

  if (loading) {
    return (
      <div className="container mx-auto px-4 py-6 max-w-4xl">
        <div className="text-center py-8">
          <img src="/logo-animated.svg" alt="Loading" className="h-8 w-8 mx-auto" />
          <p className="mt-2 text-muted-foreground">Loading profile...</p>
        </div>
      </div>
    );
  }

  if (!profile) {
    return (
      <div className="container mx-auto px-4 py-6 max-w-4xl">
        <Card className="text-center py-12">
          <CardContent>
            <h3 className="text-lg font-semibold mb-2">Profile not found</h3>
            <p className="text-muted-foreground">
              The user you're looking for doesn't exist
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  const isOwnProfile = currentUser?.id === profile.user_id;

  return (
    <div className="container mx-auto px-4 py-6 max-w-4xl">
      <Card className="mb-6">
        <CardContent className="pt-6">
          <div className="flex flex-col md:flex-row gap-6">
            <Avatar className="w-24 h-24 mx-auto md:mx-0">
              <AvatarImage src={profile.profile_pic || ""} />
              <AvatarFallback className="text-2xl">
                {profile.username.charAt(0).toUpperCase()}
              </AvatarFallback>
            </Avatar>

            <div className="flex-1 text-center md:text-left">
              <div className="flex flex-col md:flex-row md:items-center gap-4 mb-4">
                <div>
                  <h1 className="text-2xl font-bold">{profile.name || profile.username}</h1>
                  <p className="text-muted-foreground">@{profile.username}</p>
                </div>
                <div className="flex gap-2">
                  {isOwnProfile ? (
                    <>
                      <Button asChild variant="outline" size="sm">
                        <Link to="/settings">
                          <Settings className="w-4 h-4 mr-2" />
                          Edit Profile
                        </Link>
                      </Button>
                      <Button
                        onClick={handleFetchUsernameFromDB}
                        disabled={fetchingUsername}
                        variant="secondary"
                        size="sm"
                      >
                        {fetchingUsername ? "Fetching..." : "Fetch My Username"}
                      </Button>
                    </>
                  ) : currentUser ? (
                    <Button
                      onClick={handleFollowToggle}
                      disabled={followingUser}
                      variant={isFollowing ? "outline" : "default"}
                      size="sm"
                    >
                      {followingUser ? "..." : isFollowing ? "Unfollow" : "Follow"}
                    </Button>
                  ) : null}
                </div>
              </div>

              {profile.bio && (
                <p className="text-muted-foreground mb-4">{profile.bio}</p>
              )}

              {fetchedUsername && (
                <div className="bg-secondary/50 rounded-lg p-3 mb-4">
                  <p className="text-sm font-medium text-secondary-foreground">
                    Username from localStorage: <span className="text-primary">@{fetchedUsername}</span>
                  </p>
                </div>
              )}

              <div className="flex flex-wrap gap-4 text-sm text-muted-foreground">
                {profile.school && (
                  <div className="flex items-center gap-1">
                    <School className="w-4 h-4" />
                    {profile.school}
                  </div>
                )}
                {profile.department && (
                  <div className="flex items-center gap-1">
                    <MapPin className="w-4 h-4" />
                    {profile.department}
                  </div>
                )}
                {profile.year && (
                  <div className="flex items-center gap-1">
                    <Calendar className="w-4 h-4" />
                    Year {profile.year}
                  </div>
                )}
                <div className="flex items-center gap-1">
                  <Calendar className="w-4 h-4" />
                  Joined {format(new Date(profile.created_at), "MMM yyyy")}
                </div>
              </div>

              <div className="flex gap-4 mt-4 justify-center md:justify-start">
                <div className="text-center p-2">
                  <div className="font-bold">{posts.length}</div>
                  <div className="text-sm text-muted-foreground">Posts</div>
                </div>
                <div 
                  className="text-center cursor-pointer hover:bg-muted/50 rounded-lg p-2 transition-colors"
                  onClick={() => setShowFollowersModal(true)}
                >
                  <div className="font-bold">{followersCount}</div>
                  <div className="text-sm text-muted-foreground">Followers</div>
                </div>
                <div 
                  className="text-center cursor-pointer hover:bg-muted/50 rounded-lg p-2 transition-colors"
                  onClick={() => setShowFollowingModal(true)}
                >
                  <div className="font-bold">{followingCount}</div>
                  <div className="text-sm text-muted-foreground">Following</div>
                </div>
                <div className="text-center p-2">
                  <div className="font-bold">
                    {posts.reduce((acc, post) => acc + post.likes_count, 0)}
                  </div>
                  <div className="text-sm text-muted-foreground">Likes</div>
                </div>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="w-full">
          <TabsTrigger value="posts" className="flex-1">
            Posts ({posts.length})
          </TabsTrigger>
          {/* Add other tabs here if needed, e.g., Followers, Following */}
        </TabsList>

        <TabsContent value="posts" className="mt-6">
          {posts.length === 0 ? (
            <Card className="text-center py-12">
              <CardContent>
                <Edit3 className="w-16 h-16 text-muted-foreground mx-auto mb-4" />
                <h3 className="text-lg font-semibold mb-2">No posts yet</h3>
                <p className="text-muted-foreground mb-4">
                  {isOwnProfile
                    ? "Share your first post to get started"
                    : `${profile.username} hasn't posted anything yet`
                  }
                </p>
                {isOwnProfile && (
                  <Button asChild>
                    <Link to="/post">Create Post</Link>
                  </Button>
                )}
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-4">
              {posts.map((post) => (
                <PostItem
                  key={post.id}
                  post={post}
                  currentUserId={currentUser?.id}
                  onLike={handleToggleLike}
                  onBookmark={handleToggleBookmark}
                  onComment={(postId) => navigate(`/post/${postId}`)}
                  onShare={() => {}} // Placeholder for share functionality
                  onEdit={handleEditPost}
                  onDelete={handleDeletePost}
                  showDropdown={isOwnProfile}
                />
              ))}
            </div>
          )}
        </TabsContent>
        {/* Add other TabsContent components here if needed */}
      </Tabs>

      {/* Modals */}
      {profile && (
        <>
          <FollowersModal
            isOpen={showFollowersModal}
            onClose={() => setShowFollowersModal(false)}
            profileUserId={profile.user_id}
            currentUserId={currentUser?.id || null}
          />
          <FollowingModal
            isOpen={showFollowingModal}
            onClose={() => setShowFollowingModal(false)}
            profileUserId={profile.user_id}
            currentUserId={currentUser?.id || null}
          />
        </>
      )}
    </div>
  );
}