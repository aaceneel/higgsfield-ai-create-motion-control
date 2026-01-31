import { useState, useEffect, useCallback } from 'react';

export interface PersistedFileData {
  name: string;
  size: number;
  type: string;
  lastModified: number;
  preview?: string; // base64 or blob URL for local preview
  supabaseUrl?: string; // URL from Supabase storage (persists across refreshes)
}

export interface WorkspaceState {
  referenceImage?: PersistedFileData;
  motionVideo?: PersistedFileData;
  settings?: any;
  videoDuration?: number;
}

const STORAGE_KEY = 'motion-studio-workspace';

/**
 * Extract a thumbnail from a video file as base64
 */
async function extractVideoThumbnail(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const video = document.createElement('video');
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    
    if (!ctx) {
      reject(new Error('Could not get canvas context'));
      return;
    }

    video.preload = 'metadata';
    video.muted = true;
    video.playsInline = true;
    
    video.onloadedmetadata = () => {
      // Seek to 1 second or 10% of video, whichever is smaller
      video.currentTime = Math.min(1, video.duration * 0.1);
    };
    
    video.onseeked = () => {
      try {
        // Set canvas size to match video (max 640px width to reduce size)
        const maxWidth = 640;
        const scale = Math.min(1, maxWidth / video.videoWidth);
        canvas.width = video.videoWidth * scale;
        canvas.height = video.videoHeight * scale;
        
        // Draw video frame to canvas
        ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
        
        // Convert to base64 (JPEG for smaller size)
        const base64 = canvas.toDataURL('image/jpeg', 0.8);
        
        // Clean up
        URL.revokeObjectURL(video.src);
        resolve(base64);
      } catch (error) {
        URL.revokeObjectURL(video.src);
        reject(error);
      }
    };
    
    video.onerror = () => {
      URL.revokeObjectURL(video.src);
      reject(new Error('Failed to load video'));
    };
    
    // Load the video
    video.src = URL.createObjectURL(file);
  });
}

/**
 * Hook to persist and restore workspace state including uploaded files
 */
export function useWorkspacePersistence() {
  const [isRestored, setIsRestored] = useState(false);

  // Load workspace state from localStorage
  const loadWorkspaceState = useCallback((): WorkspaceState | null => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored) {
        return JSON.parse(stored);
      }
    } catch (error) {
      console.error('[Workspace] Error loading state:', error);
    }
    return null;
  }, []);

  // Save workspace state to localStorage
  const saveWorkspaceState = useCallback((state: WorkspaceState) => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    } catch (error) {
      console.error('[Workspace] Error saving state:', error);
    }
  }, []);

  // Clear workspace state
  const clearWorkspaceState = useCallback(() => {
    try {
      localStorage.removeItem(STORAGE_KEY);
    } catch (error) {
      console.error('[Workspace] Error clearing state:', error);
    }
  }, []);

  // Convert File to persistable data
  const fileToPersistedData = useCallback(
    async (file: File, generatePreview: boolean = true): Promise<PersistedFileData> => {
      const data: PersistedFileData = {
        name: file.name,
        size: file.size,
        type: file.type,
        lastModified: file.lastModified,
      };

      // Generate preview for smaller files (images < 5MB, videos < 50MB)
      if (generatePreview) {
        const maxSize = file.type.startsWith('image/') ? 5 * 1024 * 1024 : 50 * 1024 * 1024;
        if (file.size < maxSize) {
          try {
            // For images, convert to base64
            if (file.type.startsWith('image/')) {
              const reader = new FileReader();
              const base64 = await new Promise<string>((resolve, reject) => {
                reader.onload = () => resolve(reader.result as string);
                reader.onerror = reject;
                reader.readAsDataURL(file);
              });
              data.preview = base64;
            } else if (file.type.startsWith('video/')) {
              // For videos, extract a thumbnail frame and store as base64
              const thumbnail = await extractVideoThumbnail(file);
              data.preview = thumbnail;
            }
          } catch (error) {
            console.warn('[Workspace] Could not generate preview:', error);
          }
        }
      }

      return data;
    },
    []
  );

  // Persist a file (preserves existing supabaseUrl if present)
  const persistFile = useCallback(
    async (type: 'referenceImage' | 'motionVideo', file: File | null) => {
      const currentState = loadWorkspaceState() || {};

      if (file) {
        const persistedData = await fileToPersistedData(file);
        // Preserve existing supabaseUrl if it was already set
        const existingSupabaseUrl = currentState[type]?.supabaseUrl;
        currentState[type] = {
          ...persistedData,
          supabaseUrl: existingSupabaseUrl,
        };
      } else {
        delete currentState[type];
      }

      saveWorkspaceState(currentState);
    },
    [loadWorkspaceState, saveWorkspaceState, fileToPersistedData]
  );

  // Persist settings
  const persistSettings = useCallback(
    (settings: any, videoDuration?: number) => {
      const currentState = loadWorkspaceState() || {};
      currentState.settings = settings;
      if (videoDuration !== undefined) {
        currentState.videoDuration = videoDuration;
      }
      saveWorkspaceState(currentState);
    },
    [loadWorkspaceState, saveWorkspaceState]
  );

  // Persist Supabase URL for a file (called after successful upload)
  const persistSupabaseUrl = useCallback(
    (type: 'referenceImage' | 'motionVideo', url: string, fileData: { name: string; size: number; type: string }) => {
      const currentState = loadWorkspaceState() || {};
      currentState[type] = {
        ...currentState[type],
        name: fileData.name,
        size: fileData.size,
        type: fileData.type,
        lastModified: Date.now(),
        supabaseUrl: url,
      };
      saveWorkspaceState(currentState);
    },
    [loadWorkspaceState, saveWorkspaceState]
  );

  return {
    loadWorkspaceState,
    saveWorkspaceState,
    clearWorkspaceState,
    persistFile,
    persistSettings,
    persistSupabaseUrl,
    isRestored,
    setIsRestored,
  };
}
