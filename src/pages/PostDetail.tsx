import { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogTrigger } from "@/components/ui/dialog";
import { Carousel, CarouselContent, CarouselItem, CarouselNext, CarouselPrevious } from "@/components/ui/carousel";
import { Heart, MessageCircle, Bookmark, Share, ArrowLeft, Send, MoreHorizontal, Trash2, Edit, Flag, Reply, X, Download } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useTwitterToast } from "@/components/ui/twitter-toast";
import { useAuth } from "@/contexts/AuthContext";
import { formatTimeShort } from "@/lib/timeFormat";
import { useToast } from "@/hooks/use-toast";
import { ConfirmationModal } from "@/components/ConfirmationModal";
import { MentionInput } from "@/components/MentionInput";
import { MentionText } from "@/components/MentionText";
import { processAIBotMention, parseAIBotMention, type AIBotRequest } from "@/lib/aiBot";
import { AI_BOT_PROFILE, AI_BOT_USER_ID } from "@/lib/aiBotProfile";
import { createMentionNotifications } from "@/lib/mentionNotifications";

interface Profile {
  username: string;
  profile_pic: string | null;
  school: string | null;
  name: string | null;
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
  const [commentMentions, setCommentMentions] = useState<any[]>([]);
  const [replyText, setReplyText] = useState("");
  const [replyMentions, setReplyMentions] = useState<any[]>([]);
  const [replyingTo, setReplyingTo] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [carouselOpen, setCarouselOpen] = useState(false);
  const [carouselStartIndex, setCarouselStartIndex] = useState(0);
  const [deletePostModalOpen, setDeletePostModalOpen] = useState(false);
  const [deleteCommentModalOpen, setDeleteCommentModalOpen] = useState(false);
  const [commentToDelete, setCommentToDelete] = useState<string | null>(null);
  const [currentUserProfile, setCurrentUserProfile] = useState<Profile | null>(null);
  const { showToast } = useTwitterToast();
  const { toast } = useToast();
  const { user } = useAuth();

