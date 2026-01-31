import { supabase } from './supabase';
import type { Generation, GenerationSettings } from '@/types/database';

export interface CreateGenerationData {
  user_id: string;
  reference_image_url: string;
  motion_video_url: string;
  kling_task_id: string;
  settings: GenerationSettings;
  duration?: number;
}

export interface UpdateGenerationData {
  status?: 'pending' | 'processing' | 'completed' | 'failed';
  progress?: number;
  result_video_url?: string;
  error_message?: string;
  credits_used?: number;
}

/**
 * Create a new generation record
 */
export async function createGeneration(data: CreateGenerationData): Promise<Generation> {
  const { data: generation, error } = await supabase
    .from('generations')
    .insert(data)
    .select()
    .single();

  if (error) {
    console.error('Error creating generation:', error);
    throw new Error(error.message);
  }

  return generation;
}

/**
 * Update an existing generation
 */
export async function updateGeneration(
  id: string,
  updates: UpdateGenerationData
): Promise<Generation> {
  const { data: generation, error } = await supabase
    .from('generations')
    .update(updates)
    .eq('id', id)
    .select()
    .single();

  if (error) {
    console.error('Error updating generation:', error);
    throw new Error(error.message);
  }

  return generation;
}

/**
 * Get a single generation by ID
 */
export async function getGeneration(id: string): Promise<Generation | null> {
  const { data: generation, error } = await supabase
    .from('generations')
    .select('*')
    .eq('id', id)
    .single();

  if (error) {
    console.error('Error fetching generation:', error);
    return null;
  }

  return generation;
}

/**
 * Get all generations for a user
 */
export async function getGenerations(userId: string): Promise<Generation[]> {
  const { data: generations, error } = await supabase
    .from('generations')
    .select('*')
    .eq('user_id', userId)
    .order('created_at', { ascending: false });

  if (error) {
    console.error('Error fetching generations:', error);
    throw new Error(error.message);
  }

  return generations || [];
}

/**
 * Delete a generation
 */
export async function deleteGeneration(id: string): Promise<void> {
  const { error } = await supabase
    .from('generations')
    .delete()
    .eq('id', id);

  if (error) {
    console.error('Error deleting generation:', error);
    throw new Error(error.message);
  }
}

/**
 * Get generations by status for a user
 */
export async function getGenerationsByStatus(
  userId: string,
  status: 'pending' | 'processing' | 'completed' | 'failed'
): Promise<Generation[]> {
  const { data: generations, error } = await supabase
    .from('generations')
    .select('*')
    .eq('user_id', userId)
    .eq('status', status)
    .order('created_at', { ascending: false });

  if (error) {
    console.error('Error fetching generations by status:', error);
    throw new Error(error.message);
  }

  return generations || [];
}

/**
 * Get incomplete generations (pending or processing) for a user
 */
export async function getIncompleteGenerations(userId: string): Promise<Generation[]> {
  const { data: generations, error } = await supabase
    .from('generations')
    .select('*')
    .eq('user_id', userId)
    .in('status', ['pending', 'processing'])
    .order('created_at', { ascending: false });

  if (error) {
    console.error('Error fetching incomplete generations:', error);
    throw new Error(error.message);
  }

  return generations || [];
}
