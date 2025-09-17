
-- Enable RLS on storage.objects
ALTER TABLE storage.objects ENABLE ROW LEVEL SECURITY;

-- Policy for authenticated users to upload files
CREATE POLICY "Users can upload attachments" ON storage.objects
FOR INSERT 
TO authenticated
WITH CHECK (
  bucket_id = 'attachments' AND
  auth.uid()::text = (storage.foldername(name))[1]
);

-- Policy for authenticated users to view their own files
CREATE POLICY "Users can view own attachments" ON storage.objects
FOR SELECT 
TO authenticated
USING (
  bucket_id = 'attachments' AND
  auth.uid()::text = (storage.foldername(name))[1]
);

-- Policy for public access to attachments (for viewing posts)
CREATE POLICY "Public can view attachments" ON storage.objects
FOR SELECT 
TO public
USING (bucket_id = 'attachments');

-- Create the attachments bucket if it doesn't exist
INSERT INTO storage.buckets (id, name, public)
VALUES ('attachments', 'attachments', true)
ON CONFLICT (id) DO NOTHING;
