import { useState } from "react";
import { formatTimeShort } from "@/lib/timeFormat";
import { Heart, MessageCircle, Bookmark, Share2, X, Download, FileText, ExternalLink, Share } from "lucide-react";
import { downloadUrl } from "@/lib/download";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogTrigger } from "@/components/ui/dialog";
import { Carousel, CarouselContent, CarouselItem, CarouselNext, CarouselPrevious } from "@/components/ui/carousel";

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
    name: string | null;
    profile_pic: string | null;
    school: string | null;
    department: string | null;
  } | null;
  likes_count: number;
  comments_count: number;
  is_liked: boolean;
  is_bookmarked: boolean;
}

interface PostCardProps {
  post: Post;
  onLike: () => void;
  onBookmark: () => void;
  onComment: () => void;
  initialImageIndex?: number; // Add this prop
}

export function PostCard({ post, onLike, onBookmark, onComment, initialImageIndex = 0 }: PostCardProps) {
  const [imageError, setImageError] = useState(false);
  const [carouselOpen, setCarouselOpen] = useState(false);
  const [carouselStartIndex, setCarouselStartIndex] = useState(initialImageIndex); // State for the starting index
  const [isReportDialogOpen, setIsReportDialogOpen] = useState(false); // State for the report dialog

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

    // Check if all attachments are images
    const allImages = attachments.every(att => att.type?.startsWith('image/'));

    // If all are images, use grid layout
    if (allImages) {
      return (
        <div className="mt-3 space-y-2">
          {attachments.length === 1 ? (
            // Single image - full width
            <div className="rounded-lg overflow-hidden border border-border">
              {renderSingleAttachment(attachments[0], 0, attachments, () => {
                setCarouselStartIndex(0);
                setCarouselOpen(true);
              })}
            </div>
          ) : (
            // Multiple images - grid layout
            <div className={`grid gap-2 ${
              attachments.length === 2 ? 'grid-cols-2' :
              attachments.length === 3 ? 'grid-cols-2' :
              'grid-cols-2'
            }`}>
              {attachments.slice(0, 4).map((attachment, index) => (
                <div key={index} className="relative rounded-lg overflow-hidden border border-border">
                  {index === 3 && attachments.length > 4 ? (
                    <div className="relative cursor-pointer" onClick={onComment}>
                      {renderSingleAttachment(attachment, index)}
                      <div className="absolute inset-0 bg-black/60 flex items-center justify-center hover:bg-black/70 transition-colors">
                        <span className="text-white text-sm font-semibold">
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
                    </Dialog>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      );
    }

    // For documents/mixed content, separate images and documents - show each in their own container
    const imageAttachments = attachments.filter(att => att.type?.startsWith('image/'));
    const documentAttachments = attachments.filter(att => !att.type?.startsWith('image/'));

    return (
      <div className="mt-3 space-y-2">
        {/* Render images first if any */}
        {imageAttachments.map((attachment, index) => (
          <div key={`image-${index}`} className="rounded-lg overflow-hidden border border-border">
            <img
              src={attachment.url}
              alt={`Attachment ${index + 1}`}
              className="w-full h-full max-h-64 object-cover cursor-pointer hover:opacity-90 transition-opacity"
              onClick={onComment}
              loading="lazy"
            />
          </div>
        ))}

        {/* Render documents in list format - each file gets its own full-width row */}
        {documentAttachments.map((attachment, index) => (
          <div key={`doc-${index}`} className="flex items-center gap-3 p-3 bg-muted rounded-lg border border-border">
            <div className="flex-shrink-0">
              {attachment.type === 'application/pdf' || attachment.type?.includes('pdf') ? (
                <FileText className="h-8 w-8 text-red-500" />
              ) : (
                <FileText className="h-8 w-8 text-muted-foreground" />
              )}
            </div>

            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-foreground truncate">
                {attachment.type === 'application/pdf' || attachment.type?.includes('pdf')
                  ? 'PDF Document'
                  : `File (${attachment.type || 'Unknown type'})`}
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

                  // Use original filename if available, otherwise create a meaningful filename
                  const fileName = attachment.name || `${post.profile?.username || 'user'}_attachment_${index + 1}.${attachment.type?.includes('pdf') ? 'pdf' : attachment.type?.split('/')[1] || 'unknown'}`;
                  await downloadUrl(attachment.url, fileName);
                }}
                className="h-8 px-3"
                title="Download file"
              >
                <Download className="h-3 w-3 mr-1" />
                Download
              </Button>
            </div>
          </div>
        ))}
      </div>
    );
  };

  const renderSingleAttachment = (attachment: {url: string, type?: string}, index: number, attachments?: any[], openCarousel?: () => void) => {
    if (attachment.type?.startsWith('image/')) {
      return (
        <img
          src={attachment.url}
          alt={`Attachment ${index + 1}`}
          className="w-full h-full max-h-64 object-cover cursor-pointer hover:opacity-90 transition-opacity"
          onError={(e) => {
            const target = e.target as HTMLImageElement;
            target.style.display = 'none';
            const parent = target.parentElement;
            if (parent) {
              parent.innerHTML = `
                <div class="w-full h-32 bg-muted flex flex-col items-center justify-center">
                  <svg class="w-6 h-6 text-muted-foreground mb-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"></path>
                  </svg>
                  <p class="text-muted-foreground text-center text-xs">Failed to load</p>
                </div>
              `;
            }
          }}
          onClick={() => {
            if (attachments && attachments.length > 1 && openCarousel) {
              openCarousel();
            } else {
              onComment(); // Navigate to post details
            }
          }}
          loading="lazy"
        />
      );
    }

    // For non-images in grid context, show a placeholder (this shouldn't happen with new logic)
    return (
      <div className="p-4 bg-muted h-32 flex items-center justify-center">
        <FileText className="h-8 w-8 text-muted-foreground" />
      </div>
    );
  };

  return (
    <Card className="w-full">
      <CardContent className="p-4">
        {/* Header */}
        <div className="flex items-start gap-3 mb-3">
          <Avatar className="w-10 h-10">
            <AvatarImage src={post.profile?.profile_pic || ""} />
            <AvatarFallback>
              {post.profile?.username?.charAt(0).toUpperCase() || "U"}
            </AvatarFallback>
          </Avatar>

          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap mb-0">
              <span className="font-semibold text-sm">
                {post.profile?.name || post.profile?.username || "Unknown User"}
              </span>
              <span className="text-xs text-muted-foreground">
                @{post.profile?.username || "unknown"}
              </span>
              <span className="text-xs text-muted-foreground">
                • {formatTimeShort(post.created_at)}
              </span>
            </div>
            {(post.profile?.school || post.profile?.department) && (
              <div className="text-xs text-muted-foreground" style={{ marginTop: '-10px !important' }}>
                {post.profile?.school && post.profile.school}
                {post.profile?.school && post.profile?.department && ' • '}
                {post.profile?.department && post.profile.department}
              </div>
            )}
          </div>
        </div>

        {/* Content */}
        <div className="mb-3">
        </div>

        {/* Post Body - properly aligned */}
        <div className="ml-[52px]">
          <p className="text-foreground whitespace-pre-wrap mb-3 text-lg">{post.body}</p>
        </div>
        {renderAttachments()}


        {/* Tags and Actions */}
        {(post.school_tag || post.course_tag) && (
          <div className="flex gap-2 mb-3">
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
        <div className="flex items-center justify-between pt-2 border-t">
          <div className="flex items-center gap-1">
            <Button
              variant="ghost"
              size="sm"
              onClick={onLike}
              className={post.is_liked ? "text-red-500 hover:text-red-600" : ""}
            >
              <Heart className={`w-4 h-4 mr-1 ${post.is_liked ? "fill-current" : ""}`} />
              {post.likes_count}
            </Button>

            <Button variant="ghost" size="sm" onClick={onComment}>
              <MessageCircle className="w-4 h-4 mr-1" />
              {post.comments_count}
            </Button>
          </div>

          <div className="flex items-center gap-1">
            <Button
              variant="ghost"
              size="sm"
              onClick={onBookmark}
              className={post.is_bookmarked ? "text-blue-500 hover:text-blue-600" : ""}
            >
              <Bookmark className={`w-4 h-4 ${post.is_bookmarked ? "fill-current" : ""}`} />
            </Button>

            {parseAttachments().length > 0 && (
              <Button
                variant="ghost"
                size="sm"
                onClick={handleDownloadAll}
                className="text-muted-foreground hover:text-purple-500"
                title="Download all media"
              >
                <Download className="w-4 h-4" />
              </Button>
            )}

            <Button variant="ghost" size="sm" onClick={handleShare}>
              <Share2 className="w-4 h-4" />
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}