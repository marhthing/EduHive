import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { formatDistanceToNow } from "date-fns";
import { Heart, MessageCircle, Bookmark, Share, MoreHorizontal, Edit, Trash2, Flag, FileText, ExternalLink } from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

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
  const navigate = useNavigate();

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

  const renderAttachment = () => {
    if (!post.attachment_url) return null;

    if (post.attachment_type?.startsWith('image/')) {
      return (
        <div className="mt-3 rounded-2xl overflow-hidden border border-border">
          {!imageError ? (
            <img
              src={post.attachment_url}
              alt="Post attachment"
              className="w-full max-h-96 object-cover cursor-pointer hover:opacity-90 transition-opacity"
              onError={() => setImageError(true)}
              onClick={(e) => {
                e.stopPropagation();
                window.open(post.attachment_url!, '_blank');
              }}
              loading="lazy"
            />
          ) : (
            <div className="w-full h-48 bg-muted flex flex-col items-center justify-center rounded-lg">
              <FileText className="w-8 h-8 text-muted-foreground mb-2" />
              <p className="text-muted-foreground text-center text-sm">
                Failed to load image
                <br />
                <Button
                  variant="link"
                  size="sm"
                  onClick={(e) => {
                    e.stopPropagation();
                    window.open(post.attachment_url!, '_blank');
                  }}
                  className="p-0 h-auto text-xs"
                >
                  Try opening in new tab
                </Button>
              </p>
            </div>
          )}
        </div>
      );
    }

    if (post.attachment_type === 'application/pdf' || post.attachment_type?.includes('pdf')) {
      return (
        <div className="mt-3 rounded-2xl overflow-hidden border border-border">
          <div className="p-4 bg-muted">
            <div className="flex gap-2 items-center">
              <Button
                variant="outline"
                size="sm"
                onClick={(e) => {
                  e.stopPropagation();
                  window.open(post.attachment_url!, '_blank');
                }}
                className="flex-1 justify-start"
              >
                📄 View PDF Document
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={(e) => {
                  e.stopPropagation();
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
        </div>
      );
    }

    return (
      <div className="mt-3 rounded-2xl overflow-hidden border border-border">
        <div className="p-4 bg-muted">
          <div className="flex gap-2 items-center">
            <Button
              variant="outline"
              size="sm"
              onClick={(e) => {
                e.stopPropagation();
                window.open(post.attachment_url!, '_blank');
              }}
              className="flex-1 justify-start"
            >
              📎 View File ({post.attachment_type || 'Unknown type'})
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={(e) => {
                e.stopPropagation();
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
      </div>
    );
  };

  return (
    <div
      className={`p-4 hover:bg-muted/20 transition-colors cursor-pointer border border-border rounded-lg ${className}`}
      onClick={() => navigate(`/post/${post.id}`)}
    >
      <div className="flex gap-3">
        <Avatar
          className="h-12 w-12 flex-shrink-0 cursor-pointer hover:opacity-80 transition-opacity"
          onClick={handleProfileClick}
        >
          <AvatarImage src={post.profile?.profile_pic || undefined} />
          <AvatarFallback>
            {post.profile?.username?.[0]?.toUpperCase() || 'U'}
          </AvatarFallback>
        </Avatar>

        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between mb-2">
            <div className="flex flex-col">
              <div className="flex items-center gap-2 text-sm">
                <span
                  className="font-semibold text-foreground cursor-pointer hover:underline"
                  onClick={handleProfileClick}
                >
                  {post.profile?.name || post.profile?.username || 'Anonymous'}
                </span>
                <span className="text-muted-foreground">•</span>
                <span
                  className="text-muted-foreground cursor-pointer hover:underline"
                  onClick={handleProfileClick}
                >
                  @{post.profile?.username || 'anonymous'}
                </span>
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
                  <DropdownMenuItem onClick={(e) => e.stopPropagation()}>
                    <Flag className="h-4 w-4 mr-2" />
                    Report post
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            )}
          </div>

          <p
            className="text-foreground whitespace-pre-wrap mb-3 cursor-pointer"
            onClick={handlePostBodyClick}
          >
            {post.body}
          </p>

          {renderAttachment()}

          {(post.school_tag || post.course_tag) && (
            <div className="flex gap-2 mt-3">
              {post.school_tag && (
                <Badge variant="secondary" className="text-xs">{post.school_tag}</Badge>
              )}
              {post.course_tag && (
                <Badge variant="outline" className="text-xs">{post.course_tag}</Badge>
              )}
            </div>
          )}

          <div className="flex items-center justify-between mt-3 max-w-md">
            <Button
              variant="ghost"
              size="sm"
              onClick={(e) => {
                e.stopPropagation();
                onLike(post.id);
              }}
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
              onClick={(e) => {
                e.stopPropagation();
                onComment(post.id);
              }}
            >
              <MessageCircle className="h-5 w-5" />
              <span className="text-sm">{post.comments_count}</span>
            </Button>

            <Button
              variant="ghost"
              size="sm"
              onClick={(e) => {
                e.stopPropagation();
                onBookmark(post.id);
              }}
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
              onClick={(e) => {
                e.stopPropagation();
                onShare(post);
              }}
            >
              <Share className="h-5 w-5" />
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}