import { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Heart, MessageCircle, Bookmark, Share, ArrowLeft, Send, MoreHorizontal, Trash2, Edit, Flag } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useTwitterToast } from "@/components/ui/twitter-toast";
import { useAuth } from "@/contexts/AuthContext";
import { formatDistanceToNow } from "date-fns";
import { useToast } from "@/hooks/use-toast";

interface Profile {
  username: string;
  profile_pic: string | null;
  school: string | null;
  name: string | null;
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

interface Comment {
  id: string;
  body: string;
  created_at: string;
  user_id: string;
  post_id: string;
  parent_comment_id: string | null;
  profile: Profile | null;
  replies?: Comment[];
}

export default function PostDetail() {
  const { postId } = useParams();
  const navigate = useNavigate();
  const [post, setPost] = useState<Post | null>(null);
  const [comments, setComments] = useState<Comment[]>([]);
  const [loading, setLoading] = useState(true);
  const [commentText, setCommentText] = useState("");
  const [replyText, setReplyText] = useState("");
  const [replyingTo, setReplyingTo] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const { showToast } = useTwitterToast();
  const { toast } = useToast();
  const { user } = useAuth();

  useEffect(() => {
    if (postId) {
      fetchPost();
      fetchComments();
    }
  }, [postId]);

  const fetchPost = async () => {
    if (!postId) return;

    try {
      const { data: postData, error: postError } = await supabase
        .from('posts')
        .select('*')
        .eq('id', postId)
        .single();

      if (postError) throw postError;

      if (!postData) {
        navigate('/home');
        return;
      }

      // Get profile for the post author
      const { data: profileData, error: profileError } = await supabase
        .from('profiles')
        .select('user_id, username, profile_pic, school, name')
        .eq('user_id', postData.user_id)
        .single();

      if (profileError) throw profileError;

      // Get likes and comments count
      const [likesResult, commentsResult] = await Promise.all([
        supabase.from('likes').select('post_id').eq('post_id', postId),
        supabase.from('comments').select('post_id').eq('post_id', postId)
      ]);

      // Check if user liked/bookmarked
      let userLiked = false;
      let userBookmarked = false;

      if (user) {
        const [userLikeResult, userBookmarkResult] = await Promise.all([
          supabase.from('likes').select('post_id').eq('post_id', postId).eq('user_id', user.id).single(),
          supabase.from('bookmarks').select('post_id').eq('post_id', postId).eq('user_id', user.id).single()
        ]);

        userLiked = !!userLikeResult.data;
        userBookmarked = !!userBookmarkResult.data;
      }

      setPost({
        ...postData,
        profile: profileData,
        likes_count: likesResult.data?.length || 0,
        comments_count: commentsResult.data?.length || 0,
        is_liked: userLiked,
        is_bookmarked: userBookmarked,
      });
    } catch (error) {
      console.error('Error fetching post:', error);
      toast({
        title: "Error",
        description: "Failed to load post",
        variant: "destructive",
      });
      navigate('/home');
    } finally {
      setLoading(false);
    }
  };

  const fetchComments = async () => {
    if (!postId) return;

    try {
      const { data: commentsData, error: commentsError } = await supabase
        .from('comments')
        .select('*')
        .eq('post_id', postId)
        .order('created_at', { ascending: true });

      if (commentsError) throw commentsError;

      if (!commentsData) return;

      // Get profiles for comment authors
      const userIds = [...new Set(commentsData.map(comment => comment.user_id))];
      const { data: profilesData, error: profilesError } = await supabase
        .from('profiles')
        .select('user_id, username, profile_pic, school, name')
        .in('user_id', userIds);

      if (profilesError) throw profilesError;

      const profilesMap = new Map(
        profilesData?.map(profile => [profile.user_id, profile]) || []
      );

      // Organize comments with replies
      const commentsWithProfiles = commentsData.map(comment => ({
        ...comment,
        profile: profilesMap.get(comment.user_id) || null,
        replies: [] as Comment[]
      }));

      // Separate top-level comments and replies
      const topLevelComments: Comment[] = [];
      const replies: Comment[] = [];

      commentsWithProfiles.forEach(comment => {
        if (comment.parent_comment_id) {
          replies.push(comment);
        } else {
          topLevelComments.push(comment);
        }
      });

      // Add replies to their parent comments
      topLevelComments.forEach(comment => {
        comment.replies = replies.filter(reply => reply.parent_comment_id === comment.id);
      });

      setComments(topLevelComments);
    } catch (error) {
      console.error('Error fetching comments:', error);
      toast({
        title: "Error",
        description: "Failed to load comments",
        variant: "destructive",
      });
    }
  };

  const handleSubmitComment = async () => {
    if (!user || !postId || !commentText.trim()) return;

    setSubmitting(true);
    try {
      const { error } = await supabase
        .from('comments')
        .insert({
          body: commentText.trim(),
          post_id: postId,
          user_id: user.id,
        });

      if (error) throw error;

      setCommentText("");
      toast({
        title: "Success",
        description: "Comment added successfully",
      });
      fetchComments();
    } catch (error) {
      console.error('Error submitting comment:', error);
      toast({
        title: "Error",
        description: "Failed to add comment. Please try again.",
        variant: "destructive",
      });
    } finally {
      setSubmitting(false);
    }
  };

  const handleSubmitReply = async (parentCommentId: string) => {
    if (!user || !postId || !replyText.trim()) return;

    setSubmitting(true);
    try {
      const { error } = await supabase
        .from('comments')
        .insert({
          body: replyText.trim(),
          post_id: postId,
          user_id: user.id,
          parent_comment_id: parentCommentId,
        });

      if (error) throw error;

      setReplyText("");
      setReplyingTo(null);
      toast({
        title: "Success",
        description: "Reply added successfully",
      });
      fetchComments();
    } catch (error) {
      console.error('Error submitting reply:', error);
      toast({
        title: "Error",
        description: "Failed to add reply. Please try again.",
        variant: "destructive",
      });
    } finally {
      setSubmitting(false);
    }
  };

  const handleLike = async () => {
    if (!user || !post) return;

    try {
      if (post.is_liked) {
        const { error } = await supabase
          .from('likes')
          .delete()
          .eq('post_id', post.id)
          .eq('user_id', user.id);

        if (error) throw error;

        setPost({
          ...post,
          is_liked: false,
          likes_count: post.likes_count - 1
        });
      } else {
        const { error } = await supabase
          .from('likes')
          .insert({ post_id: post.id, user_id: user.id });

        if (error) throw error;

        setPost({
          ...post,
          is_liked: true,
          likes_count: post.likes_count + 1
        });
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

  const handleBookmark = async () => {
    if (!user || !post) return;

    try {
      if (post.is_bookmarked) {
        const { error } = await supabase
          .from('bookmarks')
          .delete()
          .eq('post_id', post.id)
          .eq('user_id', user.id);

        if (error) throw error;

        setPost({
          ...post,
          is_bookmarked: false
        });
      } else {
        const { error } = await supabase
          .from('bookmarks')
          .insert({ post_id: post.id, user_id: user.id });

        if (error) throw error;

        setPost({
          ...post,
          is_bookmarked: true
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

  const handleShare = async () => {
    if (!post) return;

    try {
      if (navigator.share) {
        await navigator.share({
          title: `Post by ${post.profile?.username || 'Anonymous'}`,
          text: post.body.substring(0, 100) + (post.body.length > 100 ? "..." : ""),
          url: window.location.href,
        });
      } else {
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

  const handleDeletePost = async () => {
    if (!user || !post) return;

    try {
      const { error } = await supabase
        .from('posts')
        .delete()
        .eq('id', post.id)
        .eq('user_id', user.id); // Ensure only owner can delete

      if (error) throw error;

      toast({
        title: "Success",
        description: "Post deleted successfully",
      });

      // Navigate back to home after deleting
      navigate('/home');
    } catch (error) {
      console.error('Error deleting post:', error);
      toast({
        title: "Error",
        description: "Failed to delete post. Please try again.",
        variant: "destructive",
      });
    }
  };

  const handleEditPost = () => {
    if (!post) return;
    // Navigate to edit post page
    navigate(`/post/edit/${post.id}`);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  if (!post) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <h1 className="text-2xl font-bold mb-4">Post not found</h1>
          <Button onClick={() => navigate('/home')}>
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back to Home
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto mt-4 mb-4 mx-4">
      {/* Header */}
      <div className="flex items-center gap-4 p-4 border-b border-border mb-4">
        <Button variant="ghost" size="sm" onClick={() => navigate('/home')}>
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <h1 className="text-lg font-semibold">Post</h1>
      </div>

      {/* Post */}
      <div className="border border-border rounded-lg p-4 mb-4">
        <div className="flex gap-3">
          <Avatar className="h-12 w-12 flex-shrink-0">
            <AvatarImage src={post.profile?.profile_pic || undefined} />
            <AvatarFallback>
              {post.profile?.username?.[0]?.toUpperCase() || 'U'}
            </AvatarFallback>
          </Avatar>

          <div className="flex-1 min-w-0">
            <div className="flex items-center justify-between mb-2">
              <div className="flex flex-col">
                <div className="flex items-center gap-2 text-sm">
                  <span className="font-semibold text-foreground">{post.profile?.name || post.profile?.username || 'Anonymous'}</span>
                  <span className="text-muted-foreground">•</span>
                  <span className="text-muted-foreground">@{post.profile?.username || 'anonymous'}</span>
                  <span className="text-muted-foreground">•</span>
                  <span className="text-muted-foreground">{formatDistanceToNow(new Date(post.created_at), { addSuffix: true })}</span>
                </div>
                <div className="flex items-center gap-1 text-sm text-muted-foreground">
                  {post.profile?.school && (
                    <span>{post.profile.school}</span>
                  )}
                  {post.profile?.school && post.profile?.department && (
                    <span className="text-muted-foreground">•</span>
                  )}
                  {post.profile?.department && (
                    <span>{post.profile.department}</span>
                  )}
                </div>
              </div>
              
              <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-8 w-8 p-0 hover:bg-muted rounded-full"
                >
                  <MoreHorizontal className="h-4 w-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-48">
                {user && user.id === post.user_id && (
                  <>
                    <DropdownMenuItem onClick={handleEditPost}>
                      <Edit className="h-4 w-4 mr-2" />
                      Edit post
                    </DropdownMenuItem>
                    <DropdownMenuItem 
                      className="text-destructive focus:text-destructive"
                      onClick={() => {
                        if (confirm('Are you sure you want to delete this post?')) {
                          handleDeletePost();
                        }
                      }}
                    >
                      <Trash2 className="h-4 w-4 mr-2" />
                      Delete post
                    </DropdownMenuItem>
                    <DropdownMenuSeparator />
                  </>
                )}
                <DropdownMenuItem>
                  <Flag className="h-4 w-4 mr-2" />
                  Report post
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>

            <p className="text-foreground whitespace-pre-wrap mb-3 text-lg">{post.body}</p>

            {post.attachment_url && (
              <div className="mb-3 rounded-2xl overflow-hidden border border-border">
                {post.attachment_type?.startsWith('image/') ? (
                  <img 
                    src={post.attachment_url} 
                    alt="Post attachment" 
                    className="w-full max-h-96 object-cover cursor-pointer hover:opacity-90 transition-opacity"
                    onClick={() => window.open(post.attachment_url!, '_blank')}
                    loading="lazy"
                  />
                ) : post.attachment_type === 'application/pdf' || post.attachment_type?.includes('pdf') ? (
                  <div className="p-4 bg-muted">
                    <div className="flex gap-2 items-center">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => window.open(post.attachment_url!, '_blank')}
                        className="flex-1 justify-start"
                      >
                        📄 View PDF Document
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => {
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
                        onClick={() => window.open(post.attachment_url!, '_blank')}
                        className="flex-1 justify-start"
                      >
                        📎 View File ({post.attachment_type || 'Unknown type'})
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => {
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
              <div className="flex gap-2 mb-3">
                {post.school_tag && (
                  <Badge variant="secondary" className="text-xs">{post.school_tag}</Badge>
                )}
                {post.course_tag && (
                  <Badge variant="outline" className="text-xs">{post.course_tag}</Badge>
                )}
              </div>
            )}

            <div className="text-sm text-muted-foreground mb-4">
              {formatDistanceToNow(new Date(post.created_at), { addSuffix: true })}
            </div>

            <div className="flex items-center justify-between max-w-md">
              <Button
                variant="ghost"
                size="sm"
                onClick={handleLike}
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
              >
                <MessageCircle className="h-5 w-5" />
                <span className="text-sm">{post.comments_count}</span>
              </Button>

              <Button
                variant="ghost"
                size="sm"
                onClick={handleBookmark}
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
                onClick={handleShare}
              >
                <Share className="h-5 w-5" />
              </Button>
            </div>
          </div>
        </div>
      </div>

      {/* Comment Form */}
      {user && (
        <div className="border border-border rounded-lg p-4 mb-4">
          <div className="flex gap-3">
            <Avatar className="h-10 w-10 flex-shrink-0">
              <AvatarImage src={user.user_metadata?.avatar_url} />
              <AvatarFallback>
                {user.user_metadata?.full_name?.[0]?.toUpperCase() || user.email?.[0]?.toUpperCase() || 'U'}
              </AvatarFallback>
            </Avatar>

            <div className="flex-1">
              <Textarea
                placeholder="Write a comment..."
                value={commentText}
                onChange={(e) => setCommentText(e.target.value)}
                className="min-h-[80px] resize-none border-none text-base placeholder:text-muted-foreground focus-visible:ring-0 p-0 mb-3"
                disabled={submitting}
              />

              <div className="flex justify-end">
                <Button 
                  onClick={handleSubmitComment}
                  disabled={!commentText.trim() || submitting}
                  className="rounded-full px-6"
                >
                  {submitting ? "Posting..." : "Comment"}
                  <Send className="h-4 w-4 ml-2" />
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Comments */}
      <div className="space-y-4">
        {comments.length === 0 ? (
          <div className="py-8 text-center">
            <p className="text-muted-foreground">No comments yet. Be the first to comment!</p>
          </div>
        ) : (
          comments.map((comment) => (
            <div key={comment.id} className="border border-border rounded-lg p-4">
              <div className="flex gap-3">
                <Avatar className="h-10 w-10 flex-shrink-0">
                  <AvatarImage src={comment.profile?.profile_pic || undefined} />
                  <AvatarFallback>
                    {comment.profile?.username?.[0]?.toUpperCase() || 'U'}
                  </AvatarFallback>
                </Avatar>

                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 text-sm mb-1">
                    <span className="font-semibold text-foreground">{comment.profile?.username || 'Anonymous'}</span>
                    <span className="text-muted-foreground">•</span>
                    <span className="text-muted-foreground">{formatDistanceToNow(new Date(comment.created_at), { addSuffix: true })}</span>
                  </div>

                  <p className="text-foreground whitespace-pre-wrap mb-2">{comment.body}</p>

                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setReplyingTo(replyingTo === comment.id ? null : comment.id)}
                    className="text-muted-foreground hover:text-blue-500 p-0 h-auto"
                  >
                    Reply
                  </Button>

                  {/* Reply Form */}
                  {replyingTo === comment.id && user && (
                    <div className="mt-3 pl-4 border-l-2 border-border">
                      <div className="flex gap-3">
                        <Avatar className="h-8 w-8 flex-shrink-0">
                          <AvatarImage src={user.user_metadata?.avatar_url} />
                          <AvatarFallback>
                            {user.user_metadata?.full_name?.[0]?.toUpperCase() || user.email?.[0]?.toUpperCase() || 'U'}
                          </AvatarFallback>
                        </Avatar>

                        <div className="flex-1">
                          <Textarea
                            placeholder={`Reply to ${comment.profile?.username || 'Anonymous'}...`}
                            value={replyText}
                            onChange={(e) => setReplyText(e.target.value)}
                            className="min-h-[60px] resize-none border-none text-sm placeholder:text-muted-foreground focus-visible:ring-0 p-0 mb-2"
                            disabled={submitting}
                          />

                          <div className="flex gap-2 justify-end">
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => {
                                setReplyingTo(null);
                                setReplyText("");
                              }}
                            >
                              Cancel
                            </Button>
                            <Button 
                              onClick={() => handleSubmitReply(comment.id)}
                              disabled={!replyText.trim() || submitting}
                              size="sm"
                              className="rounded-full px-4"
                            >
                              {submitting ? "Replying..." : "Reply"}
                            </Button>
                          </div>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Replies */}
                  {comment.replies && comment.replies.length > 0 && (
                    <div className="mt-3 pl-4 border-l-2 border-border space-y-3">
                      {comment.replies.map((reply) => (
                        <div key={reply.id} className="flex gap-3">
                          <Avatar className="h-8 w-8 flex-shrink-0">
                            <AvatarImage src={reply.profile?.profile_pic || undefined} />
                            <AvatarFallback>
                              {reply.profile?.username?.[0]?.toUpperCase() || 'U'}
                            </AvatarFallback>
                          </Avatar>

                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 text-sm mb-1">
                              <span className="font-semibold text-foreground">{reply.profile?.username || 'Anonymous'}</span>
                              <span className="text-muted-foreground">•</span>
                              <span className="text-muted-foreground">{formatDistanceToNow(new Date(reply.created_at), { addSuffix: true })}</span>
                            </div>

                            <p className="text-foreground whitespace-pre-wrap text-sm">{reply.body}</p>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}