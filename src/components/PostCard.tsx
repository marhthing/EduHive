import { useState } from "react";
import { formatDistanceToNow } from "date-fns";
import { Heart, MessageCircle, Bookmark, Share2, FileText, ExternalLink, X } from "lucide-react";
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

  const handleShare = async () => {
    if (navigator.share) {
      try {
        await navigator.share({
          title: `Post by ${post.profile?.username}`,
          text: post.body.substring(0, 100) + (post.body.length > 100 ? "..." : ""),
          url: window.location.href,
        });
      } catch (error) {
        // User cancelled or error occurred
        console.log("Share cancelled");
      }
    } else {
      // Fallback: copy to clipboard
      navigator.clipboard.writeText(window.location.href);
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
      <div className="mt-3 space-y-2">
        {attachments.length === 1 ? (
          // Single attachment - full width
          <div className="rounded-lg overflow-hidden border border-border">
            {renderSingleAttachment(attachments[0], 0, attachments, () => {
              setCarouselStartIndex(0); // Ensure it starts at 0 for single image
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
                  <Dialog open={carouselOpen} onOpenChange={setCarouselOpen}>
                    <DialogTrigger asChild>
                      <div className="relative cursor-pointer">
                        {renderSingleAttachment(attachment, index)}
                        <div className="absolute inset-0 bg-black/60 flex items-center justify-center hover:bg-black/70 transition-colors">
                          <span className="text-white text-sm font-semibold">
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
                ) : (
                  <Dialog open={carouselOpen} onOpenChange={setCarouselOpen}>
                    <DialogTrigger asChild>
                      <div className="cursor-pointer">
                        {renderSingleAttachment(attachment, index, attachments, () => {
                          setCarouselStartIndex(index); // Set the start index to the clicked image
                          setCarouselOpen(true);
                        })}
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
              window.open(attachment.url, '_blank');
            }
          }}
          loading="lazy"
        />
      );
    }

    if (attachment.type === 'application/pdf' || attachment.type?.includes('pdf')) {
      return (
        <div className="p-3 bg-muted h-24 flex items-center">
          <div className="flex gap-2 items-center w-full">
            <Button
              variant="outline"
              size="sm"
              onClick={() => window.open(attachment.url, '_blank')}
              className="flex-1 justify-start text-xs"
            >
              <FileText className="w-3 h-3 mr-1" />
              PDF
              <ExternalLink className="w-3 h-3 ml-auto" />
            </Button>
          </div>
        </div>
      );
    }

    return (
      <div className="p-3 bg-muted h-24 flex items-center">
        <div className="flex gap-2 items-center w-full">
          <Button
            variant="outline"
            size="sm"
            onClick={() => window.open(attachment.url, '_blank')}
            className="flex-1 justify-start text-xs"
          >
            <FileText className="w-3 h-3 mr-1" />
            File
            <ExternalLink className="w-3 h-3 ml-auto" />
          </Button>
        </div>
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
            <div className="flex items-center gap-2 flex-wrap">
              <span className="font-semibold text-sm">
                {post.profile?.name || post.profile?.username || "Unknown User"}
              </span>
              <span className="text-xs text-muted-foreground">
                @{post.profile?.username || "unknown"}
              </span>
              {post.profile?.school && (
                <span className="text-xs text-muted-foreground">
                  • {post.profile.school}
                </span>
              )}
              {post.profile?.department && (
                <span className="text-xs text-muted-foreground">
                  • {post.profile.department}
                </span>
              )}
            </div>
            <div className="text-xs text-muted-foreground">
              {formatDistanceToNow(new Date(post.created_at), { addSuffix: true })}
            </div>
          </div>
        </div>

        {/* Content */}
        <div className="mb-3">
          <p className="text-sm leading-relaxed whitespace-pre-wrap">{post.body}</p>
          {renderAttachments()}
        </div>

        {/* Tags */}
        {(post.school_tag || post.course_tag) && (
          <div className="flex gap-2 mb-3 flex-wrap">
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

            <Button variant="ghost" size="sm" onClick={handleShare}>
              <Share2 className="w-4 h-4" />
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}