import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Textarea } from "@/components/ui/textarea";
import { Upload, Image } from "lucide-react";
import { useTwitterToast } from "@/components/ui/twitter-toast";
import { useAuth } from "@/contexts/AuthContext";
import { PostItem } from "@/components/PostItem";

interface Profile {
  username: string;
  name: string | null;
  profile_pic: string | null;
  school: string | null;
  department: string | null;
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
  const { showToast } = useTwitterToast();
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

      console.log('Posts fetch result:', { postsData, postsError });
      if (postsError) throw postsError;

      // Get all unique user IDs
      const userIds = [...new Set(postsData?.map(post => post.user_id) || [])];
      console.log('User IDs to fetch profiles for:', userIds);

      // Get profiles for these users
      const { data: profilesData, error: profilesError } = await supabase
        .from('profiles')
        .select('user_id, username, profile_pic, school, department')
        .in('user_id', userIds);

      console.log('Profiles fetch result:', { profilesData, profilesError });
      if (profilesError) {
        console.error('Error fetching profiles:', profilesError);
        // Continue without profiles rather than throwing
      }

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
      showToast("Failed to load posts", "error");
    } finally {
      setLoading(false);
    }
  };

  const handleLike = async (postId: string) => {
    if (!user) {
      showToast("Please log in to like posts", "error");
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
      showToast("Failed to update like. Please try again.", "error");
    }
  };

  const handleBookmark = async (postId: string) => {
    if (!user) {
      showToast("Please log in to bookmark posts", "error");
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

        // Removed notification - Twitter doesn't show these
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

        // Removed notification - Twitter doesn't show these
      }
    } catch (error) {
      console.error('Error toggling bookmark:', error);
      showToast("Failed to update bookmark. Please try again.", "error");
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
        // Removed notification - Twitter doesn't show clipboard actions
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
      showToast("Please log in to create posts", "error");
      return;
    }

    if (!composeText.trim()) {
      showToast("Please enter some text", "error");
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
      // Removed notification - Twitter doesn't show these

      // Refresh posts
      fetchPosts();
    } catch (error) {
      console.error('Error creating post:', error);
      showToast("Failed to create post. Please try again.", "error");
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
      // Removed notification - Twitter doesn't show these
    } catch (error) {
      console.error('Error deleting post:', error);
      showToast("Failed to delete post. Please try again.", "error");
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
            <PostItem
              key={post.id}
              post={post}
              currentUserId={user?.id}
              onLike={handleLike}
              onBookmark={handleBookmark}
              onComment={handleComment}
              onShare={handleShare}
              onEdit={handleEditPost}
              onDelete={handleDeletePost}
            />
          ))
        )}
      </div>
    </div>
  );
}