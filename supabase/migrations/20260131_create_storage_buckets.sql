-- Create storage buckets for file uploads and results
-- Run this in your Supabase SQL Editor after the initial schema migration

-- Create 'uploads' bucket for user-uploaded images and videos
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'uploads',
  'uploads',
  true,
  104857600, -- 100MB in bytes
  ARRAY['image/jpeg', 'image/jpg', 'image/png', 'image/webp', 'video/mp4', 'video/quicktime', 'video/webm']
)
ON CONFLICT (id) DO NOTHING;

-- Create 'results' bucket for generated videos (optional, as Kling hosts results)
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'results',
  'results',
  true,
  524288000, -- 500MB in bytes
  ARRAY['video/mp4', 'video/quicktime', 'video/webm']
)
ON CONFLICT (id) DO NOTHING;

-- Set up Row Level Security (RLS) policies for storage buckets
-- This ensures users can only access their own files

-- Policy: Users can upload files to their own folder in 'uploads' bucket
CREATE POLICY "Users can upload to their own folder in uploads"
ON storage.objects
FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'uploads' 
  AND (storage.foldername(name))[1] = auth.uid()::text
);

-- Policy: Users can view files in their own folder in 'uploads' bucket
CREATE POLICY "Users can view their own uploads"
ON storage.objects
FOR SELECT
TO authenticated
USING (
  bucket_id = 'uploads' 
  AND (storage.foldername(name))[1] = auth.uid()::text
);

-- Policy: Users can delete files in their own folder in 'uploads' bucket
CREATE POLICY "Users can delete their own uploads"
ON storage.objects
FOR DELETE
TO authenticated
USING (
  bucket_id = 'uploads' 
  AND (storage.foldername(name))[1] = auth.uid()::text
);

-- Policy: Users can update files in their own folder in 'uploads' bucket
CREATE POLICY "Users can update their own uploads"
ON storage.objects
FOR UPDATE
TO authenticated
USING (
  bucket_id = 'uploads' 
  AND (storage.foldername(name))[1] = auth.uid()::text
)
WITH CHECK (
  bucket_id = 'uploads' 
  AND (storage.foldername(name))[1] = auth.uid()::text
);

-- Policies for 'results' bucket (same as uploads)
CREATE POLICY "Users can upload to their own folder in results"
ON storage.objects
FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'results' 
  AND (storage.foldername(name))[1] = auth.uid()::text
);

CREATE POLICY "Users can view their own results"
ON storage.objects
FOR SELECT
TO authenticated
USING (
  bucket_id = 'results' 
  AND (storage.foldername(name))[1] = auth.uid()::text
);

CREATE POLICY "Users can delete their own results"
ON storage.objects
FOR DELETE
TO authenticated
USING (
  bucket_id = 'results' 
  AND (storage.foldername(name))[1] = auth.uid()::text
);

CREATE POLICY "Users can update their own results"
ON storage.objects
FOR UPDATE
TO authenticated
USING (
  bucket_id = 'results' 
  AND (storage.foldername(name))[1] = auth.uid()::text
)
WITH CHECK (
  bucket_id = 'results' 
  AND (storage.foldername(name))[1] = auth.uid()::text
);

-- Optional: Allow public read access (if you want anyone to view files via public URLs)
-- Uncomment these if you want public access:

-- CREATE POLICY "Public can view uploads"
-- ON storage.objects
-- FOR SELECT
-- TO public
-- USING (bucket_id = 'uploads');

-- CREATE POLICY "Public can view results"
-- ON storage.objects
-- FOR SELECT
-- TO public
-- USING (bucket_id = 'results');
