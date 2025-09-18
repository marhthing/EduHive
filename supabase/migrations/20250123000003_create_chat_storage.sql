
-- Create storage bucket for chat attachments
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'chat-attachments',
  'chat-attachments',
  true,
  52428800, -- 50MB limit
  ARRAY[
    'image/jpeg',
    'image/png', 
    'image/gif',
    'image/webp',
    'application/pdf',
    'text/plain',
    'text/markdown',
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'audio/mpeg',
    'audio/wav',
    'audio/mp4',
    'audio/webm'
  ]
);

-- Create RLS policies for the chat-attachments bucket
CREATE POLICY "Users can upload their own chat attachments" ON storage.objects
  FOR INSERT WITH CHECK (
    bucket_id = 'chat-attachments' 
    AND auth.uid()::text = (storage.foldername(name))[1]
  );

CREATE POLICY "Users can view their own chat attachments" ON storage.objects
  FOR SELECT USING (
    bucket_id = 'chat-attachments' 
    AND auth.uid()::text = (storage.foldername(name))[1]
  );

CREATE POLICY "Users can update their own chat attachments" ON storage.objects
  FOR UPDATE USING (
    bucket_id = 'chat-attachments' 
    AND auth.uid()::text = (storage.foldername(name))[1]
  );

CREATE POLICY "Users can delete their own chat attachments" ON storage.objects
  FOR DELETE USING (
    bucket_id = 'chat-attachments' 
    AND auth.uid()::text = (storage.foldername(name))[1]
  );
