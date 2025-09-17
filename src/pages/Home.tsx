
import { useState, useEffect, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Textarea } from "@/components/ui/textarea";
import { Upload } from "lucide-react";
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

// Cache management
const POSTS_PER_BATCH = 3;
const CACHE_KEY = 'eduhive_posts_cache';
const CACHE_TIMESTAMP_KEY = 'eduhive_posts_cache_timestamp';
const CACHE_EXPIRY = 5 * 60 * 1000; // 5 minutes

interface PostsCache {
  posts: Post[];
  page: number;
  hasMore: boolean;
  followedUserIds: string[];
}

const saveToCache = (data: PostsCache) => {
  try {
    localStorage.setItem(CACHE_KEY, JSON.stringify(data));
    localStorage.setItem(CACHE_TIMESTAMP_KEY, Date.now().toString());
  } catch (error) {
    console.error('Error saving to cache:', error);
  }
};

const loadFromCache = (): PostsCache | null => {
  try {
    const timestamp = localStorage.getItem(CACHE_TIMESTAMP_KEY);
    if (!timestamp || Date.now() - parseInt(timestamp) > CACHE_EXPIRY) {
      return null;
    }
    
    const cached = localStorage.getItem(CACHE_KEY);
    return cached ? JSON.parse(cached) : null;
  } catch (error) {
    console.error('Error loading from cache:', error);
    return null;
  }
};

