import { useState, useEffect, useCallback } from "react";
import { useParams, Link, useNavigate } from "react-router-dom";
import { Calendar, MapPin, School, Settings, Edit3, MessageCircle, Heart } from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { supabase } from "@/integrations/supabase/client";
import { PostItem } from "@/components/PostItem";
import { useTwitterToast } from "@/components/ui/twitter-toast";
import { format } from "date-fns";
import { formatTimeShort } from "@/lib/timeFormat";
import { FollowersModal } from "@/components/FollowersModal";
import { FollowingModal } from "@/components/FollowingModal";
import { AI_BOT_PROFILE, AI_BOT_USER_ID } from "@/lib/aiBotProfile";

// Mapping between database numeric codes and display labels (same as Settings page)
const ACADEMIC_YEAR_MAPPING = {
  1: "Junior Secondary",
  2: "Senior Secondary", 
  3: "Undergraduate",
  4: "Graduate",
  5: "Postgraduate"
} as const;

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
  const [replies, setReplies] = useState<any[]>([]);
  const [mediaPosts, setMediaPosts] = useState<Post[]>([]);
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
  
  


  const fetchProfile = useCallback(async () => {
    try {
      let profileData;
      let error;

      if (username) {
        // Special handling for AI bot profile
        if (username === 'eduhive') {
          setProfile(AI_BOT_PROFILE as any);
          
          // Get actual follower count for AI bot
          const { count: aiBotFollowersCount } = await supabase
            .from("follows")
            .select("*", { count: "exact", head: true })
            .eq("following_id", AI_BOT_PROFILE.user_id);

          setFollowersCount(aiBotFollowersCount || 0);
          setFollowingCount(0); // AI bot doesn't follow anyone
          
          // Check if current user is following the AI bot
          if (currentUser) {
            const { data: followData } = await supabase
              .from("follows")
              .select("id")
              .eq("follower_id", currentUser.id)
              .eq("following_id", AI_BOT_PROFILE.user_id)
              .single();

            setIsFollowing(!!followData);
          }
          return;
        }

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
            supabase.from("comments").select("id", { count: "exact" }).eq("post_id", post.id).is('parent_comment_id', null),
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
      
      // Filter media posts (posts with attachments)
      const mediaPostsFiltered = postsWithCounts.filter(post => post.attachment_url);
      setMediaPosts(mediaPostsFiltered);
    } catch (error) {
      console.error("Error fetching user posts:", error);
    }
  };

  const fetchUserReplies = async (userId: string) => {
    try {
      console.log("Fetching replies for user:", userId);
      const { data: { user } } = await supabase.auth.getUser();

      // First get all comments by this user
      const { data: commentsData, error: commentsError } = await supabase
        .from("comments")
        .select("*")
        .eq("user_id", userId)
        .order("created_at", { ascending: false });

      if (commentsError) {
        console.error("Error fetching comments:", commentsError);
        throw commentsError;
      }

      console.log("Raw comments data:", commentsData);

      if (!commentsData || commentsData.length === 0) {
        console.log("No comments found for user");
        setReplies([]);
        return;
      }

      // Get all unique post IDs
      const postIds = [...new Set(commentsData.map(comment => comment.post_id))];
      
      // Get post data for these comments
      const { data: postsData, error: postsError } = await supabase
        .from("posts")
        .select("id, body, user_id, created_at")
        .in("id", postIds);

      if (postsError) {
        console.error("Error fetching posts:", postsError);
        throw postsError;
      }

      // Get profiles for post authors
      const postUserIds = [...new Set(postsData?.map(post => post.user_id) || [])];
      const { data: postProfilesData, error: postProfilesError } = await supabase
        .from("profiles")
        .select("user_id, username, name, profile_pic")
        .in("user_id", postUserIds);

      if (postProfilesError) {
        console.error("Error fetching post profiles:", postProfilesError);
      }

      // Get profile for the comment author (current user)
      const { data: userProfileData, error: userProfileError } = await supabase
        .from("profiles")
        .select("user_id, username, name, profile_pic, school, department")
        .eq("user_id", userId)
        .single();

      if (userProfileError) {
        console.error("Error fetching user profile:", userProfileError);
      }

      // Create maps for easy lookup
      const postsMap = new Map(postsData?.map(post => [post.id, post]) || []);
      const postProfilesMap = new Map(postProfilesData?.map(profile => [profile.user_id, profile]) || []);

      // Combine the data
      const repliesWithPostData = commentsData.map(comment => {
        const post = postsMap.get(comment.post_id);
        const postProfile = post ? postProfilesMap.get(post.user_id) : null;

        return {
          ...comment,
          post: post ? {
            ...post,
            profile: postProfile
          } : null,
          profile: userProfileData
        };
      });

      // Get like counts and user likes
      const commentIds = commentsData.map(c => c.id);
      const [likesData, userLikesData] = await Promise.all([
        supabase.from("comment_likes").select("comment_id").in("comment_id", commentIds),
        user ? supabase.from("comment_likes").select("comment_id").eq("user_id", user.id).in("comment_id", commentIds) : Promise.resolve({ data: [] })
      ]);

      // Count likes per comment
      const likesMap = new Map();
      likesData.data?.forEach(like => {
        likesMap.set(like.comment_id, (likesMap.get(like.comment_id) || 0) + 1);
      });

      const userLikesSet = new Set(userLikesData.data?.map(l => l.comment_id) || []);

      const finalReplies = repliesWithPostData.map(reply => ({
        ...reply,
        likes_count: likesMap.get(reply.id) || 0,
        is_liked: userLikesSet.has(reply.id)
      }));

      console.log("Final replies with counts:", finalReplies);
      setReplies(finalReplies);
    } catch (error) {
      console.error("Error fetching user replies:", error);
      setReplies([]);
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
      setMediaPosts(mediaPosts.filter(p => p.id !== postId));
      showToast("Post deleted successfully", "success");
    } catch (error) {
      console.error('Error deleting post:', error);
      showToast("Failed to delete post. Please try again.", "error");
    }
  };

  const handleReplyLike = async (replyId: string) => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const reply = replies.find(r => r.id === replyId);
      if (!reply) return;

      if (reply.is_liked) {
        await supabase
          .from("comment_likes")
          .delete()
          .eq("comment_id", replyId)
          .eq("user_id", user.id);
      } else {
        await supabase
          .from("comment_likes")
          .insert({ comment_id: replyId, user_id: user.id });
      }

      setReplies(replies.map(r =>
        r.id === replyId
          ? {
              ...r,
              is_liked: !r.is_liked,
              likes_count: r.is_liked ? r.likes_count - 1 : r.likes_count + 1
            }
          : r
      ));
    } catch (error) {
      console.error("Error toggling reply like:", error);
    }
  };

  const handleEditPost = (postId: string) => {
    navigate(`/post/edit/${postId}`);
  };

  const handleFollowToggle = async () => {
    if (!currentUser || followingUser) return;
    
    // Don't allow AI bot to follow/unfollow (but allow users to follow AI bot)
    if (currentUser.id === AI_BOT_USER_ID) return;

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
      fetchUserReplies(profile.user_id);
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
              <AvatarImage src={profile.profile_pic || (profile.user_id === currentUser?.id ? (currentUser?.user_metadata?.avatar_url || currentUser?.user_metadata?.profile_pic) : undefined)} />
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
                <div className="flex gap-2 justify-center md:justify-start">
                  {isOwnProfile ? (
                    <Button asChild variant="outline" size="sm">
                      <Link to="/settings">
                        <Settings className="w-4 h-4 mr-2" />
                        Edit Profile
                      </Link>
                    </Button>
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

              

              <div className="flex flex-wrap gap-4 text-sm text-muted-foreground justify-center md:justify-start">
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
                    {ACADEMIC_YEAR_MAPPING[profile.year as keyof typeof ACADEMIC_YEAR_MAPPING] || `Year ${profile.year}`}
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
          <TabsTrigger value="replies" className="flex-1">
            Replies ({replies.length})
          </TabsTrigger>
          <TabsTrigger value="media" className="flex-1">
            Media ({mediaPosts.length})
          </TabsTrigger>
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

        <TabsContent value="replies" className="mt-6">
          {replies.length === 0 ? (
            <Card className="text-center py-12">
              <CardContent>
                <MessageCircle className="w-16 h-16 text-muted-foreground mx-auto mb-4" />
                <h3 className="text-lg font-semibold mb-2">No replies yet</h3>
                <p className="text-muted-foreground">
                  {isOwnProfile
                    ? "When you reply to posts, they'll show up here"
                    : `${profile.username} hasn't replied to any posts yet`
                  }
                </p>
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-4">
              {replies.map((reply) => (
                <Card key={reply.id} className="p-4">
                  <CardContent className="p-0">
                    {/* Original post context */}
                    {reply.post && (
                      <div className="mb-3 p-3 bg-muted/50 rounded-lg border-l-4 border-primary">
                        <div className="flex items-center gap-2 mb-2">
                          <Avatar className="h-6 w-6">
                            <AvatarImage src={reply.post.profile?.profile_pic || ""} />
                            <AvatarFallback className="text-xs">
                              {reply.post.profile?.username?.[0]?.toUpperCase() || 'U'}
                            </AvatarFallback>
                          </Avatar>
                          <span className="text-sm font-medium">
                            {reply.post.profile?.name || reply.post.profile?.username}
                          </span>
                          {reply.post.user_id === profile.user_id && (
                            <span className="text-xs bg-blue-100 dark:bg-blue-900 text-blue-800 dark:text-blue-200 px-2 py-0.5 rounded-full">
                              Your post
                            </span>
                          )}
                          <span className="text-xs text-muted-foreground">
                            {format(new Date(reply.post.created_at), "MMM dd, yyyy")}
                          </span>
                        </div>
                        <p className="text-sm text-muted-foreground line-clamp-2">
                          {reply.post.body}
                        </p>
                      </div>
                    )}

                    {/* Reply content */}
                    <div className="flex gap-3">
                      <Avatar className="h-8 w-8">
                        <AvatarImage src={reply.profile?.profile_pic || ""} />
                        <AvatarFallback>
                          {reply.profile?.username?.[0]?.toUpperCase() || 'U'}
                        </AvatarFallback>
                      </Avatar>
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-1">
                          <span className="font-semibold text-sm">
                            {reply.profile?.name || reply.profile?.username}
                          </span>
                          <span className="text-xs text-muted-foreground">
                            @{reply.profile?.username}
                          </span>
                          <span className="text-xs text-muted-foreground">
                            • {formatTimeShort(reply.created_at)}
                          </span>
                        </div>
                        <p className="text-sm mb-2">{reply.body}</p>
                        <div className="flex items-center gap-4">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleReplyLike(reply.id)}
                            className={`flex items-center gap-1 hover:bg-red-500/10 rounded-full p-1 h-auto transition-colors ${
                              reply.is_liked ? 'text-red-500' : 'text-muted-foreground hover:text-red-500'
                            }`}
                          >
                            <Heart className={`h-3 w-3 ${reply.is_liked ? 'fill-current text-red-500' : ''}`} />
                            <span className="text-xs">{reply.likes_count}</span>
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => navigate(`/post/${reply.post_id}`)}
                            className="text-xs text-muted-foreground hover:text-primary"
                          >
                            View conversation
                          </Button>
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </TabsContent>

        <TabsContent value="media" className="mt-6">
          {mediaPosts.length === 0 ? (
            <Card className="text-center py-12">
              <CardContent>
                <div className="w-16 h-16 bg-muted rounded-lg mx-auto mb-4 flex items-center justify-center">
                  <svg className="w-8 h-8 text-muted-foreground" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                  </svg>
                </div>
                <h3 className="text-lg font-semibold mb-2">No media posts yet</h3>
                <p className="text-muted-foreground">
                  {isOwnProfile
                    ? "Posts with photos, videos, or files will appear here"
                    : `${profile.username} hasn't shared any media posts yet`
                  }
                </p>
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-4">
              {mediaPosts.map((post) => (
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