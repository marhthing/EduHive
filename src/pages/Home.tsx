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
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
  const [filePreviews, setFilePreviews] = useState<string[]>([]);
  const { showToast } = useTwitterToast();
  const { user } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    fetchPosts();
  }, []);

  const fetchPosts = async () => {
    try {
      // Get posts with priority for followed users
      let followedUserIds: string[] = [];
      
      if (user) {
        // Get list of users the current user follows
        const { data: followsData } = await supabase
          .from('follows')
          .select('following_id')
          .eq('follower_id', user.id);
        
        followedUserIds = followsData?.map(f => f.following_id) || [];
      }

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
        .select('user_id, username, name, profile_pic, school, department')
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

      // Sort posts: followed users first, then others by date
      const sortedPosts = processedPosts.sort((a, b) => {
        const aIsFollowed = followedUserIds.includes(a.user_id);
        const bIsFollowed = followedUserIds.includes(b.user_id);
        
        // If one is followed and other is not, prioritize followed
        if (aIsFollowed && !bIsFollowed) return -1;
        if (!aIsFollowed && bIsFollowed) return 1;
        
        // If both are followed or both are not followed, sort by date
        return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
      });

      setPosts(sortedPosts);
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

  const handleFileSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(event.target.files || []);
    if (files.length === 0) return;

    // Check if adding these files would exceed the limit (max 3 files for quick post)
    if (selectedFiles.length + files.length > 3) {
      showToast("You can upload a maximum of 3 files in quick post", "error");
      return;
    }

    const validFiles: File[] = [];
    const allowedTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/gif'];

    for (const file of files) {
      // Check file size (max 10MB)
      if (file.size > 10 * 1024 * 1024) {
        showToast(`File "${file.name}" is too large. Please select files smaller than 10MB`, "error");
        continue;
      }

      // Check file type
      if (!allowedTypes.includes(file.type)) {
        showToast(`File "${file.name}" is not supported. Please select image files (JPEG, PNG, GIF)`, "error");
        continue;
      }

      validFiles.push(file);

      // Create preview for images
      if (file.type.startsWith('image/')) {
        const reader = new FileReader();
        reader.onload = (e) => {
          setFilePreviews(prev => [...prev, e.target?.result as string]);
        };
        reader.readAsDataURL(file);
      }
    }

    if (validFiles.length > 0) {
      setSelectedFiles(prev => [...prev, ...validFiles]);
    }
  };

  const uploadFiles = async (files: File[]) => {
    const uploadPromises = files.map(async (file, index) => {
      const fileExt = file.name.split('.').pop();
      const fileName = `${Date.now()}_${index}_${Math.random()}.${fileExt}`;
      const filePath = `attachments/${fileName}`;

      const { error: uploadError } = await supabase.storage
        .from('attachments')
        .upload(filePath, file);

      if (uploadError) throw uploadError;

      const { data } = supabase.storage
        .from('attachments')
        .getPublicUrl(filePath);

      return {
        url: data.publicUrl,
        type: file.type.startsWith('image/') ? 'image' : 'file'
      };
    });

    return await Promise.all(uploadPromises);
  };

  const removeFile = (index: number) => {
    setSelectedFiles(prev => prev.filter((_, i) => i !== index));
    setFilePreviews(prev => prev.filter((_, i) => i !== index));
  };

  const removeAllFiles = () => {
    setSelectedFiles([]);
    setFilePreviews([]);
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
      let attachment_url = null;
      let attachment_type = null;
      let attachment_urls = null;

      // Upload files if selected
      if (selectedFiles.length > 0) {
        if (selectedFiles.length === 1) {
          // For single file, maintain backward compatibility
          const results = await uploadFiles([selectedFiles[0]]);
          attachment_url = results[0].url;
          attachment_type = results[0].type;
        } else {
          // For multiple files, store as JSON array
          const results = await uploadFiles(selectedFiles);
          attachment_urls = JSON.stringify(results);
          attachment_type = 'multiple';
        }
      }

      const { error } = await supabase
        .from('posts')
        .insert({
          body: composeText.trim(),
          user_id: user.id,
          attachment_url: attachment_urls || attachment_url,
          attachment_type,
        });

      if (error) throw error;

      setComposeText("");
      setSelectedFiles([]);
      setFilePreviews([]);
      showToast("Post created successfully!", "success");

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
                placeholder="Got any school work to share?"
                value={composeText}
                onChange={(e) => setComposeText(e.target.value)}
                className="min-h-[60px] resize-none border-none text-xl placeholder:text-muted-foreground focus-visible:ring-0 p-0"
                disabled={isPosting}
              />

              {/* File previews */}
              {selectedFiles.length > 0 && (
                <div className="mt-3 space-y-2">
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-muted-foreground">
                      {selectedFiles.length} file{selectedFiles.length > 1 ? 's' : ''} selected
                    </span>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={removeAllFiles}
                      className="text-xs text-muted-foreground hover:text-foreground"
                    >
                      Remove all
                    </Button>
                  </div>
                  <div className="flex gap-2 overflow-x-auto">
                    {filePreviews.map((preview, index) => (
                      <div key={index} className="relative flex-shrink-0">
                        <img 
                          src={preview} 
                          alt={`Preview ${index + 1}`} 
                          className="w-20 h-20 object-cover rounded-lg"
                        />
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => removeFile(index)}
                          className="absolute -top-1 -right-1 bg-black/50 text-white rounded-full p-1 h-auto w-auto"
                        >
                          ×
                        </Button>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              <div className="flex items-center justify-between mt-3">
                <div className="flex items-center gap-2">
                  <Button variant="ghost" size="sm" className="text-primary p-2 h-auto rounded-full" onClick={() => navigate('/post')}>
                    <Upload className="h-5 w-5" />
                  </Button>
                </div>

                <Button 
                  onClick={handleQuickPost}
                  disabled={(!composeText.trim() && selectedFiles.length === 0) || isPosting}
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