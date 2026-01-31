// Kling AI API Types

export interface KlingMotionTransferRequest {
  referenceImage: File;
  motionVideo: File;
  motionStrength?: number;
  matchMode?: 'structure' | 'motion';
  duration?: number;
  negativePrompt?: string;
  quality?: '720p' | '1080p';
  aspectRatio?: '16:9' | '9:16' | '1:1';
}

export interface KlingTaskResponse {
  code: number;
  message: string;
  request_id: string;
  data: {
    task_id: string;
    task_status: string;
    created_at: number;
  };
}

// Legacy interface for backward compatibility
export interface KlingTaskResponseLegacy {
  taskId: string;
  status: 'pending' | 'processing' | 'completed' | 'failed';
  message?: string;
  createdAt: string;
}

export interface KlingTaskResult {
  code: number;
  message: string;
  request_id: string;
  data: {
    task_id: string;
    task_status: 'pending' | 'processing' | 'succeed' | 'failed';
    task_status_msg: string;
    task_info?: {
      external_task_id?: string;
    };
    task_result?: {
      videos: Array<{
        id: string;
        url: string;
        watermark_url?: string; // NEW: URL with hotlink protection
        duration: string;
      }>;
    };
    watermark_info?: {
      enabled: boolean; // NEW: Watermark setting
    };
    final_unit_deduction?: string; // NEW: Task unit deduction results (credits used)
    created_at: number;
    updated_at: number;
  };
}

// Legacy interface for backward compatibility
export interface KlingTaskResultLegacy {
  taskId: string;
  status: 'pending' | 'processing' | 'completed' | 'failed';
  progress?: number;
  result?: {
    videoUrl: string;
    thumbnailUrl?: string;
    duration: number;
    watermarkUrl?: string; // NEW
    creditsUsed?: number; // NEW
  };
  error?: string;
  createdAt: string;
  completedAt?: string;
}

export interface KlingApiError {
  code: string;
  message: string;
  details?: any;
}

export interface GenerationSettings {
  motionStrength: number;
  matchMode: 'structure' | 'motion';
  negativePrompt?: string;
  quality: '720p' | '1080p';
  aspectRatio: '16:9' | '9:16' | '1:1';
}
