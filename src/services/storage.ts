import { supabase } from './supabase';

export interface UploadResult {
  url: string;
  path: string;
}

/**
 * Upload a file to Supabase Storage
 */
export async function uploadFile(
  bucket: 'uploads' | 'results',
  file: File,
  userId?: string
): Promise<UploadResult> {
  // Generate unique filename
  const timestamp = Date.now();
  const randomString = Math.random().toString(36).substring(7);
  const extension = file.name.split('.').pop();
  const filename = `${timestamp}-${randomString}.${extension}`;
  
  // Add user folder if userId provided
  const path = userId ? `${userId}/${filename}` : filename;

  const { data, error } = await supabase.storage
    .from(bucket)
    .upload(path, file, {
      cacheControl: '3600',
      upsert: false,
    });

  if (error) {
    console.error('Error uploading file:', error);
    throw new Error(`Failed to upload file: ${error.message}`);
  }

  // Get public URL
  const { data: { publicUrl } } = supabase.storage
    .from(bucket)
    .getPublicUrl(data.path);

  return {
    url: publicUrl,
    path: data.path,
  };
}

/**
 * Delete a file from Supabase Storage
 */
export async function deleteFile(
  bucket: 'uploads' | 'results',
  path: string
): Promise<void> {
  const { error } = await supabase.storage
    .from(bucket)
    .remove([path]);

  if (error) {
    console.error('Error deleting file:', error);
    throw new Error(`Failed to delete file: ${error.message}`);
  }
}

/**
 * Get public URL for a file
 */
export function getPublicUrl(bucket: 'uploads' | 'results', path: string): string {
  const { data } = supabase.storage
    .from(bucket)
    .getPublicUrl(path);

  return data.publicUrl;
}

/**
 * List files in a user's folder
 */
export async function listFiles(
  bucket: 'uploads' | 'results',
  userId: string
): Promise<string[]> {
  const { data, error } = await supabase.storage
    .from(bucket)
    .list(userId);

  if (error) {
    console.error('Error listing files:', error);
    throw new Error(`Failed to list files: ${error.message}`);
  }

  return data.map((file) => `${userId}/${file.name}`);
}

/**
 * Delete all files in a user's folder
 */
export async function deleteUserFiles(
  bucket: 'uploads' | 'results',
  userId: string
): Promise<void> {
  const paths = await listFiles(bucket, userId);
  
  if (paths.length === 0) return;

  const { error } = await supabase.storage
    .from(bucket)
    .remove(paths);

  if (error) {
    console.error('Error deleting user files:', error);
    throw new Error(`Failed to delete user files: ${error.message}`);
  }
}
