import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Heart, MessageCircle, Bookmark, Share, MoreHorizontal } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
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
  const { toast } = useToast();

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
      
      const [likesData, commentsData] = await Promise.all([
        supabase.from('likes').select('post_id').in('post_id', postIds),
        supabase.from('comments').select('post_id').in('post_id', postIds)
      ]);

      // Count likes and comments for each post
      const likesCount = new Map();
      const commentsCount = new Map();

      likesData.data?.forEach(like => {
        likesCount.set(like.post_id, (likesCount.get(like.post_id) || 0) + 1);
      });

      commentsData.data?.forEach(comment => {
        commentsCount.set(comment.post_id, (commentsCount.get(comment.post_id) || 0) + 1);
      });

      // Combine all data
      const processedPosts: Post[] = postsData?.map(post => ({
        ...post,
        profile: profilesMap.get(post.user_id) || null,
        likes_count: likesCount.get(post.id) || 0,
        comments_count: commentsCount.get(post.id) || 0,
        is_liked: false, // We'll implement this with proper auth
        is_bookmarked: false,
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
    // We'll implement this when auth is ready
    toast({
      title: "Authentication Required",
      description: "Please log in to like posts",
    });
  };

  const handleBookmark = async (postId: string) => {
    // We'll implement this when auth is ready
    toast({
      title: "Authentication Required", 
      description: "Please log in to bookmark posts",
    });
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-6 max-w-2xl">
      <div className="space-y-6">
        {posts.length === 0 ? (
          <Card>
            <CardContent className="py-12 text-center">
              <p className="text-muted-foreground">No posts yet. Be the first to share something!</p>
            </CardContent>
          </Card>
        ) : (
          posts.map((post) => (
            <Card key={post.id} className="hover:bg-card-hover transition-colors">
              <CardHeader className="pb-3">
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-3">
                    <Avatar className="h-10 w-10">
                      <AvatarImage src={post.profile?.profile_pic || undefined} />
                      <AvatarFallback>
                        {post.profile?.username?.[0]?.toUpperCase() || 'U'}
                      </AvatarFallback>
                    </Avatar>
                    <div>
                      <p className="font-medium">{post.profile?.username || 'Anonymous'}</p>
                      <div className="flex items-center gap-2 text-sm text-muted-foreground">
                        {post.profile?.school && (
                          <span>{post.profile.school}</span>
                        )}
                        <span>•</span>
                        <span>{formatDistanceToNow(new Date(post.created_at), { addSuffix: true })}</span>
                      </div>
                    </div>
                  </div>
                  <Button variant="ghost" size="icon">
                    <MoreHorizontal className="h-4 w-4" />
                  </Button>
                </div>
              </CardHeader>

              <CardContent className="space-y-4">
                <p className="text-sm leading-relaxed">{post.body}</p>

                {post.attachment_url && (
                  <div className="rounded-lg border border-border overflow-hidden">
                    {post.attachment_type?.startsWith('image/') ? (
                      <img 
                        src={post.attachment_url} 
                        alt="Post attachment" 
                        className="w-full max-h-96 object-cover"
                      />
                    ) : (
                      <div className="p-4 bg-muted">
                        <p className="text-sm text-muted-foreground">
                          📎 {post.attachment_type || 'File attachment'}
                        </p>
                      </div>
                    )}
                  </div>
                )}

                {(post.school_tag || post.course_tag) && (
                  <div className="flex gap-2">
                    {post.school_tag && (
                      <Badge variant="secondary">{post.school_tag}</Badge>
                    )}
                    {post.course_tag && (
                      <Badge variant="outline">{post.course_tag}</Badge>
                    )}
                  </div>
                )}

                <div className="flex items-center justify-between pt-2 border-t border-border">
                  <div className="flex items-center gap-4">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleLike(post.id)}
                      className="flex items-center gap-2 hover:text-like"
                    >
                      <Heart className="h-4 w-4" />
                      <span>{post.likes_count}</span>
                    </Button>

                    <Button variant="ghost" size="sm" className="flex items-center gap-2">
                      <MessageCircle className="h-4 w-4" />
                      <span>{post.comments_count}</span>
                    </Button>
                  </div>

                  <div className="flex items-center gap-2">
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => handleBookmark(post.id)}
                      className="hover:text-bookmark"
                    >
                      <Bookmark className="h-4 w-4" />
                    </Button>
                    <Button variant="ghost" size="icon">
                      <Share className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))
        )}
      </div>
    </div>
  );
}