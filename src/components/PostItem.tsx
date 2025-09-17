import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { formatTimeShort } from "@/lib/timeFormat";
import { Heart, MessageCircle, Bookmark, Share, MoreHorizontal, Edit, Trash2, Flag, FileText, ExternalLink, X, Download } from "lucide-react";
import { downloadUrl } from "@/lib/download";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogTrigger } from "@/components/ui/dialog";
import { Carousel, CarouselContent, CarouselItem, CarouselNext, CarouselPrevious } from "@/components/ui/carousel";
import { ReportDialog } from "@/components/ReportDialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { supabase } from "@/integrations/supabase/client";

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

interface PostItemProps {
  post: Post;
  currentUserId?: string;
  onLike: (postId: string) => void;
  onBookmark: (postId: string) => void;
  onComment: (postId: string) => void;
  onShare: (post: Post) => void;
  onEdit?: (postId: string) => void;
  onDelete?: (postId: string) => void;
  showDropdown?: boolean;
  className?: string;
}

export function PostItem({
  post,
  currentUserId,
  onLike,
  onBookmark,
  onComment,
  onShare,
  onEdit,
  onDelete,
  showDropdown = true,
  className = ""
}: PostItemProps) {
  const [imageError, setImageError] = useState(false);
  const [carouselOpen, setCarouselOpen] = useState(false);
  const [carouselStartIndex, setCarouselStartIndex] = useState(0);
  const [reportDialogOpen, setReportDialogOpen] = useState(false);
  const navigate = useNavigate();
  // Use currentUserId prop for user authentication check

  const handleProfileClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (post.profile?.username) {
      navigate(`/profile/${post.profile.username}`);
    }
  };

  const handlePostBodyClick = () => {
    onComment(post.id);
  };

  const isOwnPost = currentUserId === post.user_id;

  const handleDownloadAll = async () => {
    const attachments = parseAttachments();
    if (attachments.length === 0) return;

    // Download each attachment one by one
    for (let i = 0; i < attachments.length; i++) {
      const attachment = attachments[i];
      try {
        // Create a meaningful filename
        const fileExtension = attachment.type?.split('/')[1] || 'unknown';
        const fileName = `${post.profile?.username || 'user'}_attachment_${i + 1}.${fileExtension}`;

        await downloadUrl(attachment.url, fileName);

        // Add a small delay between downloads to avoid browser blocking
        if (i < attachments.length - 1) {
          await new Promise(resolve => setTimeout(resolve, 500));
        }
      } catch (error) {
        console.error(`Failed to download attachment ${i + 1}:`, error);
      }
    }
  };

  const parseAttachments = () => {
    if (!post.attachment_url) return [];

    // Check if it's a JSON array of attachments
    try {
      const parsed = JSON.parse(post.attachment_url);
      if (Array.isArray(parsed)) {
        return parsed;
      }
    } catch {
      // Not JSON, treat as single attachment
    }

    // Single attachment
    return [{
      url: post.attachment_url,
      type: post.attachment_type
    }];
  };

  const renderAttachments = () => {
    const attachments = parseAttachments();
    if (attachments.length === 0) return null;

    return (
      <div className="mt-3 space-y-2" style={{ marginBottom: '0.75rem !important' }}>
        {attachments.length === 1 ? (
          // Single attachment - full width
          <div className="rounded-2xl overflow-hidden border border-border">
            {renderSingleAttachment(attachments[0], 0, attachments, () => {
              setCarouselStartIndex(0);
              setCarouselOpen(true);
            })}
          </div>
        ) : (
          // Multiple attachments - grid layout
          <div className={`grid gap-2 ${
            attachments.length === 2 ? 'grid-cols-2' :
            attachments.length === 3 ? 'grid-cols-2' :
            'grid-cols-2'
          }`}>
            {attachments.slice(0, 4).map((attachment, index) => (
              <div key={index} className="relative rounded-lg overflow-hidden border border-border">
                {index === 3 && attachments.length > 4 ? (
                  <div className="relative cursor-pointer" onClick={(e) => {
                    e.stopPropagation();
                    navigate(`/post/${post.id}`);
                  }}>
                    {renderSingleAttachment(attachment, index)}
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
                        {renderSingleAttachment(attachment, index)}
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
                                          onClick={async () => {
                                            const fileName = `${post.profile?.username || 'user'}_document_${idx + 1}.pdf`;
                                            await downloadUrl(attachment.url, fileName);
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
                                          onClick={async () => {
                                            const fileExtension = attachment.type?.split('/')[1] || 'unknown';
                                            const fileName = `${post.profile?.username || 'user'}_attachment_${idx + 1}.${fileExtension}`;
                                            await downloadUrl(attachment.url, fileName);
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
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    );
  };

  const renderSingleAttachment = (attachment: {url: string, type?: string}, index: number, attachments?: any[], openCarousel?: () => void) => {
    if (attachment.type?.startsWith('image/')) {
      return (
        <img
          src={attachment.url}
          alt={`Attachment ${index + 1}`}
          className="w-full h-full max-h-96 object-cover cursor-pointer hover:opacity-90 transition-opacity"
          onError={(e) => {
            const target = e.target as HTMLImageElement;
            target.style.display = 'none';
            const parent = target.parentElement;
            if (parent) {
              parent.innerHTML = `
                <div class="w-full h-48 bg-muted flex flex-col items-center justify-center">
                  <svg class="w-8 h-8 text-muted-foreground mb-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.707.707V19a2 2 0 01-2 2z"></path>
                  </svg>
                  <p class="text-muted-foreground text-center text-sm">Failed to load image</p>
                </div>
              `;
            }
          }}
          onClick={(e) => {
            e.stopPropagation();
            if (currentUserId && attachments && attachments.length > 1 && openCarousel) {
              openCarousel();
            } else {
              navigate(`/post/${post.id}`);
            }
          }}
          loading="lazy"
        />
      );
    }

    if (attachment.type === 'application/pdf' || attachment.type?.includes('pdf')) {
      return (
        <div className="p-4 bg-muted h-32 flex items-center">
          <div className="flex gap-2 items-center w-full">
            <Button
              variant="outline"
              size="sm"
              onClick={(e) => {
                e.stopPropagation();
                navigate(`/post/${post.id}`);
              }}
              className="flex-1 justify-start"
            >
              📄 PDF Document
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={async (e) => {
                e.stopPropagation();
                const fileName = `${post.profile?.username || 'user'}_document.pdf`;
                await downloadUrl(attachment.url, fileName);
              }}
              className="px-3"
              title="Download PDF"
              disabled={!currentUserId}
            >
              ⬇️
            </Button>
          </div>
        </div>
      );
    }

    return (
      <div className="p-4 bg-muted h-32 flex items-center">
        <div className="flex gap-2 items-center w-full">
          <Button
            variant="outline"
            size="sm"
            onClick={(e) => {
              e.stopPropagation();
              navigate(`/post/${post.id}`);
            }}
            className="flex-1 justify-start"
          >
            📎 File ({attachment.type || 'Unknown'})
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={async (e) => {
              e.stopPropagation();
              const fileExtension = attachment.type?.split('/')[1] || 'unknown';
              const fileName = `${post.profile?.username || 'user'}_file.${fileExtension}`;
              await downloadUrl(attachment.url, fileName);
            }}
            className="px-3"
            title="Download File"
            disabled={!currentUserId}
          >
            ⬇️
          </Button>
        </div>
      </div>
    );
  };

  const handleShare = async () => {
    const postUrl = `${window.location.origin}/post/${post.id}`;

    if (navigator.share) {
      try {
        await navigator.share({
          title: `Post by ${post.profile?.username}`,
          text: post.body.substring(0, 100) + (post.body.length > 100 ? "..." : ""),
          url: postUrl,
        });
      } catch (error) {
        // User cancelled or error occurred
        console.log("Share cancelled");
      }
    } else {
      // Fallback: copy to clipboard
      navigator.clipboard.writeText(postUrl);
    }
  };

  const handleBookmark = async () => {
    if (!currentUserId) {
      console.error('User not authenticated');
      return;
    }

    try {
      console.log('Toggling bookmark for post:', post.id, 'Current state:', post.is_bookmarked);

      if (post.is_bookmarked) {
        const { error } = await supabase
          .from('bookmarks')
          .delete()
          .eq('post_id', post.id)
          .eq('user_id', currentUserId);

        if (error) {
          console.error('Error removing bookmark:', error);
          throw error;
        }

        console.log('Bookmark removed successfully');
      } else {
        const { error } = await supabase
          .from('bookmarks')
          .insert({ post_id: post.id, user_id: currentUserId });

        if (error) {
          console.error('Error adding bookmark:', error);
          throw error;
        }

        console.log('Bookmark added successfully');
      }

      onBookmark(post.id);
    } catch (error) {
      console.error('Error toggling bookmark:', error);
      // You might want to show a toast notification here
    }
  };

  return (
    <div
      className={`p-3 md:p-4 hover:bg-muted/20 transition-colors cursor-pointer border border-border rounded-lg ${className}`}
      onClick={() => navigate(`/post/${post.id}`)}
    >
      <div className="flex gap-2 md:gap-3">
        <Avatar
          className="h-8 w-8 md:h-10 md:w-10 flex-shrink-0 cursor-pointer hover:opacity-80 transition-opacity"
          onClick={handleProfileClick}
        >
          <AvatarImage src={post.profile?.profile_pic || undefined} />
          <AvatarFallback className="text-xs md:text-sm">
            {post.profile?.username?.[0]?.toUpperCase() || 'U'}
          </AvatarFallback>
        </Avatar>

        <div className="flex-1 min-w-0">
          <div className="flex items-start justify-between mb-1">
            <div className="flex items-center gap-1 md:gap-2 cursor-pointer min-w-0 flex-1" onClick={handleProfileClick}>
              <span className="font-semibold hover:underline text-sm md:text-base truncate">
                {post.profile?.name || post.profile?.username || 'Anonymous'}
              </span>
              <span className="text-muted-foreground text-xs md:text-sm truncate">
                @{post.profile?.username || 'anonymous'}
              </span>
              <span className="text-muted-foreground text-xs md:text-sm flex-shrink-0">
                {formatTimeShort(post.created_at)}
              </span>
            </div>

            {showDropdown && (
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
                  {isOwnPost && onEdit && onDelete && (
                    <>
                      <DropdownMenuItem
                        onClick={(e) => {
                          e.stopPropagation();
                          onEdit(post.id);
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
                            onDelete(post.id);
                          }
                        }}
                      >
                        <Trash2 className="h-4 w-4 mr-2" />
                        Delete post
                      </DropdownMenuItem>
                      <DropdownMenuSeparator />
                    </>
                  )}
                  <DropdownMenuItem
                    onClick={(e) => {
                      e.stopPropagation();
                      setReportDialogOpen(true);
                    }}
                  >
                    <Flag className="h-4 w-4 mr-2" />
                    Report post
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            )}
          </div>

          {/* School and Department */}
          {(post.profile?.school || post.profile?.department) && (
            <div className="flex items-center gap-1 text-xs text-muted-foreground mb-1.5 md:mb-2 flex-wrap">
              {post.profile?.school && (
                <span className="max-w-[200px] truncate">{post.profile.school}</span>
              )}
              {post.profile?.school && post.profile?.department && (
                <span className="text-muted-foreground">•</span>
              )}
              {post.profile?.department && (
                <span className="max-w-[200px] truncate">{post.profile.department}</span>
              )}
            </div>
          )}


          {/* Post Body */}
          <p className="text-foreground mb-2 md:mb-3 leading-relaxed text-sm md:text-base break-words">
            {post.body}
          </p>

          {/* Attachments */}
          {renderAttachments()}

          {/* Tags */}
          {(post.school_tag || post.course_tag) && (
            <div className="flex gap-2 mb-3 mt-3 flex-wrap">
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


          {/* Actions */}
          <div className="flex items-center justify-between text-muted-foreground -ml-2 md:-ml-0">
            <Button
              variant="ghost"
              size="sm"
              onClick={(e) => {
                e.stopPropagation();
                onComment(post.id);
              }}
              className="flex items-center gap-1 md:gap-2 text-comment hover:text-comment hover:bg-comment/10 rounded-full p-1.5 md:p-2 transition-colors"
            >
              <MessageCircle className="h-3.5 w-3.5 md:h-4 md:w-4" />
              <span className="text-xs md:text-sm">{post.comments_count}</span>
            </Button>

            <Button
              variant="ghost"
              size="sm"
              onClick={(e) => {
                e.stopPropagation();
                onLike(post.id);
              }}
              className={`flex items-center gap-1 md:gap-2 rounded-full p-1.5 md:p-2 transition-colors ${
                post.is_liked
                  ? "text-like hover:text-like hover:bg-like/10"
                  : "text-muted-foreground hover:text-like hover:bg-like/10"
              }`}
            >
              <Heart className={`h-3.5 w-3.5 md:h-4 md:w-4 ${post.is_liked ? "fill-current" : ""}`} />
              <span className="text-xs md:text-sm">{post.likes_count}</span>
            </Button>

            <Button
              variant="ghost"
              size="sm"
              onClick={(e) => {
                e.stopPropagation();
                onShare(post);
              }}
              className="flex items-center gap-1 md:gap-2 text-muted-foreground hover:text-primary hover:bg-primary/10 rounded-full p-1.5 md:p-2 transition-colors"
            >
              <Share className="h-3.5 w-3.5 md:h-4 md:w-4" />
            </Button>

            <Button
              variant="ghost"
              size="sm"
              onClick={(e) => {
                e.stopPropagation();
                handleBookmark();
              }}
              className={`flex items-center gap-1 md:gap-2 rounded-full p-1.5 md:p-2 transition-colors ${
                post.is_bookmarked
                  ? "text-bookmark hover:text-bookmark hover:bg-bookmark/10"
                  : "text-muted-foreground hover:text-bookmark hover:bg-bookmark/10"
              }`}
            >
              <Bookmark className={`h-3.5 w-3.5 md:h-4 md:w-4 ${post.is_bookmarked ? "fill-current" : ""}`} />
            </Button>

            {parseAttachments().length > 0 && (
              <Button
                variant="ghost"
                size="sm"
                onClick={(e) => {
                  e.stopPropagation();
                  handleDownloadAll();
                }}
                className="flex items-center gap-1 md:gap-2 text-muted-foreground hover:text-purple-500 hover:bg-purple-500/10 rounded-full p-1.5 md:p-2 transition-colors"
                disabled={!currentUserId}
              >
                <Download className="h-3.5 w-3.5 md:h-4 md:w-4" />
              </Button>
            )}
          </div>
        </div>
      </div>

      {/* Report Dialog */}
      <ReportDialog
        open={reportDialogOpen}
        onOpenChange={setReportDialogOpen}
        postId={post.id}
        reportedUserId={post.user_id}
        type="post"
      />
    </div>
  );
}