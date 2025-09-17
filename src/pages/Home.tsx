
import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Heart, MessageCircle, Bookmark, Share, Upload, Image, MoreHorizontal, Trash2, Edit, Flag } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/contexts/AuthContext";
import { formatDistanceToNow } from "date-fns";

interface Profile {
  username: string;
  profile_pic: string | null;
  school: string | null;
}

interface Post {
  id: string;
  body: string;
  attachment_url: string | null;
  attachment_type: string | null;
  school_tag: string | null;
  course_tag: string | null;
  created_at: string;
  user_id: string;
  profile: Profile | null;
  likes_count: number;
  comments_count: number;
  is_liked: boolean;
  is_bookmarked: boolean;
}

export default function Home() {
  const [posts, setPosts] = useState<Post[]>([]);
  const [loading, setLoading] = useState(true);
  const [composeText, setComposeText] = useState("");
  const [isPosting, setIsPosting] = useState(false);
  const { toast } = useToast();
  const { user } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    fetchPosts();
  }, []);

  const fetchPosts = async () => {
    try {
      // First get all posts
      const { data: postsData, error: postsError } = await supabase
        .from('posts')
        .select('*')
        .order('created_at', { ascending: false });

      if (postsError) throw postsError;

      // Get all unique user IDs
      const userIds = [...new Set(postsData?.map(post => post.user_id) || [])];

      // Get profiles for these users
      const { data: profilesData, error: profilesError } = await supabase
        .from('profiles')
        .select('user_id, username, profile_pic, school')
        .in('user_id', userIds);

      if (profilesError) throw profilesError;

      // Create a map of user_id to profile
      const profilesMap = new Map(
        profilesData?.map(profile => [profile.user_id, profile]) || []
      );

      // Get likes and comments counts for each post
      const postIds = postsData?.map(post => post.id) || [];
      
      const promises = [
        supabase.from('likes').select('post_id').in('post_id', postIds),
        supabase.from('comments').select('post_id').in('post_id', postIds)
      ];

      // If user is authenticated, also get their likes and bookmarks
      if (user) {
        promises.push(
          supabase.from('likes').select('post_id').eq('user_id', user.id).in('post_id', postIds),
          supabase.from('bookmarks').select('post_id').eq('user_id', user.id).in('post_id', postIds)
        );
      }

      const results = await Promise.all(promises);
      const [likesData, commentsData, userLikesData, userBookmarksData] = results;

      // Count likes and comments for each post
      const likesCount = new Map();
      const commentsCount = new Map();
      const userLikes = new Set();
      const userBookmarks = new Set();

      likesData.data?.forEach(like => {
        likesCount.set(like.post_id, (likesCount.get(like.post_id) || 0) + 1);
      });

      commentsData.data?.forEach(comment => {
        commentsCount.set(comment.post_id, (commentsCount.get(comment.post_id) || 0) + 1);
      });

      if (user && userLikesData?.data) {
        userLikesData.data.forEach(like => {
          userLikes.add(like.post_id);
        });
      }

      if (user && userBookmarksData?.data) {
        userBookmarksData.data.forEach(bookmark => {
          userBookmarks.add(bookmark.post_id);
        });
      }

      // Combine all data
      const processedPosts: Post[] = postsData?.map(post => ({
        ...post,
        profile: profilesMap.get(post.user_id) || null,
        likes_count: likesCount.get(post.id) || 0,
        comments_count: commentsCount.get(post.id) || 0,
        is_liked: userLikes.has(post.id),
        is_bookmarked: userBookmarks.has(post.id),
      })) || [];

      setPosts(processedPosts);
    } catch (error) {
      console.error('Error fetching posts:', error);
      toast({
        title: "Error",
        description: "Failed to load posts",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleLike = async (postId: string) => {
    if (!user) {
      toast({
        title: "Authentication Required",
        description: "Please log in to like posts",
        variant: "destructive",
      });
      return;
    }

    try {
      const post = posts.find(p => p.id === postId);
      if (!post) return;

      if (post.is_liked) {
        // Unlike the post
        const { error } = await supabase
          .from('likes')
          .delete()
          .eq('post_id', postId)
          .eq('user_id', user.id);

        if (error) throw error;

        setPosts(posts.map(p => 
          p.id === postId 
            ? { ...p, is_liked: false, likes_count: p.likes_count - 1 }
            : p
        ));
      } else {
        // Like the post
        const { error } = await supabase
          .from('likes')
          .insert({ post_id: postId, user_id: user.id });

        if (error) throw error;

        setPosts(posts.map(p => 
          p.id === postId 
            ? { ...p, is_liked: true, likes_count: p.likes_count + 1 }
            : p
        ));
      }
    } catch (error) {
      console.error('Error toggling like:', error);
      toast({
        title: "Error",
        description: "Failed to update like. Please try again.",
        variant: "destructive",
      });
    }
  };

  const handleBookmark = async (postId: string) => {
    if (!user) {
      toast({
        title: "Authentication Required",
        description: "Please log in to bookmark posts",
        variant: "destructive",
      });
      return;
    }

    try {
      const post = posts.find(p => p.id === postId);
      if (!post) return;

      if (post.is_bookmarked) {
        // Remove bookmark
        const { error } = await supabase
          .from('bookmarks')
          .delete()
          .eq('post_id', postId)
          .eq('user_id', user.id);

        if (error) throw error;

        setPosts(posts.map(p => 
          p.id === postId 
            ? { ...p, is_bookmarked: false }
            : p
        ));

        toast({
          title: "Removed",
          description: "Post removed from bookmarks",
        });
      } else {
        // Add bookmark
        const { error } = await supabase
          .from('bookmarks')
          .insert({ post_id: postId, user_id: user.id });

        if (error) throw error;

        setPosts(posts.map(p => 
          p.id === postId 
            ? { ...p, is_bookmarked: true }
            : p
        ));

        toast({
          title: "Saved",
          description: "Post added to bookmarks",
        });
      }
    } catch (error) {
      console.error('Error toggling bookmark:', error);
      toast({
        title: "Error",
        description: "Failed to update bookmark. Please try again.",
        variant: "destructive",
      });
    }
  };

  const handleShare = async (post: Post) => {
    try {
      if (navigator.share) {
        await navigator.share({
          title: `Post by ${post.profile?.username || 'Anonymous'}`,
          text: post.body.substring(0, 100) + (post.body.length > 100 ? "..." : ""),
          url: window.location.href,
        });
      } else {
        // Fallback: copy to clipboard
        await navigator.clipboard.writeText(window.location.href);
        toast({
          title: "Link copied",
          description: "Post link copied to clipboard",
        });
      }
    } catch (error) {
      console.error('Error sharing:', error);
    }
  };

  const handleComment = (postId: string) => {
    // Navigate to post detail page for comments
    navigate(`/post/${postId}`);
  };

  const handleQuickPost = async () => {
    if (!user) {
      toast({
        title: "Authentication Required",
        description: "Please log in to create posts",
        variant: "destructive",
      });
      return;
    }

    if (!composeText.trim()) {
      toast({
        title: "Error",
        description: "Please enter some text",
        variant: "destructive",
      });
      return;
    }

    setIsPosting(true);
    try {
      const { error } = await supabase
        .from('posts')
        .insert({
          body: composeText.trim(),
          user_id: user.id,
        });

      if (error) throw error;

      setComposeText("");
      toast({
        title: "Success",
        description: "Post created successfully",
      });
      
      // Refresh posts
      fetchPosts();
    } catch (error) {
      console.error('Error creating post:', error);
      toast({
        title: "Error",
        description: "Failed to create post. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsPosting(false);
    }
  };

  const handleDeletePost = async (postId: string) => {
    if (!user) return;

    try {
      const { error } = await supabase
        .from('posts')
        .delete()
        .eq('id', postId)
        .eq('user_id', user.id); // Ensure only owner can delete

      if (error) throw error;

      setPosts(posts.filter(p => p.id !== postId));
      toast({
        title: "Success",
        description: "Post deleted successfully",
      });
    } catch (error) {
      console.error('Error deleting post:', error);
      toast({
        title: "Error",
        description: "Failed to delete post. Please try again.",
        variant: "destructive",
      });
    }
  };

  const handleEditPost = (postId: string) => {
    // Navigate to edit post page or open edit modal
    navigate(`/post/edit/${postId}`);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto mt-4 mb-4">
      {/* Twitter-style compose area */}
      {user && (
        <div className="mx-4 mb-4 p-4 border border-border rounded-lg bg-background/80 backdrop-blur-sm">
          <div className="flex gap-3">
            <Avatar className="h-10 w-10 flex-shrink-0">
              <AvatarImage src={user.user_metadata?.avatar_url} />
              <AvatarFallback>
                {user.user_metadata?.full_name?.[0]?.toUpperCase() || user.email?.[0]?.toUpperCase() || 'U'}
              </AvatarFallback>
            </Avatar>
            
            <div className="flex-1">
              <Textarea
                placeholder="What's happening?"
                value={composeText}
                onChange={(e) => setComposeText(e.target.value)}
                className="min-h-[60px] resize-none border-none text-xl placeholder:text-muted-foreground focus-visible:ring-0 p-0"
                disabled={isPosting}
              />
              
              <div className="flex items-center justify-between mt-3">
                <div className="flex items-center gap-2">
                  <Button variant="ghost" size="sm" className="text-primary p-2 h-auto rounded-full">
                    <Image className="h-5 w-5" />
                  </Button>
                  <Button variant="ghost" size="sm" className="text-primary p-2 h-auto rounded-full" onClick={() => navigate('/post')}>
                    <Upload className="h-5 w-5" />
                  </Button>
                </div>
                
                <Button 
                  onClick={handleQuickPost}
                  disabled={!composeText.trim() || isPosting}
                  className="rounded-full px-6"
                >
                  {isPosting ? "Posting..." : "Post"}
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}

      <div className="space-y-4">
        {posts.length === 0 ? (
          <div className="py-12 text-center">
            <p className="text-muted-foreground">No posts yet. Be the first to share something!</p>
          </div>
        ) : (
          posts.map((post) => (
            <div 
              key={post.id} 
              className="p-4 hover:bg-muted/20 transition-colors cursor-pointer border border-border rounded-lg"
              onClick={() => navigate(`/post/${post.id}`)}
            >
              <div className="flex gap-3">
                <Avatar className="h-10 w-10 flex-shrink-0">
                  <AvatarImage src={post.profile?.profile_pic || undefined} />
                  <AvatarFallback>
                    {post.profile?.username?.[0]?.toUpperCase() || 'U'}
                  </AvatarFallback>
                </Avatar>
                
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2 text-sm">
                      <span className="font-semibold text-foreground">{post.profile?.username || 'Anonymous'}</span>
                      {post.profile?.school && (
                        <span className="text-muted-foreground">@{post.profile.school.toLowerCase().replace(/\s+/g, '')}</span>
                      )}
                      <span className="text-muted-foreground">•</span>
                      <span className="text-muted-foreground">{formatDistanceToNow(new Date(post.created_at), { addSuffix: true })}</span>
                    </div>
                    
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
                        {user && user.id === post.user_id && (
                          <>
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
                          </>
                        )}
                        <DropdownMenuItem onClick={(e) => e.stopPropagation()}>
                          <Flag className="h-4 w-4 mr-2" />
                          Report post
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>
                  
                  <div className="mt-1">
                    <p className="text-foreground whitespace-pre-wrap">{post.body}</p>
                    
                    {post.attachment_url && (
                      <div className="mt-3 rounded-2xl overflow-hidden border border-border">
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
                    
                    {(post.school_tag || post.course_tag) && (
                      <div className="flex gap-2 mt-3">
                        {post.school_tag && (
                          <Badge variant="secondary" className="text-xs">{post.school_tag}</Badge>
                        )}
                        {post.course_tag && (
                          <Badge variant="outline" className="text-xs">{post.course_tag}</Badge>
                        )}
                      </div>
                    )}
                    
                    <div className="flex items-center justify-between mt-3 max-w-md">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleLike(post.id);
                        }}
                        className={`flex items-center gap-2 hover:bg-red-500/10 rounded-full p-2 h-auto transition-colors ${
                          post.is_liked ? 'text-red-500' : 'text-muted-foreground hover:text-red-500'
                        }`}
                      >
                        <Heart className={`h-5 w-5 ${post.is_liked ? 'fill-current text-red-500' : ''}`} />
                        <span className="text-sm">{post.likes_count}</span>
                      </Button>

                      <Button 
                        variant="ghost" 
                        size="sm" 
                        className="flex items-center gap-2 text-muted-foreground hover:text-blue-500 hover:bg-blue-500/10 rounded-full p-2 h-auto transition-colors"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleComment(post.id);
                        }}
                      >
                        <MessageCircle className="h-5 w-5" />
                        <span className="text-sm">{post.comments_count}</span>
                      </Button>

                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleBookmark(post.id);
                        }}
                        className={`flex items-center gap-2 hover:bg-blue-500/10 rounded-full p-2 h-auto transition-colors ${
                          post.is_bookmarked ? 'text-blue-500' : 'text-muted-foreground hover:text-blue-500'
                        }`}
                      >
                        <Bookmark className={`h-5 w-5 ${post.is_bookmarked ? 'fill-current text-blue-500' : ''}`} />
                      </Button>

                      <Button 
                        variant="ghost" 
                        size="sm" 
                        className="flex items-center gap-2 text-muted-foreground hover:text-green-500 hover:bg-green-500/10 rounded-full p-2 h-auto transition-colors"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleShare(post);
                        }}
                      >
                        <Share className="h-5 w-5" />
                      </Button>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
