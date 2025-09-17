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
  const [files, setFiles] = useState<File[]>([]);
  const [previews, setPreviews] = useState<string[]>([]);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFiles = Array.from(e.target.files || []);
    if (selectedFiles.length === 0) return;

    // Check if adding these files would exceed the limit (max 5 files)
    if (files.length + selectedFiles.length > 5) {
      showToast("You can upload a maximum of 5 files", "error");
      return;
    }

    const validFiles: File[] = [];
    const newPreviews: string[] = [];
    const allowedTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/gif', 'application/pdf'];

    for (const file of selectedFiles) {
      // Check file size (max 10MB)
      if (file.size > 10 * 1024 * 1024) {
        showToast(`File "${file.name}" is too large. Please select files smaller than 10MB`, "error");
        continue;
      }

      // Check file type
      if (!allowedTypes.includes(file.type)) {
        showToast(`File "${file.name}" is not supported. Please select images (JPEG, PNG, GIF) or PDF files`, "error");
        continue;
      }

      validFiles.push(file);

      // Create preview for images
      if (file.type.startsWith('image/')) {
        const reader = new FileReader();
        reader.onload = () => {
          setPreviews(prev => [...prev, reader.result as string]);
        };
        reader.readAsDataURL(file);
      } else {
        newPreviews.push('');
      }
    }

    if (validFiles.length > 0) {
      setFiles(prev => [...prev, ...validFiles]);
      // Add empty strings for PDFs to maintain index alignment
      setPreviews(prev => [...prev, ...newPreviews]);
    }
  };

  const removeFile = (index: number) => {
    setFiles(prev => prev.filter((_, i) => i !== index));
    setPreviews(prev => prev.filter((_, i) => i !== index));
  };

  const removeAllFiles = () => {
    setFiles([]);
    setPreviews([]);
  };

  const uploadFiles = async (files: File[]) => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error("User not authenticated");

    const uploadPromises = files.map(async (file, index) => {
      const fileExt = file.name.split('.').pop();
      const fileName = `${Date.now()}_${index}.${fileExt}`;
      const filePath = `${user.id}/${fileName}`;

      const { error: uploadError } = await supabase.storage
        .from('attachments')
        .upload(filePath, file);

      if (uploadError) throw uploadError;

      const { data: { publicUrl } } = supabase.storage
        .from('attachments')
        .getPublicUrl(filePath);

      return { url: publicUrl, type: file.type };
    });

    return await Promise.all(uploadPromises);
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
      

      // Upload files if any
      if (files.length > 0) {
        const uploadedFiles = await uploadFiles(files);
        if (uploadedFiles.length === 1) {
          // Single file - store as before for backward compatibility
          attachment_url = uploadedFiles[0].url;
          attachment_type = uploadedFiles[0].type;
        } else {
          // Multiple files - store as JSON array
          attachment_url = JSON.stringify(uploadedFiles);
          attachment_type = 'multiple';
        }
      }

      const { error: insertError } = await supabase
        .from('posts')
        .insert({
          user_id: user.id,
          body: formData.body.trim(),
          school_tag: formData.school_tag.trim() || null,
          course_tag: formData.course_tag.trim() || null,
          attachment_url: attachment_url,
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
              <Label>Attachments (Optional)</Label>
              <div className="border-2 border-dashed border-border rounded-lg p-6">
                {files.length === 0 ? (
                  <div className="text-center">
                    <Upload className="w-8 h-8 text-muted-foreground mx-auto mb-2" />
                    <p className="text-sm text-muted-foreground mb-2">
                      Upload images or PDF files
                    </p>
                    <p className="text-xs text-muted-foreground mb-4">
                      Max 5 files, 10MB each
                    </p>
                    <Button type="button" variant="outline" asChild>
                      <label htmlFor="file-upload" className="cursor-pointer">
                        Choose Files
                      </label>
                    </Button>
                    <input
                      id="file-upload"
                      type="file"
                      accept="image/*,.pdf"
                      multiple
                      onChange={handleFileChange}
                      className="hidden"
                      disabled={loading}
                    />
                  </div>
                ) : (
                  <div className="space-y-3">
                    <div className="flex justify-between items-center">
                      <p className="text-sm font-medium">{files.length} file{files.length > 1 ? 's' : ''} selected</p>
                      <div className="flex gap-2">
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          asChild
                        >
                          <label htmlFor="file-upload-more" className="cursor-pointer">
                            Add More
                          </label>
                        </Button>
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          onClick={removeAllFiles}
                        >
                          Remove All
                        </Button>
                      </div>
                      <input
                        id="file-upload-more"
                        type="file"
                        accept="image/*,.pdf"
                        multiple
                        onChange={handleFileChange}
                        className="hidden"
                        disabled={loading}
                      />
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                      {files.map((file, index) => (
                        <div key={index} className="relative">
                          {previews[index] ? (
                            <div className="relative">
                              <img
                                src={previews[index]}
                                alt={`Preview ${index + 1}`}
                                className="w-full h-32 object-cover rounded-lg"
                              />
                              <Button
                                type="button"
                                variant="destructive"
                                size="sm"
                                onClick={() => removeFile(index)}
                                className="absolute top-1 right-1 p-1 h-auto rounded-full"
                              >
                                <X className="w-3 h-3" />
                              </Button>
                            </div>
                          ) : (
                            <div className="flex items-center gap-3 p-3 bg-muted rounded-lg">
                              <FileText className="w-6 h-6 text-muted-foreground flex-shrink-0" />
                              <div className="flex-1 min-w-0">
                                <p className="font-medium text-sm truncate">{file.name}</p>
                                <p className="text-xs text-muted-foreground">
                                  {(file.size / 1024 / 1024).toFixed(1)} MB
                                </p>
                              </div>
                              <Button
                                type="button"
                                variant="ghost"
                                size="sm"
                                onClick={() => removeFile(index)}
                                className="p-1 h-auto text-destructive hover:text-destructive"
                              >
                                <X className="w-4 h-4" />
                              </Button>
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
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