  // Fetch current user's profile for updated avatar
  useEffect(() => {
    const fetchCurrentUserProfile = async () => {
      if (!user) return;

      try {
        const { data: profileData, error } = await supabase
          .from('profiles')
          .select('username, name, profile_pic, school, department')
          .eq('user_id', user.id)
          .single();

        if (error) throw error;
        setCurrentUserProfile(profileData);
      } catch (error) {
        // console.error('Error fetching current user profile:', error);
      }
    };

    fetchCurrentUserProfile();
  }, [user]);

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
        if (user) {
          navigate('/home');
        } else {
          navigate('/');
        }
        return;
      }

      // Get profile for the post author
      const { data: profileData, error: profileError } = await supabase
        .from('profiles')
        .select('user_id, username, profile_pic, school, name, department')
        .eq('user_id', postData.user_id)
        .single();

      if (profileError) throw profileError;

      // Get likes and comments count (only parent comments)
      const [likesResult, commentsResult] = await Promise.all([
        supabase.from('likes').select('post_id').eq('post_id', postId),
        supabase.from('comments').select('post_id').eq('post_id', postId).is('parent_comment_id', null)
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
      // console.error('Error fetching post:', error);
      toast({
        title: "Error",
        description: "Failed to load post",
        variant: "destructive",
      });
      if (user) {
        navigate('/home');
      } else {
        navigate('/');
      }
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
        .select('user_id, username, profile_pic, school, name, department')
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
        // Handle AI bot comments with special profile
        if (comment.user_id === AI_BOT_USER_ID) {
          comment.profile = AI_BOT_PROFILE;
        }

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
      // console.error('Error fetching comments:', error);
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
      // AI bot processing will be handled after comment creation

      // First, save the user's comment
      const { data: commentData, error: commentError } = await supabase
        .from('comments')
        .insert({
          body: commentText.trim(),
          post_id: postId,
          user_id: user.id,
        })
        .select('id')
        .single();

      if (commentError) throw commentError;

      // console.log('Comment created successfully:', commentData);

      // Create mention notifications
      if (commentMentions.length > 0 && commentData?.id) {
        // console.log('Comment mentions:', commentMentions);
        await createMentionNotifications(commentMentions, user.id, postId, commentData.id);
      }

      toast({
        title: "Success",
        description: "Comment added successfully",
      });

      // Check if AI bot was mentioned and create response
      const originalCommentText = commentText; // Store before clearing
      setCommentText("");
      setCommentMentions([]);

      if (commentMentions.some(mention => mention.username === 'eduhive')) {
        // console.log('Creating AI bot response comment...');
        try {
          // Parse the original comment to understand what the user asked
          const botRequest = parseAIBotMention(originalCommentText);

          if (botRequest && post) {
            // Parse post attachments if they exist
            let attachments = [];
            if (post?.attachment_url) {
              try {
                const parsed = JSON.parse(post.attachment_url);
                attachments = Array.isArray(parsed) ? parsed : [{url: post.attachment_url, type: post.attachment_type}];
              } catch {
                attachments = [{url: post.attachment_url, type: post.attachment_type}];
              }
            }

            // Set up the AI request properly based on what the user asked
            botRequest.postContent = post.body;
            botRequest.context = `Post by ${post.profile?.username || 'Anonymous'}: ${post.body}`;
            botRequest.attachments = attachments;

            const aiResponse = await processAIBotMention(botRequest);

            // Create AI bot reply to the comment that mentioned it
            const { data: aiBotComment, error: aiBotCommentError } = await supabase
              .from('comments')
              .insert({
                body: aiResponse,
                post_id: postId,
                user_id: AI_BOT_USER_ID,
                parent_comment_id: commentData.id, // Reply to the comment that mentioned the AI bot
              });

            if (aiBotCommentError) {
              // console.error('Error creating AI bot comment:', aiBotCommentError);
            } else {
              // console.log('AI bot comment created successfully');
            }
          }
        } catch (error) {
          // console.error('Error creating AI bot comment:', error);
        }
      }

      // Refresh comments to show user's comment and AI response
      await fetchComments();

    } catch (error) {
      // console.error('Error submitting comment:', error);
      toast({
        title: "Error",
        description: "Failed to add comment. Please try again.",
        variant: "destructive",
      });
    } finally {
      setSubmitting(false);
    }
  };

  // Function to handle reply button click with auto-mention (Twitter-like behavior)
  const handleReplyClick = (commentId: string, directReplyAuthor: any, parentComment?: any) => {
    if (replyingTo === commentId) {
      // If already replying to this comment, close the reply form
      setReplyingTo(null);
      setReplyText("");
      setReplyMentions([]);
      return;
    }

    // Set the reply target
    setReplyingTo(commentId);

    // Auto-populate mentions based on context
    const mentionsToAdd = new Set<string>();
    const mentionUsers: any[] = [];

    // Always mention the direct person being replied to
    if (directReplyAuthor?.username && directReplyAuthor.username !== user?.user_metadata?.username) {
      mentionsToAdd.add(directReplyAuthor.username);
      mentionUsers.push({
        id: directReplyAuthor.user_id || directReplyAuthor.id,
        username: directReplyAuthor.username,
        name: directReplyAuthor.name || directReplyAuthor.username,
        profile_pic: directReplyAuthor.profile_pic
      });
    }

    // If this is a nested reply, also mention the parent comment author
    if (parentComment?.profile?.username && 
        parentComment.profile.username !== user?.user_metadata?.username &&
        parentComment.profile.username !== directReplyAuthor?.username) {
      mentionsToAdd.add(parentComment.profile.username);
      mentionUsers.push({
        id: parentComment.profile.user_id || parentComment.profile.id,
        username: parentComment.profile.username,
        name: parentComment.profile.name || parentComment.profile.username,
        profile_pic: parentComment.profile.profile_pic
      });
    }

    // Create the auto-populated text with mentions
    const autoMentions = Array.from(mentionsToAdd).map(username => `@${username}`).join(' ');
    const initialText = autoMentions ? `${autoMentions} ` : '';

    setReplyText(initialText);
    setReplyMentions(mentionUsers);
  };

  const handleSubmitReply = async (parentCommentId: string) => {
    if (!user || !postId || !replyText.trim()) return;

    setSubmitting(true);
    try {
      // Create the reply and get its ID
      const { data: replyData, error: replyError } = await supabase
        .from('comments')
        .insert({
          body: replyText.trim(),
          post_id: postId,
          user_id: user.id,
          parent_comment_id: parentCommentId,
        })
        .select('id')
        .single();

      if (replyError) throw replyError;

      // console.log('Reply created successfully:', replyData);

      // Create mention notifications for replies using the new reply's ID
      if (replyMentions.length > 0 && replyData?.id) {
        // console.log('Reply mentions:', replyMentions);
        await createMentionNotifications(replyMentions, user.id, postId, replyData.id);
      }

      setReplyText("");
      setReplyMentions([]);
      setReplyingTo(null);
      toast({
        title: "Success",
        description: "Reply added successfully",
      });
      fetchComments();
    } catch (error) {
      // console.error('Error submitting reply:', error);
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
      // console.error('Error toggling like:', error);
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
      // console.error('Error toggling bookmark:', error);
      toast({
        title: "Error",
        description: "Failed to update bookmark. Please try again.",
        variant: "destructive",
      });
    }
  };

  const handleShare = async () => {
    if (!post) return;

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
        toast({
          title: "Link copied",
          description: "Post link copied to clipboard",
        });
      }
    } catch (error) {
      // console.error('Error sharing:', error);
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
      // console.error('Error toggling comment like:', error);
      toast({
        title: "Error",
        description: "Failed to update like. Please try again.",
        variant: "destructive",
      });
    }
  };

  const handleDeleteComment = async (commentId: string) => {
    setCommentToDelete(commentId);
    setDeleteCommentModalOpen(true);
  };

  const confirmDeleteComment = async () => {
    if (!user || !commentToDelete) return;

    try {
      const { error } = await supabase
        .from('comments')
        .delete()
        .eq('id', commentToDelete)
        .eq('user_id', user.id);

      if (error) throw error;

      toast({
        title: "Success",
        description: "Comment deleted successfully",
      });

      fetchComments();
    } catch (error) {
      // console.error('Error deleting comment:', error);
      toast({
        title: "Error",
        description: "Failed to delete comment. Please try again.",
        variant: "destructive",
      });
    } finally {
      setCommentToDelete(null);
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
      // console.error('Error reporting comment:', error);
      toast({
        title: "Error",
        description: "Failed to report comment. Please try again.",
        variant: "destructive",
      });
    }
  };

  const handleDeletePost = () => {
    setDeletePostModalOpen(true);
  };

  const confirmDeletePost = async () => {
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
      // console.error('Error deleting post:', error);
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
        <img src="/logo-animated.svg" alt="Loading" className="h-8 w-8" />
      </div>
    );
  }

  if (!post) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <h1 className="text-2xl font-bold mb-4">Post not found</h1>
          <Button onClick={() => navigate(user ? '/home' : '/')}>
            <ArrowLeft className="h-4 w-4 mr-2" />
            {user ? 'Back to Home' : 'Back to Landing'}
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto mt-4 mb-4 mx-4">
      {/* Header */}
      <div className="flex items-center gap-4 p-4 border-b border-border mb-4">
        <Button variant="ghost" size="sm" onClick={() => navigate(user ? '/home' : '/')}>
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <h1 className="text-lg font-semibold">Post</h1>
      </div>

      {/* Post */}
      <div className="border border-border rounded-lg p-4 mb-4">
        {/* Header with avatar and user info */}
        <div className="flex gap-3 mb-3">
          <Avatar 
            className="h-12 w-12 flex-shrink-0 cursor-pointer hover:opacity-80 transition-opacity"
            onClick={() => post.profile?.username && navigate(`/profile/${post.profile.username}`)}
          >
            <AvatarImage src={post.profile?.profile_pic || (post.user_id === user?.id ? user?.user_metadata?.avatar_url || user?.user_metadata?.profile_pic : undefined)} />
            <AvatarFallback>
              {post.profile?.username?.[0]?.toUpperCase() || 'U'}
            </AvatarFallback>
          </Avatar>

          <div className="flex-1 min-w-0">
            <div className="flex items-center justify-between">
              <div className="flex flex-col">
                <div className="flex items-center gap-2 text-sm">
                  <span 
                    className="font-semibold text-foreground cursor-pointer hover:underline"
                    onClick={() => post.profile?.username && navigate(`/profile/${post.profile.username}`)}
                  >
                    {post.profile?.name || post.profile?.username || 'Anonymous'}
                  </span>
                  <span className="text-muted-foreground">•</span>
                  <span 
                    className="text-muted-foreground cursor-pointer hover:underline"
                    onClick={() => post.profile?.username && navigate(`/profile/${post.profile.username}`)}
                  >
                    @{post.profile?.username || 'anonymous'}
                  </span>
                  <span className="text-muted-foreground">•</span>
                  <span className="text-muted-foreground">{formatTimeShort(post.created_at)}</span>
                </div>
                <div className="flex items-center gap-1 text-xs md:text-sm text-muted-foreground truncate" style={{ marginTop: '-10px !important' }}>
                  {post.profile?.school && (
                    <span className="truncate flex-shrink-0 max-w-[120px] md:max-w-none">{post.profile.school}</span>
                  )}
                  {post.profile?.school && post.profile?.department && (
                    <span className="text-muted-foreground flex-shrink-0">•</span>
                  )}
                  {post.profile?.department && (
                    <span className="truncate flex-shrink-0 max-w-[100px] md:max-w-none">{post.profile.department}</span>
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
                        onClick={handleDeletePost}
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
          </div>
        </div>

        {/* Post body - now starts from the left */}
        <MentionText 
          text={post.body} 
          className="text-foreground whitespace-pre-wrap mb-3 text-lg block" 
        />

            {/* Attachments - aligned with post body */}
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

          // Check if all attachments are images
          const allImages = attachments.every(att => att.type?.startsWith('image/'));

          // If all are images, use grid layout
          if (allImages) {
            return (
              <div className="mb-3 space-y-2">
                {attachments.length === 1 ? (
                  // Single image - full width
                  <div className="rounded-2xl overflow-hidden border border-border">
                    <Dialog open={carouselOpen} onOpenChange={setCarouselOpen}>
                      <DialogTrigger asChild>
                        {user ? (
                          <img
                            src={attachments[0].url}
                            alt="Post attachment"
                            className="w-full max-h-96 object-cover cursor-pointer hover:opacity-90 transition-opacity"
                            loading="lazy"
                            onClick={() => setCarouselStartIndex(0)}
                          />
                        ) : (
                          <img
                            src={attachments[0].url}
                            alt="Post attachment"
                            className="w-full max-h-96 object-cover cursor-not-allowed opacity-75"
                            loading="lazy"
                            title="Login to view full image"
                          />
                        )}
                      </DialogTrigger>
                      {user && (
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
                                      <img
                                        src={attachment.url}
                                        alt={`Attachment ${idx + 1}`}
                                        className="max-w-full max-h-full object-contain"
                                        loading="lazy"
                                      />
                                    </div>
                                  </CarouselItem>
                                ))}
                              </CarouselContent>
                              <CarouselPrevious className="left-4 bg-black/50 hover:bg-black/70 text-white border-none" />
                              <CarouselNext className="right-4 bg-black/50 hover:bg-black/70 text-white border-none" />
                            </Carousel>
                          </div>
                        </DialogContent>
                      )}
                    </Dialog>
                  </div>
                ) : (
                  // Multiple images - grid layout
                  <div className={`grid gap-2 ${
                    attachments.length === 2 ? 'grid-cols-2' :
                    attachments.length === 3 ? 'grid-cols-2' :
                    'grid-cols-2'
                  }`}>
                    {attachments.slice(0, 4).map((attachment, index) => (
                      <div key={index} className="relative rounded-2xl overflow-hidden border border-border">
                        {index === 3 && attachments.length > 4 ? (
                          <div className="relative cursor-pointer" onClick={(e) => e.stopPropagation()}>
                            <img
                              src={attachment.url}
                              alt={`Attachment ${index + 1}`}
                              className="w-full h-48 object-cover"
                              loading="lazy"
                            />
                            <div className="absolute inset-0 bg-black/60 flex items-center justify-center hover:bg-black/70 transition-colors">
                              <span className="text-white text-lg font-semibold">
                                +{attachments.length - 4} more
                              </span>
                            </div>
                          </div>
                        ) : (
                          <Dialog open={carouselOpen} onOpenChange={setCarouselOpen}>
                            <DialogTrigger asChild>
                              <div className="cursor-pointer" onClick={(e) => {
                                e.stopPropagation();
                                setCarouselStartIndex(index);
                                setCarouselOpen(true);
                              }}>
                                {user ? (
                                  <img
                                    src={attachment.url}
                                    alt={`Attachment ${index + 1}`}
                                    className="w-full h-48 object-cover cursor-pointer hover:opacity-90 transition-opacity"
                                    loading="lazy"
                                  />
                                ) : (
                                  <img
                                    src={attachment.url}
                                    alt={`Attachment ${index + 1}`}
                                    className="w-full h-48 object-cover cursor-not-allowed opacity-75"
                                    loading="lazy"
                                    title="Login to view full image"
                                  />
                                )}
                              </div>
                            </DialogTrigger>
                            {user && (
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
                                            <img
                                              src={attachment.url}
                                              alt={`Attachment ${idx + 1}`}
                                              className="max-w-full max-h-full object-contain"
                                              loading="lazy"
                                            />
                                          </div>
                                        </CarouselItem>
                                      ))}
                                    </CarouselContent>
                                    <CarouselPrevious className="left-4 bg-black/50 hover:bg-black/70 text-white border-none" />
                                    <CarouselNext className="right-4 bg-black/50 hover:bg-black/70 text-white border-none" />
                                  </Carousel>
                                </div>
                              </DialogContent>
                            )}
                          </Dialog>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            );
          }

          // For documents/mixed content, use list layout
          return (
            <div className="mb-3 space-y-2">
              {attachments.map((attachment, index) => {
                if (attachment.type?.startsWith('image/')) {
                  return (
                    <div key={index} className="rounded-2xl overflow-hidden border border-border">
                      <img
                        src={attachment.url}
                        alt={`Attachment ${index + 1}`}
                        className="w-full h-full max-h-96 object-cover cursor-pointer hover:opacity-90 transition-opacity"
                        onClick={() => {
                          // Navigate to post detail or handle image click
                        }}
                        loading="lazy"
                      />
                    </div>
                  );
                }

                // Document/file list item
                return (
                  <div key={index} className="flex items-center gap-3 p-3 bg-muted rounded-lg border border-border">
                    <div className="flex-shrink-0">
                      {attachment.type === 'application/pdf' || attachment.type?.includes('pdf') ? (
                        <div className="h-8 w-8 text-red-500 text-2xl">📄</div>
                      ) : (
                        <div className="h-8 w-8 text-muted-foreground text-2xl">📎</div>
                      )}
                    </div>

                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-foreground truncate">
                        {attachment.name || (attachment.type === 'application/pdf' || attachment.type?.includes('pdf')
                          ? 'PDF Document'
                          : `File (${attachment.type || 'Unknown type'})`)}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        Click to download
                      </p>
                    </div>

                    <div className="flex gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={async (e) => {
                          e.stopPropagation();
                          if (!user) return;

                          // Use original filename if available, otherwise create a meaningful filename
                          const fileName = attachment.name || `${post.profile?.username || 'user'}_attachment_${index + 1}.${attachment.type?.includes('pdf') ? 'pdf' : attachment.type?.split('/')[1] || 'unknown'}`;
                          const { downloadUrl } = await import("@/lib/download");
                          await downloadUrl(attachment.url, fileName);
                        }}
                        className="h-8 px-3"
                        disabled={!user}
                        title={user ? "Download file" : "Login to download"}
                      >
                        <Download className="h-3 w-3 mr-1" />
                        Download
                      </Button>
                    </div>
                  </div>
                );
              })}
            </div>
          );
        })()}

            {/* Tags - aligned with post body */}
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

        {/* Actions - aligned with post body */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-1">
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
          </div>

          <div className="flex items-center gap-1">
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

            {(() => {
              if (!post.attachment_url) return null;

              let attachments;
              try {
                const parsed = JSON.parse(post.attachment_url);
                attachments = Array.isArray(parsed) ? parsed : [{url: post.attachment_url, type: post.attachment_type}];
              } catch {
                attachments = [{url: post.attachment_url, type: post.attachment_type}];
              }

              if (attachments.length === 0) return null;

              return (
                <Button
                  variant="ghost"
                  size="sm"
                  disabled={!user}
                  onClick={async () => {
                    if (!user) return;
                    // Download each attachment one by one
                    for (let i = 0; i < attachments.length; i++) {
                      const attachment = attachments[i];
                      try {
                        // Create a meaningful filename
                        const fileExtension = attachment.type?.split('/')[1] || 'unknown';
                        const fileName = `${post.profile?.username || 'user'}_attachment_${i + 1}.${fileExtension}`;

                        // Use the downloadUrl function
                        const { downloadUrl } = await import("@/lib/download");
                        await downloadUrl(attachment.url, fileName);

                        // Add a small delay between downloads to avoid browser blocking
                        if (i < attachments.length - 1) {
                          await new Promise(resolve => setTimeout(resolve, 500));
                        }
                      } catch (error) {
                        // console.error(`Failed to download attachment ${i + 1}:`, error);
                      }
                    }
                  }}
                  className={`flex items-center gap-2 rounded-full p-2 h-auto transition-colors ${
                    user
                      ? 'text-muted-foreground hover:text-purple-500 hover:bg-purple-500/10'
                      : 'text-muted-foreground/50 cursor-not-allowed'
                  }`}
                  title={user ? "Download all attachments" : "Login to download attachments"}
                >
                  <Download className="h-5 w-5" />
                </Button>
              );
            })()}

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

      {/* Comment Form or Login Prompt */}
      {user ? (
        <div className="border border-border rounded-lg p-1.5 mb-3">
          <div className="flex gap-1.5">
            <Avatar className="h-6 w-6 flex-shrink-0 mt-0.5">
              <AvatarImage src={currentUserProfile?.profile_pic || user.user_metadata?.avatar_url} />
              <AvatarFallback className="text-xs">
                {currentUserProfile?.username?.[0]?.toUpperCase() || user.user_metadata?.full_name?.[0]?.toUpperCase() || user.email?.[0]?.toUpperCase() || 'U'}
              </AvatarFallback>
            </Avatar>

            <div className="flex-1">
              <MentionInput
                value={commentText}
                onChange={(value, mentions) => {
                  setCommentText(value);
                  setCommentMentions(mentions);
                }}
                placeholder="Write a comment..."
                className="min-h-[24px] max-h-[96px] resize-none border-none text-xs placeholder:text-muted-foreground focus-visible:ring-0 p-0 mb-0.5 leading-4"
                disabled={submitting}
                allowAIBot={true}
              />

              <div className="flex justify-end">
                <Button
                  onClick={handleSubmitComment}
                  disabled={!commentText.trim() || submitting}
                  className="rounded-full px-2 py-0.5 h-6 text-xs"
                >
                  {submitting ? "Posting..." : "Comment"}
                </Button>
              </div>
            </div>
          </div>
        </div>
      ) : (
        <div className="border border-border rounded-lg p-1.5 mb-3 text-center">
          <p className="text-muted-foreground text-xs mb-1.5">
            Join the conversation! Log in to comment.
          </p>
          <Button onClick={() => navigate('/auth')} className="rounded-full px-2 py-0.5 h-6 text-xs">
            Log In
          </Button>
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
                <Avatar 
                  className="h-10 w-10 flex-shrink-0 cursor-pointer"
                  onClick={() => comment.profile?.username && navigate(`/profile/${comment.profile.username}`)}
                >
                  <AvatarImage src={comment.profile?.profile_pic || undefined} />
                  <AvatarFallback>
                    {comment.profile?.username?.[0]?.toUpperCase() || 'U'}
                  </AvatarFallback>
                </Avatar>

                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between mb-1">
                    <div className="flex items-center gap-2 text-sm">
                      <span 
                        className="font-semibold text-foreground cursor-pointer hover:underline"
                        onClick={() => comment.profile?.username && navigate(`/profile/${comment.profile.username}`)}
                      >
                        {comment.profile?.username || 'Anonymous'}
                      </span>
                      <span className="text-muted-foreground">•</span>
                      <span className="text-muted-foreground">{formatTimeShort(comment.created_at)}</span>
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
                            onClick={() => handleDeleteComment(comment.id)}
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

                  <MentionText 
                    text={comment.body} 
                    className="text-foreground whitespace-pre-wrap mb-2 block" 
                  />

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
                      onClick={() => handleReplyClick(comment.id, comment.profile)}
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
                          <AvatarImage src={currentUserProfile?.profile_pic || user.user_metadata?.avatar_url} />
                          <AvatarFallback>
                            {currentUserProfile?.username?.[0]?.toUpperCase() || user.user_metadata?.full_name?.[0]?.toUpperCase() || user.email?.[0]?.toUpperCase() || 'U'}
                          </AvatarFallback>
                        </Avatar>

                        <div className="flex-1">
                          <MentionInput
                            value={replyText}
                            onChange={(value, mentions) => {
                              setReplyText(value);
                              setReplyMentions(mentions);
                            }}
                            placeholder={`Reply to ${comment.profile?.username || 'Anonymous'}...`}
                            className="min-h-[60px] resize-none border-none text-sm placeholder:text-muted-foreground focus-visible:ring-0 p-0 mb-2"
                            disabled={submitting}
                            allowAIBot={false}
                          />

                          <div className="flex gap-2 justify-end">
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => {
                                setReplyingTo(null);
                                setReplyText("");
                                setReplyMentions([]);
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
                          <Avatar 
                            className="h-8 w-8 flex-shrink-0 cursor-pointer"
                            onClick={() => reply.profile?.username && navigate(`/profile/${reply.profile.username}`)}
                          >
                            <AvatarImage src={reply.profile?.profile_pic || undefined} />
                            <AvatarFallback>
                              {reply.profile?.username?.[0]?.toUpperCase() || 'U'}
                            </AvatarFallback>
                          </Avatar>

                          <div className="flex-1 min-w-0">
                            <div className="flex items-center justify-between mb-1">
                              <div className="flex items-center gap-2 text-sm">
                                <span 
                                  className="font-semibold text-foreground cursor-pointer hover:underline"
                                  onClick={() => reply.profile?.username && navigate(`/profile/${reply.profile.username}`)}
                                >
                                  {reply.profile?.username || 'Anonymous'}
                                </span>
                                <span className="text-muted-foreground">•</span>
                                <span className="text-muted-foreground">{formatTimeShort(reply.created_at)}</span>
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
                                      onClick={() => handleDeleteComment(reply.id)}
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

                            <MentionText 
                              text={reply.body} 
                              className="text-foreground whitespace-pre-wrap text-sm mb-2 block" 
                            />

                            <div className="flex items-center gap-4">
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

                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => handleReplyClick(reply.id, reply.profile, comment)}
                                className="text-muted-foreground hover:text-blue-500 p-1 h-auto flex items-center gap-1"
                              >
                                <Reply className="h-3 w-3" />
                                <span className="text-xs">Reply</span>
                              </Button>
                            </div>

                            {/* Reply Form for child comments */}
                            {replyingTo === reply.id && user && (
                              <div className="mt-3 pl-4 border-l-2 border-border">
                                <div className="flex gap-3">
                                  <Avatar className="h-6 w-6 flex-shrink-0">
                                    <AvatarImage src={currentUserProfile?.profile_pic || user.user_metadata?.avatar_url} />
                                    <AvatarFallback className="text-xs">
                                      {currentUserProfile?.username?.[0]?.toUpperCase() || user.user_metadata?.full_name?.[0]?.toUpperCase() || user.email?.[0]?.toUpperCase() || 'U'}
                                    </AvatarFallback>
                                  </Avatar>

                                  <div className="flex-1">
                                    <MentionInput
                                      value={replyText}
                                      onChange={(value, mentions) => {
                                        setReplyText(value);
                                        setReplyMentions(mentions);
                                      }}
                                      placeholder={`Reply to ${reply.profile?.username || 'Anonymous'}...`}
                                      className="min-h-[60px] resize-none border-none text-sm placeholder:text-muted-foreground focus-visible:ring-0 p-0 mb-2"
                                      disabled={submitting}
                                      allowAIBot={false}
                                    />

                                    <div className="flex gap-2 justify-end">
                                      <Button
                                        variant="ghost"
                                        size="sm"
                                        onClick={() => {
                                          setReplyingTo(null);
                                          setReplyText("");
                                          setReplyMentions([]);
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

      {/* Confirmation Modals */}
      <ConfirmationModal
        open={deletePostModalOpen}
        onOpenChange={setDeletePostModalOpen}
        title="Delete Post"
        description="Are you sure you want to delete this post? This action cannot be undone."
        confirmText="Delete"
        onConfirm={confirmDeletePost}
        variant="destructive"
      />

      <ConfirmationModal
        open={deleteCommentModalOpen}
        onOpenChange={setDeleteCommentModalOpen}
        title="Delete Comment"
        description="Are you sure you want to delete this comment? This action cannot be undone."
        confirmText="Delete"
        onConfirm={confirmDeleteComment}
        variant="destructive"
      />
    </div>
  );
}