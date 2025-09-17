
-- Create avatars bucket if it doesn't exist
INSERT INTO storage.buckets (id, name, public)
VALUES ('avatars', 'avatars', true)
ON CONFLICT (id) DO NOTHING;

-- Policy for authenticated users to upload avatars
CREATE POLICY "Users can upload avatars" ON storage.objects
FOR INSERT 
TO authenticated
WITH CHECK (
  bucket_id = 'avatars' AND
  auth.uid()::text = (storage.foldername(name))[1]
);

-- Policy for authenticated users to update their own avatars
CREATE POLICY "Users can update own avatars" ON storage.objects
FOR UPDATE 
TO authenticated
USING (
  bucket_id = 'avatars' AND
  auth.uid()::text = (storage.foldername(name))[1]
);

-- Policy for public access to avatars
CREATE POLICY "Public can view avatars" ON storage.objects
FOR SELECT 
TO public
USING (bucket_id = 'avatars');
