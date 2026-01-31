export type GenerationStatus = 'pending' | 'processing' | 'completed' | 'failed';

export interface Database {
  public: {
    Tables: {
      generations: {
        Row: {
          id: string;
          user_id: string;
          reference_image_url: string;
          motion_video_url: string;
          result_video_url: string | null;
          status: GenerationStatus;
          kling_task_id: string;
          progress: number;
          error_message: string | null;
          settings: GenerationSettings;
          credits_used: number | null;
          duration: number | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          reference_image_url: string;
          motion_video_url: string;
          result_video_url?: string | null;
          status?: GenerationStatus;
          kling_task_id: string;
          progress?: number;
          error_message?: string | null;
          settings: GenerationSettings;
          credits_used?: number | null;
          duration?: number | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string;
          reference_image_url?: string;
          motion_video_url?: string;
          result_video_url?: string | null;
          status?: GenerationStatus;
          kling_task_id?: string;
          progress?: number;
          error_message?: string | null;
          settings?: GenerationSettings;
          credits_used?: number | null;
          duration?: number | null;
          created_at?: string;
          updated_at?: string;
        };
      };
      user_settings: {
        Row: {
          user_id: string;
          default_settings: GenerationSettings;
          theme: string;
          kling_access_key: string | null;
          kling_secret_key: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          user_id: string;
          default_settings?: GenerationSettings;
          theme?: string;
          kling_access_key?: string | null;
          kling_secret_key?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          user_id?: string;
          default_settings?: GenerationSettings;
          theme?: string;
          kling_access_key?: string | null;
          kling_secret_key?: string | null;
          created_at?: string;
          updated_at?: string;
        };
      };
    };
  };
}

export interface GenerationSettings {
  motionStrength: number;
  matchMode: 'structure' | 'motion';
  quality: '720p' | '1080p';
  aspectRatio: '16:9' | '9:16' | '1:1';
  negativePrompt?: string;
}

export type Generation = Database['public']['Tables']['generations']['Row'];
export type UserSettings = Database['public']['Tables']['user_settings']['Row'];
