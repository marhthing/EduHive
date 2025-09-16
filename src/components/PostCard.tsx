import { useState } from "react";
import { formatDistanceToNow } from "date-fns";
import { Heart, MessageCircle, Bookmark, Share2, FileText, ExternalLink } from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

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

interface PostCardProps {
  post: Post;
  onLike: () => void;
  onBookmark: () => void;
  onComment: () => void;
}

export function PostCard({ post, onLike, onBookmark, onComment }: PostCardProps) {
  const [imageError, setImageError] = useState(false);

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

  const renderAttachment = () => {
    if (!post.attachment_url) return null;

    if (post.attachment_type?.startsWith('image/')) {
      return (
        <div className="mt-3 rounded-lg overflow-hidden">
          {!imageError ? (
            <img
              src={post.attachment_url}
              alt="Post attachment"
              className="w-full max-h-96 object-cover cursor-pointer hover:opacity-90 transition-opacity"
              onError={() => setImageError(true)}
              onClick={() => window.open(post.attachment_url!, '_blank')}
            />
          ) : (
            <div className="w-full h-48 bg-muted flex items-center justify-center rounded-lg">
              <p className="text-muted-foreground">Failed to load image</p>
            </div>
          )}
        </div>
      );
    }

    if (post.attachment_type === 'application/pdf') {
      return (
        <div className="mt-3">
          <Button
            variant="outline"
            onClick={() => window.open(post.attachment_url!, '_blank')}
            className="w-full justify-start"
          >
            <FileText className="w-4 h-4 mr-2" />
            View PDF Document
            <ExternalLink className="w-4 h-4 ml-auto" />
          </Button>
        </div>
      );
    }

    return null;
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
                {post.profile?.username || "Unknown User"}
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
          {renderAttachment()}
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