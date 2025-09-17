import { useState, useEffect } from "react";
import { BookmarkX } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { PostItem } from "@/components/PostItem";
import { useTwitterToast } from "@/components/ui/twitter-toast";

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
    profile_pic: string | null;
    school: string | null;
    department: string | null;
  } | null;
  likes_count: number;
  comments_count: number;
  is_liked: boolean;
  is_bookmarked: boolean;
}

export default function Bookmarks() {
  const [posts, setPosts] = useState<Post[]>([]);
  const [loading, setLoading] = useState(true);
  const { showToast } = useTwitterToast();

  const fetchBookmarkedPosts = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        setLoading(false);
        return;
      }

      const { data: bookmarkRows, error } = await supabase
        .from("bookmarks")
        .select("post_id")
        .eq("user_id", user.id)
        .order("created_at", { ascending: false });

      if (error) throw error;

      const postsWithCounts = await Promise.all(
        (bookmarkRows || []).map(async (bookmark: any) => {
          const { data: post, error: postError } = await supabase
            .from("posts")
            .select("*")
            .eq("id", bookmark.post_id)
            .maybeSingle();

          if (postError || !post) return null;

          const [likesResult, commentsResult, userLikeResult, profileResult, userBookmarkResult] = await Promise.all([
            supabase.from("likes").select("id", { count: "exact" }).eq("post_id", post.id),
            supabase.from("comments").select("id", { count: "exact" }).eq("post_id", post.id).is('parent_comment_id', null),
            supabase.from("likes").select("id").eq("post_id", post.id).eq("user_id", user.id).maybeSingle(),
            supabase.from("profiles").select("username, profile_pic, school, department").eq("user_id", post.user_id).maybeSingle(),
            supabase.from("bookmarks").select("id").eq("post_id", post.id).eq("user_id", user.id).maybeSingle(),
          ]);

          return {
            ...post,
            profile: profileResult.data || null,
            likes_count: likesResult.count || 0,
            comments_count: commentsResult.count || 0,
            is_liked: !!userLikeResult?.data,
            is_bookmarked: !!userBookmarkResult?.data,
          };
        })
      );

      setPosts((postsWithCounts || []).filter(Boolean) as any);
    } catch (error) {
      console.error("Error fetching bookmarked posts:", error);
      showToast("Failed to load bookmarked posts. Please try again.", "error");
    } finally {
      setLoading(false);
    }
  };

  const handleRemoveBookmark = async (postId: string) => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { error } = await supabase
        .from("bookmarks")
        .delete()
        .eq("post_id", postId)
        .eq("user_id", user.id);

      if (error) throw error;

      setPosts(posts.filter(post => post.id !== postId));
      // Removed notification - Twitter doesn't show these
    } catch (error) {
      console.error("Error removing bookmark:", error);
      showToast("Failed to remove bookmark. Please try again.", "error");
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
      showToast("Failed to update like. Please try again.", "error");
    }
  };

  useEffect(() => {
    fetchBookmarkedPosts();
  }, []);

  if (loading) {
    return (
      <div className="container mx-auto px-4 py-6 max-w-4xl">
        <div className="text-center py-8">
          <img src="/logo-animated.svg" alt="Loading" className="h-8 w-8 mx-auto" />
          <p className="mt-2 text-muted-foreground">Loading bookmarks...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-6 max-w-4xl">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-primary mb-2">My Bookmarks</h1>
        <p className="text-muted-foreground">Posts you've saved for later</p>
      </div>

      {posts.length === 0 ? (
        <Card className="text-center py-12">
          <CardContent>
            <BookmarkX className="w-16 h-16 text-muted-foreground mx-auto mb-4" />
            <h3 className="text-lg font-semibold mb-2">No bookmarks yet</h3>
            <p className="text-muted-foreground mb-4">
              Start saving posts you find interesting by clicking the bookmark icon
            </p>
            <Button onClick={() => window.location.href = '/home'}>
              Browse Posts
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-4">
          {posts.map((post) => (
            <PostItem
              key={post.id}
              post={post}
              onLike={handleToggleLike}
              onBookmark={handleRemoveBookmark}
              onComment={() => {}}
              onShare={() => {}}
              showDropdown={false}
            />
          ))}
        </div>
      )}
    </div>
  );
}