export default function Home() {
  const [posts, setPosts] = useState<Post[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [page, setPage] = useState(0);
  const [hasMore, setHasMore] = useState(true);
  const [followedUserIds, setFollowedUserIds] = useState<string[]>([]);
  const [composeText, setComposeText] = useState("");
  const [isPosting, setIsPosting] = useState(false);
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
  const [filePreviews, setFilePreviews] = useState<string[]>([]);
  const { showToast } = useTwitterToast();
  const { user } = useAuth();
  const navigate = useNavigate();

  // Load initial data (cache first, then fresh data)
  useEffect(() => {
    loadInitialPosts();
  }, []);

  const loadInitialPosts = async () => {
    // Try to load from cache first
    const cached = loadFromCache();
    if (cached && cached.posts.length > 0) {
      setPosts(cached.posts);
      setPage(cached.page);
      setHasMore(cached.hasMore);
      setFollowedUserIds(cached.followedUserIds);
      setLoading(false);
      
      // Load fresh data in background
      setTimeout(() => {
        fetchPosts(0, true);
      }, 1000);
    } else {
      // No cache, fetch fresh data
      fetchPosts(0);
    }
  };

  const fetchPosts = async (pageNum: number, isBackgroundRefresh = false) => {
    try {
      if (!isBackgroundRefresh) {
        if (pageNum === 0) {
          setLoading(true);
        } else {
          setLoadingMore(true);
        }
      }

      // Get followed users
      let currentFollowedUserIds: string[] = [];
      if (user) {
        const { data: followsData } = await supabase
          .from('follows')
          .select('following_id')
          .eq('follower_id', user.id);
        
        currentFollowedUserIds = followsData?.map(f => f.following_id) || [];
        setFollowedUserIds(currentFollowedUserIds);
      }

      // Fetch posts with pagination
      const offset = pageNum * POSTS_PER_BATCH;
      const { data: postsData, error: postsError } = await supabase
        .from('posts')
        .select('*')
        .order('created_at', { ascending: false })
        .range(offset, offset + POSTS_PER_BATCH - 1);

      if (postsError) throw postsError;

      const hasMorePosts = postsData && postsData.length === POSTS_PER_BATCH;

      if (!postsData || postsData.length === 0) {
        if (pageNum === 0) {
          setPosts([]);
        }
        setHasMore(false);
        return;
      }

      // Get all unique user IDs
      const userIds = [...new Set(postsData.map(post => post.user_id))];

      // Get profiles for these users
      const { data: profilesData, error: profilesError } = await supabase
        .from('profiles')
        .select('user_id, username, name, profile_pic, school, department')
        .in('user_id', userIds);

      if (profilesError) {
        console.error('Error fetching profiles:', profilesError);
      }

      // Create a map of user_id to profile
      const profilesMap = new Map(
        profilesData?.map(profile => [profile.user_id, profile]) || []
      );

      // Get likes and comments counts for each post
      const postIds = postsData.map(post => post.id);

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
      const processedPosts: Post[] = postsData.map(post => ({
        ...post,
        profile: profilesMap.get(post.user_id) || null,
        likes_count: likesCount.get(post.id) || 0,
        comments_count: commentsCount.get(post.id) || 0,
        is_liked: userLikes.has(post.id),
        is_bookmarked: userBookmarks.has(post.id),
      }));

      // Sort posts: followed users first, then others by date
      const sortedPosts = processedPosts.sort((a, b) => {
        const aIsFollowed = currentFollowedUserIds.includes(a.user_id);
        const bIsFollowed = currentFollowedUserIds.includes(b.user_id);
        
        if (aIsFollowed && !bIsFollowed) return -1;
        if (!aIsFollowed && bIsFollowed) return 1;
        
        return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
      });

      if (pageNum === 0 || isBackgroundRefresh) {
        setPosts(sortedPosts);
      } else {
        setPosts(prevPosts => {
          const existingIds = new Set(prevPosts.map(p => p.id));
          const newPosts = sortedPosts.filter(p => !existingIds.has(p.id));
          return [...prevPosts, ...newPosts];
        });
      }

      setPage(pageNum);
      setHasMore(hasMorePosts);

      // Save to cache (only save first few pages to avoid storage issues)
      if (pageNum <= 5) {
        const cacheData: PostsCache = {
          posts: pageNum === 0 ? sortedPosts : posts.concat(sortedPosts),
          page: pageNum,
          hasMore: hasMorePosts,
          followedUserIds: currentFollowedUserIds
        };
        saveToCache(cacheData);
      }

    } catch (error) {
      console.error('Error fetching posts:', error);
      showToast("Failed to load posts", "error");
    } finally {
      setLoading(false);
      setLoadingMore(false);
    }
  };

  const loadMorePosts = useCallback(() => {
    if (!loadingMore && hasMore) {
      fetchPosts(page + 1);
    }
  }, [page, loadingMore, hasMore]);

  // Infinite scroll effect
  useEffect(() => {
    const handleScroll = () => {
      // Check if we're near the bottom of the page (within 500px)
      const scrollPosition = window.innerHeight + window.scrollY;
      const documentHeight = document.documentElement.offsetHeight;
      const threshold = 500; // Start loading when 500px from bottom

      if (scrollPosition >= documentHeight - threshold && !loadingMore && hasMore) {
        loadMorePosts();
      }
    };

    // Add scroll listener with throttling
    let throttleTimeout: NodeJS.Timeout | null = null;
    const throttledHandleScroll = () => {
      if (throttleTimeout) return;
      throttleTimeout = setTimeout(() => {
        handleScroll();
        throttleTimeout = null;
      }, 200); // Throttle to every 200ms
    };

    window.addEventListener('scroll', throttledHandleScroll);
    
    return () => {
      window.removeEventListener('scroll', throttledHandleScroll);
      if (throttleTimeout) {
        clearTimeout(throttleTimeout);
      }
    };
  }, [loadingMore, hasMore, loadMorePosts]);

  const refreshPosts = () => {
    // Clear cache and fetch fresh data
    localStorage.removeItem(CACHE_KEY);
    localStorage.removeItem(CACHE_TIMESTAMP_KEY);
    fetchPosts(0);
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
      if (!post) {
        console.error('Post not found:', postId);
        showToast("Post not found", "error");
        return;
      }

      console.log('Toggling bookmark for post:', postId, 'User ID:', user.id, 'Current state:', post.is_bookmarked);

      if (post.is_bookmarked) {
        const { error, data } = await supabase
          .from('bookmarks')
          .delete()
          .eq('post_id', postId)
          .eq('user_id', user.id);

        console.log('Delete bookmark result:', { error, data });
        if (error) throw error;

        setPosts(posts.map(p => 
          p.id === postId 
            ? { ...p, is_bookmarked: false }
            : p
        ));
        
        console.log('Bookmark removed successfully');
      } else {
        // Check if bookmark already exists to prevent duplicate key error
        const { data: existingBookmark, error: checkError } = await supabase
          .from('bookmarks')
          .select('id')
          .eq('post_id', postId)
          .eq('user_id', user.id)
          .maybeSingle();

        if (checkError) throw checkError;

        if (!existingBookmark) {
          const { error, data } = await supabase
            .from('bookmarks')
            .insert({ post_id: postId, user_id: user.id });

          console.log('Insert bookmark result:', { error, data });
          if (error) throw error;
        }

        setPosts(posts.map(p => 
          p.id === postId 
            ? { ...p, is_bookmarked: true }
            : p
        ));
        
        console.log('Bookmark added successfully');
      }
    } catch (error) {
      console.error('Error toggling bookmark:', error);
      showToast(`Failed to update bookmark: ${error.message || 'Unknown error'}`, "error");
    }
  };

  const handleShare = async (post: Post) => {
    const postUrl = `${window.location.origin}/post/${post.id}`;
    
    try {
      if (navigator.share) {
        await navigator.share({
          title: `Post by ${post.profile?.username || 'Anonymous'}`,
          text: post.body.substring(0, 100) + (post.body.length > 100 ? "..." : ""),
          url: postUrl,
        });
      } else {
        await navigator.clipboard.writeText(postUrl);
      }
    } catch (error) {
      console.error('Error sharing:', error);
    }
  };

  const handleComment = (postId: string) => {
    navigate(`/post/${postId}`);
  };

  const handleFileSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(event.target.files || []);
    if (files.length === 0) return;

    if (selectedFiles.length + files.length > 3) {
      showToast("You can upload a maximum of 3 files in quick post", "error");
      return;
    }

    const validFiles: File[] = [];
    const allowedTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/gif'];

    for (const file of files) {
      if (file.size > 10 * 1024 * 1024) {
        showToast(`File "${file.name}" is too large. Please select files smaller than 10MB`, "error");
        continue;
      }

      if (!allowedTypes.includes(file.type)) {
        showToast(`File "${file.name}" is not supported. Please select image files (JPEG, PNG, GIF)`, "error");
        continue;
      }

      validFiles.push(file);

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

      if (selectedFiles.length > 0) {
        if (selectedFiles.length === 1) {
          const results = await uploadFiles([selectedFiles[0]]);
          attachment_url = results[0].url;
          attachment_type = results[0].type;
        } else {
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

      // Clear cache and refresh posts
      localStorage.removeItem(CACHE_KEY);
      localStorage.removeItem(CACHE_TIMESTAMP_KEY);
      fetchPosts(0);
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
        .eq('user_id', user.id);

      if (error) throw error;

      setPosts(posts.filter(p => p.id !== postId));
      
      // Clear cache since we modified posts
      localStorage.removeItem(CACHE_KEY);
      localStorage.removeItem(CACHE_TIMESTAMP_KEY);
    } catch (error) {
      console.error('Error deleting post:', error);
      showToast("Failed to delete post. Please try again.", "error");
    }
  };

  const handleEditPost = (postId: string) => {
    navigate(`/post/edit/${postId}`);
  };

  if (loading && posts.length === 0) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto">

      {/* Twitter-style compose area */}
      {user && (
        <div className="mx-2 md:mx-4 mb-3 md:mb-4 p-3 md:p-4 border border-border rounded-lg bg-background/80 backdrop-blur-sm">
          <div className="flex gap-2 md:gap-3">
            <Avatar className="h-8 w-8 md:h-10 md:w-10 flex-shrink-0">
              <AvatarImage src={user.user_metadata?.avatar_url} />
              <AvatarFallback className="text-xs md:text-sm">
                {user.user_metadata?.full_name?.[0]?.toUpperCase() || user.email?.[0]?.toUpperCase() || 'U'}
              </AvatarFallback>
            </Avatar>

            <div className="flex-1 min-w-0">
              <Textarea
                placeholder="Got any school work to share?"
                value={composeText}
                onChange={(e) => setComposeText(e.target.value)}
                className="min-h-[50px] md:min-h-[60px] resize-none border-none text-base md:text-xl placeholder:text-muted-foreground focus-visible:ring-0 p-0"
                disabled={isPosting}
              />

              {/* File previews */}
              {selectedFiles.length > 0 && (
                <div className="mt-2 md:mt-3 space-y-2">
                  <div className="flex justify-between items-center">
                    <span className="text-xs md:text-sm text-muted-foreground">
                      {selectedFiles.length} file{selectedFiles.length > 1 ? 's' : ''} selected
                    </span>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={removeAllFiles}
                      className="text-xs text-muted-foreground hover:text-foreground h-6 px-2"
                    >
                      Remove all
                    </Button>
                  </div>
                  <div className="flex gap-2 overflow-x-auto pb-1">
                    {filePreviews.map((preview, index) => (
                      <div key={index} className="relative flex-shrink-0">
                        <img 
                          src={preview} 
                          alt={`Preview ${index + 1}`} 
                          className="w-16 h-16 md:w-20 md:h-20 object-cover rounded-lg"
                        />
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => removeFile(index)}
                          className="absolute -top-1 -right-1 bg-black/50 text-white rounded-full p-0.5 h-5 w-5 text-xs"
                        >
                          ×
                        </Button>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              <div className="flex items-center justify-between mt-2 md:mt-3">
                <div className="flex items-center gap-1 md:gap-2">
                  <Button 
                    variant="ghost" 
                    size="sm" 
                    className="text-primary p-1.5 md:p-2 h-auto rounded-full" 
                    onClick={() => navigate('/post')}
                  >
                    <Upload className="h-4 w-4 md:h-5 md:w-5" />
                  </Button>
                </div>

                <Button 
                  onClick={handleQuickPost}
                  disabled={(!composeText.trim() && selectedFiles.length === 0) || isPosting}
                  className="rounded-full px-4 md:px-6 h-8 md:h-10 text-sm md:text-base"
                >
                  {isPosting ? "Posting..." : "Post"}
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Posts feed */}
      <div className="space-y-2 md:space-y-4 px-2 md:px-0">
        {posts.length === 0 ? (
          <div className="py-8 md:py-12 text-center">
            <p className="text-muted-foreground text-sm md:text-base">No posts yet. Be the first to share something!</p>
          </div>
        ) : (
          <>
            {posts.map((post) => (
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
            ))}
            
            {/* Loading indicator for infinite scroll */}
            {loadingMore && (
              <div className="flex justify-center py-6">
                <div className="flex items-center gap-2 text-muted-foreground">
                  <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-primary"></div>
                  <span className="text-sm">Loading more posts...</span>
                </div>
              </div>
            )}
            
            {!hasMore && posts.length > 0 && (
              <div className="text-center py-6 text-muted-foreground text-sm">
                You've reached the end of the feed
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
