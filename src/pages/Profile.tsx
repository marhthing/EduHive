import { useState, useEffect } from "react";
import { useParams, Link, useNavigate } from "react-router-dom";
import { Calendar, MapPin, School, Settings, Edit3, MoreHorizontal, Edit, Trash2, Flag, Heart, MessageCircle, Bookmark, Share2 } from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { supabase } from "@/integrations/supabase/client";
import { PostCard } from "@/components/PostCard";
import { useTwitterToast } from "@/components/ui/twitter-toast";
import { format, formatDistanceToNow } from "date-fns";

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
}

interface Post {
  id: string;
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
  const [activeTab, setActiveTab] = useState("posts");
  const { showToast } = useTwitterToast();
  const navigate = useNavigate();

  const fetchProfile = async () => {
    try {
      const { data: profileData, error } = await supabase
        .from("profiles")
        .select("*")
        .eq("username", username)
        .single();

      if (error) throw error;
      setProfile(profileData);
    } catch (error) {
      console.error("Error fetching profile:", error);
      showToast("Profile not found", "error");
    }
  };

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
  }, [username]);

  useEffect(() => {
    if (profile) {
      fetchUserPosts(profile.user_id);
      setLoading(false);
    }
  }, [profile]);

  if (loading) {
    return (
      <div className="container mx-auto px-4 py-6 max-w-4xl">
        <div className="text-center py-8">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto"></div>
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
                <h1 className="text-2xl font-bold">{profile.username}</h1>
                {isOwnProfile && (
                  <Button asChild variant="outline" size="sm">
                    <Link to="/settings">
                      <Settings className="w-4 h-4 mr-2" />
                      Edit Profile
                    </Link>
                  </Button>
                )}
              </div>

              {profile.bio && (
                <p className="text-muted-foreground mb-4">{profile.bio}</p>
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
                <div className="text-center">
                  <div className="font-bold">{posts.length}</div>
                  <div className="text-sm text-muted-foreground">Posts</div>
                </div>
                <div className="text-center">
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
                <Card key={post.id} className="w-full">
                  <CardContent className="p-4">
                    <div 
                      className="cursor-pointer"
                      onClick={() => navigate(`/post/${post.id}`)}
                    >
                      {/* Header */}
                      <div className="flex items-start gap-3 mb-3">
                        <Avatar className="w-10 h-10">
                          <AvatarImage src={post.profile?.profile_pic || ""} />
                          <AvatarFallback>
                            {post.profile?.username?.charAt(0).toUpperCase() || "U"}
                          </AvatarFallback>
                        </Avatar>
                        
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center justify-between">
                            <div className="flex flex-col">
                              <div className="flex items-center gap-2 text-sm">
                                <span className="font-semibold">{post.profile?.name || "Anonymous"}</span>
                                <span className="text-muted-foreground">•</span>
                                <span className="text-muted-foreground">@{post.profile?.username || "anonymous"}</span>
                                <span className="text-muted-foreground">•</span>
                                <span className="text-muted-foreground">
                                  {formatDistanceToNow(new Date(post.created_at), { addSuffix: true })}
                                </span>
                              </div>
                              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                                {post.profile?.school && (
                                  <span>• {post.profile.school}</span>
                                )}
                                {post.profile?.department && (
                                  <span>• {post.profile.department}</span>
                                )}
                              </div>
                            </div>
                            
                            {isOwnProfile && (
                              <DropdownMenu>
                                <DropdownMenuTrigger asChild>
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    className="h-8 w-8 p-0 hover:bg-muted rounded-full"
                                    onClick={(e) => e.stopPropagation()}
                                  >
                                    <MoreHorizontal className="h-4 w-4" />
                                  </Button>
                                </DropdownMenuTrigger>
                                <DropdownMenuContent align="end" className="w-48">
                                  <DropdownMenuItem 
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      handleEditPost(post.id);
                                    }}
                                  >
                                    <Edit className="h-4 w-4 mr-2" />
                                    Edit post
                                  </DropdownMenuItem>
                                  <DropdownMenuItem 
                                    className="text-destructive focus:text-destructive"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      if (confirm('Are you sure you want to delete this post?')) {
                                        handleDeletePost(post.id);
                                      }
                                    }}
                                  >
                                    <Trash2 className="h-4 w-4 mr-2" />
                                    Delete post
                                  </DropdownMenuItem>
                                  <DropdownMenuSeparator />
                                  <DropdownMenuItem onClick={(e) => e.stopPropagation()}>
                                    <Flag className="h-4 w-4 mr-2" />
                                    Report post
                                  </DropdownMenuItem>
                                </DropdownMenuContent>
                              </DropdownMenu>
                            )}
                          </div>
                        </div>
                      </div>

                      {/* Content */}
                      <div className="mb-3">
                        <p className="text-sm leading-relaxed whitespace-pre-wrap">{post.body}</p>
                        
                        {/* Attachment rendering */}
                        {post.attachment_url && (
                          <div className="mt-3 rounded-lg overflow-hidden border border-border">
                            {post.attachment_type?.startsWith('image/') ? (
                              <img
                                src={post.attachment_url}
                                alt="Post attachment"
                                className="w-full max-h-96 object-cover cursor-pointer hover:opacity-90 transition-opacity"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  window.open(post.attachment_url!, '_blank');
                                }}
                                loading="lazy"
                              />
                            ) : post.attachment_type === 'application/pdf' || post.attachment_type?.includes('pdf') ? (
                              <div className="p-4 bg-muted">
                                <div className="flex gap-2 items-center">
                                  <Button
                                    variant="outline"
                                    size="sm"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      window.open(post.attachment_url!, '_blank');
                                    }}
                                    className="flex-1 justify-start"
                                  >
                                    📄 View PDF Document
                                  </Button>
                                  <Button
                                    variant="outline"
                                    size="sm"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      const link = document.createElement('a');
                                      link.href = post.attachment_url!;
                                      link.download = 'document.pdf';
                                      link.target = '_blank';
                                      document.body.appendChild(link);
                                      link.click();
                                      document.body.removeChild(link);
                                    }}
                                    className="px-3"
                                  >
                                    ⬇️
                                  </Button>
                                </div>
                              </div>
                            ) : (
                              <div className="p-4 bg-muted">
                                <div className="flex gap-2 items-center">
                                  <Button
                                    variant="outline"
                                    size="sm"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      window.open(post.attachment_url!, '_blank');
                                    }}
                                    className="flex-1 justify-start"
                                  >
                                    📎 View File ({post.attachment_type || 'Unknown type'})
                                  </Button>
                                  <Button
                                    variant="outline"
                                    size="sm"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      const link = document.createElement('a');
                                      link.href = post.attachment_url!;
                                      link.download = 'attachment';
                                      link.target = '_blank';
                                      document.body.appendChild(link);
                                      link.click();
                                      document.body.removeChild(link);
                                    }}
                                    className="px-3"
                                  >
                                    ⬇️
                                  </Button>
                                </div>
                              </div>
                            )}
                          </div>
                        )}
                      </div>

                      {/* Tags */}
                      {(post.school_tag || post.course_tag) && (
                        <div className="flex gap-2 mb-3 flex-wrap">
                          {post.school_tag && (
                            <Badge variant="secondary" className="text-xs">
                              {post.school_tag}
                            </Badge>
                          )}
                          {post.course_tag && (
                            <Badge variant="outline" className="text-xs">
                              {post.course_tag}
                            </Badge>
                          )}
                        </div>
                      )}
                    </div>

                    {/* Actions */}
                    <div className="flex items-center justify-between pt-2 border-t">
                      <div className="flex items-center gap-1">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleToggleLike(post.id);
                          }}
                          className={post.is_liked ? "text-red-500 hover:text-red-600" : ""}
                        >
                          <Heart className={`w-4 h-4 mr-1 ${post.is_liked ? "fill-current" : ""}`} />
                          {post.likes_count}
                        </Button>

                        <Button 
                          variant="ghost" 
                          size="sm" 
                          onClick={(e) => {
                            e.stopPropagation();
                            navigate(`/post/${post.id}`);
                          }}
                        >
                          <MessageCircle className="w-4 h-4 mr-1" />
                          {post.comments_count}
                        </Button>
                      </div>

                      <div className="flex items-center gap-1">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleToggleBookmark(post.id);
                          }}
                          className={post.is_bookmarked ? "text-blue-500 hover:text-blue-600" : ""}
                        >
                          <Bookmark className={`w-4 h-4 ${post.is_bookmarked ? "fill-current" : ""}`} />
                        </Button>

                        <Button 
                          variant="ghost" 
                          size="sm" 
                          onClick={(e) => {
                            e.stopPropagation();
                            // Handle share functionality
                          }}
                        >
                          <Share2 className="w-4 h-4" />
                        </Button>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}