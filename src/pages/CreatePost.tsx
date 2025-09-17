import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Upload, X, FileText, Image } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { supabase } from "@/integrations/supabase/client";
import { useTwitterToast } from "@/components/ui/twitter-toast";

export default function CreatePost() {
  const navigate = useNavigate();
  const { showToast } = useTwitterToast();
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({
    body: "",
    school_tag: "",
    course_tag: "",
  });
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0];
    if (!selectedFile) return;

    // Check file size (max 10MB)
    if (selectedFile.size > 10 * 1024 * 1024) {
      showToast("Please select a file smaller than 10MB", "error");
      return;
    }

    // Check file type
    const allowedTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/gif', 'application/pdf'];
    if (!allowedTypes.includes(selectedFile.type)) {
      showToast("Please select an image (JPEG, PNG, GIF) or PDF file", "error");
      return;
    }

    setFile(selectedFile);

    // Create preview for images
    if (selectedFile.type.startsWith('image/')) {
      const reader = new FileReader();
      reader.onload = () => setPreview(reader.result as string);
      reader.readAsDataURL(selectedFile);
    } else {
      setPreview(null);
    }
  };

  const removeFile = () => {
    setFile(null);
    setPreview(null);
  };

  const uploadFile = async (file: File) => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error("User not authenticated");

    const fileExt = file.name.split('.').pop();
    const fileName = `${Date.now()}.${fileExt}`;
    const filePath = `${user.id}/${fileName}`;

    const { error: uploadError } = await supabase.storage
      .from('attachments')
      .upload(filePath, file);

    if (uploadError) throw uploadError;

    const { data: { publicUrl } } = supabase.storage
      .from('attachments')
      .getPublicUrl(filePath);

    return { url: publicUrl, type: file.type };
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!formData.body.trim()) {
      showToast("Please write something in your post", "error");
      return;
    }

    setLoading(true);

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        throw new Error("You must be logged in to create a post");
      }

      let attachment_url = null;
      let attachment_type = null;

      if (file) {
        const result = await uploadFile(file);
        attachment_url = result.url;
        attachment_type = result.type;
      }

      const { error: insertError } = await supabase
        .from('posts')
        .insert({
          user_id: user.id,
          body: formData.body.trim(),
          school_tag: formData.school_tag.trim() || null,
          course_tag: formData.course_tag.trim() || null,
          attachment_url,
          attachment_type,
        });

      if (insertError) throw insertError;

      showToast("Post created!", "success");

      navigate('/home');
    } catch (error: any) {
      console.error('Error creating post:', error);
      showToast(error.message || "Failed to create post. Please try again.", "error");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="container mx-auto px-4 py-6 max-w-2xl">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Upload className="w-5 h-5" />
            Create New Post
          </CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-6">
            <div className="space-y-2">
              <Label htmlFor="body">What's on your mind?</Label>
              <Textarea
                id="body"
                placeholder="Share your notes, assignments, or ask questions..."
                value={formData.body}
                onChange={(e) => setFormData({ ...formData, body: e.target.value })}
                className="min-h-32 resize-none"
                disabled={loading}
              />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="school_tag">School/University</Label>
                <Input
                  id="school_tag"
                  placeholder="e.g., University of Lagos"
                  value={formData.school_tag}
                  onChange={(e) => setFormData({ ...formData, school_tag: e.target.value })}
                  disabled={loading}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="course_tag">Course Code</Label>
                <Input
                  id="course_tag"
                  placeholder="e.g., CSC 201, MTH 101"
                  value={formData.course_tag}
                  onChange={(e) => setFormData({ ...formData, course_tag: e.target.value })}
                  disabled={loading}
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label>Attachment (Optional)</Label>
              <div className="border-2 border-dashed border-border rounded-lg p-6">
                {!file ? (
                  <div className="text-center">
                    <Upload className="w-8 h-8 text-muted-foreground mx-auto mb-2" />
                    <p className="text-sm text-muted-foreground mb-2">
                      Upload an image or PDF file
                    </p>
                    <p className="text-xs text-muted-foreground mb-4">
                      Max file size: 10MB
                    </p>
                    <Button type="button" variant="outline" asChild>
                      <label htmlFor="file-upload" className="cursor-pointer">
                        Choose File
                      </label>
                    </Button>
                    <input
                      id="file-upload"
                      type="file"
                      accept="image/*,.pdf"
                      onChange={handleFileChange}
                      className="hidden"
                      disabled={loading}
                    />
                  </div>
                ) : (
                  <div className="space-y-3">
                    {preview ? (
                      <img
                        src={preview}
                        alt="Preview"
                        className="w-full h-48 object-cover rounded-lg"
                      />
                    ) : (
                      <div className="flex items-center gap-3 p-3 bg-muted rounded-lg">
                        <FileText className="w-8 h-8 text-muted-foreground" />
                        <div className="flex-1">
                          <p className="font-medium">{file.name}</p>
                          <p className="text-sm text-muted-foreground">
                            {(file.size / 1024 / 1024).toFixed(1)} MB
                          </p>
                        </div>
                      </div>
                    )}
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={removeFile}
                      className="w-full"
                    >
                      <X className="w-4 h-4 mr-2" />
                      Remove File
                    </Button>
                  </div>
                )}
              </div>
            </div>

            <div className="flex gap-3 pt-4">
              <Button
                type="button"
                variant="outline"
                onClick={() => navigate('/home')}
                disabled={loading}
                className="flex-1"
              >
                Cancel
              </Button>
              <Button type="submit" disabled={loading} className="flex-1">
                {loading ? "Creating..." : "Create Post"}
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}