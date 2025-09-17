
import { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ArrowLeft, Save, Upload, X } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/contexts/AuthContext";

interface Post {
  id: string;
  body: string;
  attachment_url: string | null;
  attachment_type: string | null;
  school_tag: string | null;
  course_tag: string | null;
  user_id: string;
}

export default function EditPost() {
  const { postId } = useParams();
  const navigate = useNavigate();
  const [post, setPost] = useState<Post | null>(null);
  const [body, setBody] = useState("");
  const [schoolTag, setSchoolTag] = useState("");
  const [courseTag, setCourseTag] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const { toast } = useToast();
  const { user } = useAuth();

  useEffect(() => {
    if (postId) {
      fetchPost();
    }
  }, [postId]);

  const fetchPost = async () => {
    if (!postId) return;

    try {
      const { data: postData, error } = await supabase
        .from('posts')
        .select('*')
        .eq('id', postId)
        .single();

      if (error) throw error;

      if (!postData) {
        navigate('/home');
        return;
      }

      // Check if user owns this post
      if (user && postData.user_id !== user.id) {
        toast({
          title: "Access Denied",
          description: "You can only edit your own posts",
          variant: "destructive",
        });
        navigate('/home');
        return;
      }

      setPost(postData);
      setBody(postData.body);
      setSchoolTag(postData.school_tag || "");
      setCourseTag(postData.course_tag || "");
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

  const handleSave = async () => {
    if (!user || !post || !body.trim()) {
      toast({
        title: "Error",
        description: "Post content cannot be empty",
        variant: "destructive",
      });
      return;
    }

    setSaving(true);
    try {
      const { error } = await supabase
        .from('posts')
        .update({
          body: body.trim(),
          school_tag: schoolTag.trim() || null,
          course_tag: courseTag.trim() || null,
        })
        .eq('id', post.id)
        .eq('user_id', user.id); // Ensure only owner can update

      if (error) throw error;

      toast({
        title: "Success",
        description: "Post updated successfully",
      });
      
      // Navigate back to the post
      navigate(`/post/${post.id}`);
    } catch (error) {
      console.error('Error updating post:', error);
      toast({
        title: "Error",
        description: "Failed to update post. Please try again.",
        variant: "destructive",
      });
    } finally {
      setSaving(false);
    }
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
      <div className="flex items-center justify-between p-4 border-b border-border mb-4">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="sm" onClick={() => navigate(`/post/${post.id}`)}>
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <h1 className="text-lg font-semibold">Edit Post</h1>
        </div>
        
        <Button onClick={handleSave} disabled={saving || !body.trim()}>
          {saving ? "Saving..." : "Save"}
          <Save className="h-4 w-4 ml-2" />
        </Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Edit your post</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Post Content */}
          <div>
            <Textarea
              placeholder="What's on your mind?"
              value={body}
              onChange={(e) => setBody(e.target.value)}
              className="min-h-[120px] text-base"
              disabled={saving}
            />
          </div>

          {/* Existing Attachment Display */}
          {post.attachment_url && (
            <div className="border border-border rounded-lg p-4 bg-muted">
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm font-medium">Current Attachment:</span>
                <span className="text-xs text-muted-foreground">
                  (Attachment editing not available yet)
                </span>
              </div>
              
              {post.attachment_type?.startsWith('image/') ? (
                <img 
                  src={post.attachment_url} 
                  alt="Post attachment" 
                  className="w-full max-h-64 object-cover rounded"
                />
              ) : (
                <div className="flex items-center gap-2 p-2 bg-background rounded">
                  <Upload className="h-4 w-4" />
                  <span className="text-sm">
                    {post.attachment_type || 'Unknown file type'}
                  </span>
                </div>
              )}
            </div>
          )}

          {/* Tags */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="text-sm font-medium mb-2 block">School Tag</label>
              <Input
                placeholder="e.g., University of Lagos"
                value={schoolTag}
                onChange={(e) => setSchoolTag(e.target.value)}
                disabled={saving}
              />
            </div>
            
            <div>
              <label className="text-sm font-medium mb-2 block">Course Tag</label>
              <Input
                placeholder="e.g., Computer Science"
                value={courseTag}
                onChange={(e) => setCourseTag(e.target.value)}
                disabled={saving}
              />
            </div>
          </div>

          {/* Tag Preview */}
          {(schoolTag || courseTag) && (
            <div className="flex gap-2 flex-wrap">
              {schoolTag && (
                <Badge variant="secondary" className="text-xs">
                  {schoolTag}
                </Badge>
              )}
              {courseTag && (
                <Badge variant="outline" className="text-xs">
                  {courseTag}
                </Badge>
              )}
            </div>
          )}

          {/* Action Buttons */}
          <div className="flex gap-2 pt-4">
            <Button
              variant="outline"
              onClick={() => navigate(`/post/${post.id}`)}
              disabled={saving}
              className="flex-1"
            >
              <X className="h-4 w-4 mr-2" />
              Cancel
            </Button>
            
            <Button
              onClick={handleSave}
              disabled={saving || !body.trim()}
              className="flex-1"
            >
              {saving ? "Saving..." : "Save Changes"}
              <Save className="h-4 w-4 ml-2" />
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
