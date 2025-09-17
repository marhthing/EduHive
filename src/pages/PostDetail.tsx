import { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogTrigger } from "@/components/ui/dialog";
import { Carousel, CarouselContent, CarouselItem, CarouselNext, CarouselPrevious } from "@/components/ui/carousel";
import { Heart, MessageCircle, Bookmark, Share, ArrowLeft, Send, MoreHorizontal, Trash2, Edit, Flag, Reply, X } from "lucide-react";
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
  likes_count: number;
  is_liked: boolean;
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
  const [carouselOpen, setCarouselOpen] = useState(false);
  const [carouselStartIndex, setCarouselStartIndex] = useState(0);
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

      // Get likes data for all comments
      const commentIds = commentsData.map(c => c.id);
      const { data: likesData } = await supabase
        .from('comment_likes')
        .select('comment_id')
        .in('comment_id', commentIds);

      // Get user's likes if logged in
      let userLikesData = [];
      if (user) {
        const { data } = await supabase
          .from('comment_likes')
          .select('comment_id')
          .in('comment_id', commentIds)
          .eq('user_id', user.id);
        userLikesData = data || [];
      }

      // Count likes per comment
      const likesMap = new Map();
      likesData?.forEach(like => {
        likesMap.set(like.comment_id, (likesMap.get(like.comment_id) || 0) + 1);
      });

      const userLikesSet = new Set(userLikesData.map(l => l.comment_id));

      // Organize comments with replies
      const commentsWithProfiles = commentsData.map(comment => ({
        ...comment,
        profile: profilesMap.get(comment.user_id) || null,
        replies: [] as Comment[],
        likes_count: likesMap.get(comment.id) || 0,
        is_liked: userLikesSet.has(comment.id)
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

  const handleCommentLike = async (commentId: string) => {
    if (!user) return;

    try {
      const comment = comments.find(c => c.id === commentId) || 
                    comments.flatMap(c => c.replies || []).find(r => r.id === commentId);

      if (!comment) return;

      if (comment.is_liked) {
        const { error } = await supabase
          .from('comment_likes')
          .delete()
          .eq('comment_id', commentId)
          .eq('user_id', user.id);

        if (error) throw error;
      } else {
        const { error } = await supabase
          .from('comment_likes')
          .insert({ comment_id: commentId, user_id: user.id });

        if (error) throw error;
      }

      fetchComments();
    } catch (error) {
      console.error('Error toggling comment like:', error);
      toast({
        title: "Error",
        description: "Failed to update like. Please try again.",
        variant: "destructive",
      });
    }
  };

  const handleDeleteComment = async (commentId: string) => {
    if (!user) return;

    try {
      const { error } = await supabase
        .from('comments')
        .delete()
        .eq('id', commentId)
        .eq('user_id', user.id);

      if (error) throw error;

      toast({
        title: "Success",
        description: "Comment deleted successfully",
      });

      fetchComments();
    } catch (error) {
      console.error('Error deleting comment:', error);
      toast({
        title: "Error",
        description: "Failed to delete comment. Please try again.",
        variant: "destructive",
      });
    }
  };

  const handleReportComment = async (commentId: string) => {
    if (!user) return;

    try {
      // For now, just show a toast. You can implement actual reporting later
      toast({
        title: "Comment reported",
        description: "Thank you for reporting. We'll review this comment.",
      });
    } catch (error) {
      console.error('Error reporting comment:', error);
      toast({
        title: "Error",
        description: "Failed to report comment. Please try again.",
        variant: "destructive",
      });
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

            {(() => {
              if (!post.attachment_url) return null;

              // Parse attachments
              let attachments;
              try {
                const parsed = JSON.parse(post.attachment_url);
                attachments = Array.isArray(parsed) ? parsed : [{url: post.attachment_url, type: post.attachment_type}];
              } catch {
                attachments = [{url: post.attachment_url, type: post.attachment_type}];
              }

              return (
                <div className="mb-3 space-y-2">
                  {attachments.length === 1 ? (
                    // Single attachment - full width
                    <div className="rounded-2xl overflow-hidden border border-border">
                      {attachments[0].type?.startsWith('image/') ? (
                        <Dialog open={carouselOpen} onOpenChange={setCarouselOpen}>
                          <DialogTrigger asChild>
                            <img 
                              src={attachments[0].url} 
                              alt="Post attachment" 
                              className="w-full max-h-96 object-cover cursor-pointer hover:opacity-90 transition-opacity"
                              loading="lazy"
                              onClick={() => setCarouselStartIndex(0)}
                            />
                          </DialogTrigger>
                          <DialogContent className="max-w-4xl w-full p-0 bg-transparent border-none">
                            <div className="relative">
                              <Button
                                variant="ghost"
                                size="icon"
                                className="absolute top-4 right-4 z-50 bg-black/50 hover:bg-black/70 text-white rounded-full"
                                onClick={() => setCarouselOpen(false)}
                              >
                                <X className="h-6 w-6" />
                              </Button>
                              <Carousel 
                                    className="w-full"
                                    opts={{ 
                                      startIndex: carouselStartIndex,
                                      loop: true 
                                    }}
                                  >
                                <CarouselContent>
                                  {attachments.map((attachment, idx) => (
                                    <CarouselItem key={idx}>
                                      <div className="flex items-center justify-center min-h-[60vh] max-h-[80vh] bg-black rounded-lg">
                                        {attachment.type?.startsWith('image/') ? (
                                          <img
                                            src={attachment.url}
                                            alt={`Attachment ${idx + 1}`}
                                            className="max-w-full max-h-full object-contain"
                                            loading="lazy"
                                          />
                                        ) : attachment.type === 'application/pdf' || attachment.type?.includes('pdf') ? (
                                          <div className="flex flex-col items-center justify-center p-8 text-white">
                                            <div className="text-6xl mb-4">📄</div>
                                            <p className="text-xl mb-4">PDF Document</p>
                                            <div className="flex gap-4">
                                              <Button
                                                variant="outline"
                                                onClick={() => window.open(attachment.url, '_blank')}
                                              >
                                                View PDF
                                              </Button>
                                              <Button
                                                variant="outline"
                                                onClick={() => {
                                                  const link = document.createElement('a');
                                                  link.href = attachment.url;
                                                  link.download = 'document.pdf';
                                                  link.target = '_blank';
                                                  document.body.appendChild(link);
                                                  link.click();
                                                  document.body.removeChild(link);
                                                }}
                                              >
                                                Download
                                              </Button>
                                            </div>
                                          </div>
                                        ) : (
                                          <div className="flex flex-col items-center justify-center p-8 text-white">
                                            <div className="text-6xl mb-4">📎</div>
                                            <p className="text-xl mb-4">File ({attachment.type || 'Unknown'})</p>
                                            <div className="flex gap-4">
                                              <Button
                                                variant="outline"
                                                onClick={() => window.open(attachment.url, '_blank')}
                                              >
                                                View File
                                              </Button>
                                              <Button
                                                variant="outline"
                                                onClick={() => {
                                                  const link = document.createElement('a');
                                                  link.href = attachment.url;
                                                  link.download = 'attachment';
                                                  link.target = '_blank';
                                                  document.body.appendChild(link);
                                                  link.click();
                                                  document.body.removeChild(link);
                                                }}
                                              >
                                                Download
                                              </Button>
                                            </div>
                                          </div>
                                        )}
                                      </div>
                                    </CarouselItem>
                                  ))}
                                </CarouselContent>
                                <CarouselPrevious className="left-4 bg-black/50 hover:bg-black/70 text-white border-none" />
                                <CarouselNext className="right-4 bg-black/50 hover:bg-black/70 text-white border-none" />
                              </Carousel>
                            </div>
                          </DialogContent>
                        </Dialog>
                      ) : attachments[0].type === 'application/pdf' || attachments[0].type?.includes('pdf') ? (
                        <div className="p-4 bg-muted">
                          <div className="flex gap-2 items-center">
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => window.open(attachments[0].url, '_blank')}
                              className="flex-1 justify-start"
                            >
                              📄 View PDF Document
                            </Button>
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => {
                                const link = document.createElement('a');
                                link.href = attachments[0].url;
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
                              onClick={() => window.open(attachments[0].url, '_blank')}
                              className="flex-1 justify-start"
                            >
                              📎 View File ({attachments[0].type || 'Unknown type'})
                            </Button>
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => {
                                const link = document.createElement('a');
                                link.href = attachments[0].url;
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
                  ) : (
                    // Multiple attachments - grid layout
                    <div className={`grid gap-2 ${
                      attachments.length === 2 ? 'grid-cols-2' : 
                      attachments.length === 3 ? 'grid-cols-2' :
                      'grid-cols-2'
                    }`}>
                      {attachments.slice(0, 4).map((attachment, index) => (
                        <div key={index} className="relative rounded-2xl overflow-hidden border border-border">
                          {index === 3 && attachments.length > 4 ? (
                            <Dialog open={carouselOpen} onOpenChange={setCarouselOpen}>
                              <DialogTrigger asChild>
                                <div className="relative cursor-pointer" onClick={(e) => e.stopPropagation()}>
                                  {attachment.type?.startsWith('image/') ? (
                                    <img
                                      src={attachment.url}
                                      alt={`Attachment ${index + 1}`}
                                      className="w-full h-48 object-cover"
                                      loading="lazy"
                                    />
                                  ) : (
                                    <div className="w-full h-48 bg-muted flex items-center justify-center">
                                      <span className="text-sm">📎 File</span>
                                    </div>
                                  )}
                                  <div className="absolute inset-0 bg-black/60 flex items-center justify-center hover:bg-black/70 transition-colors">
                                    <span className="text-white text-lg font-semibold">
                                      +{attachments.length - 4} more
                                    </span>
                                  </div>
                                </div>
                              </DialogTrigger>
                              <DialogContent className="max-w-4xl w-full p-0 bg-transparent border-none">
                                <div className="relative">
                                  <Button
                                    variant="ghost"
                                    size="icon"
                                    className="absolute top-4 right-4 z-50 bg-black/50 hover:bg-black/70 text-white rounded-full"
                                    onClick={() => setCarouselOpen(false)}
                                  >
                                    <X className="h-6 w-6" />
                                  </Button>
                                  <Carousel 
                                        className="w-full"
                                        opts={{ 
                                          startIndex: carouselStartIndex,
                                          loop: true 
                                        }}
                                      >
                                    <CarouselContent>
                                      {attachments.map((attachment, idx) => (
                                        <CarouselItem key={idx}>
                                          <div className="flex items-center justify-center min-h-[60vh] max-h-[80vh] bg-black rounded-lg">
                                            {attachment.type?.startsWith('image/') ? (
                                              <img
                                                src={attachment.url}
                                                alt={`Attachment ${idx + 1}`}
                                                className="max-w-full max-h-full object-contain"
                                                loading="lazy"
                                              />
                                            ) : attachment.type === 'application/pdf' || attachment.type?.includes('pdf') ? (
                                              <div className="flex flex-col items-center justify-center p-8 text-white">
                                                <div className="text-6xl mb-4">📄</div>
                                                <p className="text-xl mb-4">PDF Document</p>
                                                <div className="flex gap-4">
                                                  <Button
                                                    variant="outline"
                                                    onClick={() => window.open(attachment.url, '_blank')}
                                                  >
                                                    View PDF
                                                  </Button>
                                                  <Button
                                                    variant="outline"
                                                    onClick={() => {
                                                      const link = document.createElement('a');
                                                      link.href = attachment.url;
                                                      link.download = 'document.pdf';
                                                      link.target = '_blank';
                                                      document.body.appendChild(link);
                                                      link.click();
                                                      document.body.removeChild(link);
                                                    }}
                                                  >
                                                    Download
                                                  </Button>
                                                </div>
                                              </div>
                                            ) : (
                                              <div className="flex flex-col items-center justify-center p-8 text-white">
                                                <div className="text-6xl mb-4">📎</div>
                                                <p className="text-xl mb-4">File ({attachment.type || 'Unknown'})</p>
                                                <div className="flex gap-4">
                                                  <Button
                                                    variant="outline"
                                                    onClick={() => window.open(attachment.url, '_blank')}
                                                  >
                                                    View File
                                                  </Button>
                                                  <Button
                                                    variant="outline"
                                                    onClick={() => {
                                                      const link = document.createElement('a');
                                                      link.href = attachment.url;
                                                      link.download = 'attachment';
                                                      link.target = '_blank';
                                                      document.body.appendChild(link);
                                                      link.click();
                                                      document.body.removeChild(link);
                                                    }}
                                                  >
                                                    Download
                                                  </Button>
                                                </div>
                                              </div>
                                            )}
                                          </div>
                                        </CarouselItem>
                                      ))}
                                    </CarouselContent>
                                    <CarouselPrevious className="left-4 bg-black/50 hover:bg-black/70 text-white border-none" />
                                    <CarouselNext className="right-4 bg-black/50 hover:bg-black/70 text-white border-none" />
                                  </Carousel>
                                </div>
                              </DialogContent>
                            </Dialog>
                          ) : attachment.type?.startsWith('image/') ? (
                            <Dialog open={carouselOpen} onOpenChange={setCarouselOpen}>
                              <DialogTrigger asChild>
                                <img
                                  src={attachment.url}
                                  alt={`Attachment ${index + 1}`}
                                  className="w-full h-48 object-cover cursor-pointer hover:opacity-90 transition-opacity"
                                  loading="lazy"
                                  onClick={() => setCarouselStartIndex(index)}
                                />
                              </DialogTrigger>
                              <DialogContent className="max-w-4xl w-full p-0 bg-transparent border-none">
                                <div className="relative">
                                  <Button
                                    variant="ghost"
                                    size="icon"
                                    className="absolute top-4 right-4 z-50 bg-black/50 hover:bg-black/70 text-white rounded-full"
                                    onClick={() => setCarouselOpen(false)}
                                  >
                                    <X className="h-6 w-6" />
                                  </Button>
                                  <Carousel 
                                        className="w-full"
                                        opts={{ 
                                          startIndex: carouselStartIndex,
                                          loop: true 
                                        }}
                                      >
                                    <CarouselContent>
                                      {attachments.map((attachment, idx) => (
                                        <CarouselItem key={idx}>
                                          <div className="flex items-center justify-center min-h-[60vh] max-h-[80vh] bg-black rounded-lg">
                                            {attachment.type?.startsWith('image/') ? (
                                              <img
                                                src={attachment.url}
                                                alt={`Attachment ${idx + 1}`}
                                                className="max-w-full max-h-full object-contain"
                                                loading="lazy"
                                              />
                                            ) : attachment.type === 'application/pdf' || attachment.type?.includes('pdf') ? (
                                              <div className="flex flex-col items-center justify-center p-8 text-white">
                                                <div className="text-6xl mb-4">📄</div>
                                                <p className="text-xl mb-4">PDF Document</p>
                                                <div className="flex gap-4">
                                                  <Button
                                                    variant="outline"
                                                    onClick={() => window.open(attachment.url, '_blank')}
                                                  >
                                                    View PDF
                                                  </Button>
                                                  <Button
                                                    variant="outline"
                                                    onClick={() => {
                                                      const link = document.createElement('a');
                                                      link.href = attachment.url;
                                                      link.download = 'document.pdf';
                                                      link.target = '_blank';
                                                      document.body.appendChild(link);
                                                      link.click();
                                                      document.body.removeChild(link);
                                                    }}
                                                  >
                                                    Download
                                                  </Button>
                                                </div>
                                              </div>
                                            ) : (
                                              <div className="flex flex-col items-center justify-center p-8 text-white">
                                                <div className="text-6xl mb-4">📎</div>
                                                <p className="text-xl mb-4">File ({attachment.type || 'Unknown'})</p>
                                                <div className="flex gap-4">
                                                  <Button
                                                    variant="outline"
                                                    onClick={() => window.open(attachment.url, '_blank')}
                                                  >
                                                    View File
                                                  </Button>
                                                  <Button
                                                    variant="outline"
                                                    onClick={() => {
                                                      const link = document.createElement('a');
                                                      link.href = attachment.url;
                                                      link.download = 'attachment';
                                                      link.target = '_blank';
                                                      document.body.appendChild(link);
                                                      link.click();
                                                      document.body.removeChild(link);
                                                    }}
                                                  >
                                                    Download
                                                  </Button>
                                                </div>
                                              </div>
                                            )}
                                          </div>
                                        </CarouselItem>
                                      ))}
                                    </CarouselContent>
                                    <CarouselPrevious className="left-4 bg-black/50 hover:bg-black/70 text-white border-none" />
                                    <CarouselNext className="right-4 bg-black/50 hover:bg-black/70 text-white border-none" />
                                  </Carousel>
                                </div>
                              </DialogContent>
                            </Dialog>
                          ) : (
                            <div className="w-full h-48 bg-muted flex items-center justify-center cursor-pointer hover:bg-muted/80 transition-colors"
                                 onClick={() => window.open(attachment.url, '_blank')}>
                              <div className="text-center">
                                <div className="text-2xl mb-2">
                                  {attachment.type?.includes('pdf') ? '📄' : '📎'}
                                </div>
                                <span className="text-sm">
                                  {attachment.type?.includes('pdf') ? 'PDF' : 'File'}
                                </span>
                              </div>
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              );
            })()}

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
                  <div className="flex items-center justify-between mb-1">
                    <div className="flex items-center gap-2 text-sm">
                      <span className="font-semibold text-foreground">{comment.profile?.username || 'Anonymous'}</span>
                      <span className="text-muted-foreground">•</span>
                      <span className="text-muted-foreground">{formatDistanceToNow(new Date(comment.created_at), { addSuffix: true })}</span>
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
                        {user && user.id === comment.user_id ? (
                          <DropdownMenuItem 
                            className="text-destructive focus:text-destructive"
                            onClick={() => {
                              if (confirm('Are you sure you want to delete this comment?')) {
                                handleDeleteComment(comment.id);
                              }
                            }}
                          >
                            <Trash2 className="h-4 w-4 mr-2" />
                            Delete comment
                          </DropdownMenuItem>
                        ) : (
                          <DropdownMenuItem onClick={() => handleReportComment(comment.id)}>
                            <Flag className="h-4 w-4 mr-2" />
                            Report comment
                          </DropdownMenuItem>
                        )}
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>

                  <p className="text-foreground whitespace-pre-wrap mb-2">{comment.body}</p>

                  <div className="flex items-center gap-4">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleCommentLike(comment.id)}
                      className={`flex items-center gap-1 hover:bg-red-500/10 rounded-full p-1 h-auto transition-colors ${
                        comment.is_liked ? 'text-red-500' : 'text-muted-foreground hover:text-red-500'
                      }`}
                    >
                      <Heart className={`h-4 w-4 ${comment.is_liked ? 'fill-current text-red-500' : ''}`} />
                      <span className="text-xs">{comment.likes_count}</span>
                    </Button>

                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => setReplyingTo(replyingTo === comment.id ? null : comment.id)}
                      className="text-muted-foreground hover:text-blue-500 p-1 h-auto flex items-center gap-1"
                    >
                      <Reply className="h-4 w-4" />
                      <span className="text-xs">Reply</span>
                    </Button>
                  </div>

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
                            <div className="flex items-center justify-between mb-1">
                              <div className="flex items-center gap-2 text-sm">
                                <span className="font-semibold text-foreground">{reply.profile?.username || 'Anonymous'}</span>
                                <span className="text-muted-foreground">•</span>
                                <span className="text-muted-foreground">{formatDistanceToNow(new Date(reply.created_at), { addSuffix: true })}</span>
                              </div>

                              <DropdownMenu>
                                <DropdownMenuTrigger asChild>
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    className="h-6 w-6 p-0 hover:bg-muted rounded-full"
                                  >
                                    <MoreHorizontal className="h-3 w-3" />
                                  </Button>
                                </DropdownMenuTrigger>
                                <DropdownMenuContent align="end" className="w-48">
                                  {user && user.id === reply.user_id ? (
                                    <DropdownMenuItem 
                                      className="text-destructive focus:text-destructive"
                                      onClick={() => {
                                        if (confirm('Are you sure you want to delete this reply?')) {
                                          handleDeleteComment(reply.id);
                                        }
                                      }}
                                    >
                                      <Trash2 className="h-4 w-4 mr-2" />
                                      Delete reply
                                    </DropdownMenuItem>
                                  ) : (
                                    <DropdownMenuItem onClick={() => handleReportComment(reply.id)}>
                                      <Flag className="h-4 w-4 mr-2" />
                                      Report reply
                                    </DropdownMenuItem>
                                  )}
                                </DropdownMenuContent>
                              </DropdownMenu>
                            </div>

                            <p className="text-foreground whitespace-pre-wrap text-sm mb-2">{reply.body}</p>

                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handleCommentLike(reply.id)}
                              className={`flex items-center gap-1 hover:bg-red-500/10 rounded-full p-1 h-auto transition-colors ${
                                reply.is_liked ? 'text-red-500' : 'text-muted-foreground hover:text-red-500'
                              }`}
                            >
                              <Heart className={`h-3 w-3 ${reply.is_liked ? 'fill-current text-red-500' : ''}`} />
                              <span className="text-xs">{reply.likes_count}</span>
                            </Button>
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