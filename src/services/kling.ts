import { SignJWT } from 'jose';
import type {
  KlingTaskResponse,
  KlingTaskResult,
  KlingTaskResultLegacy,
  KlingApiError,
} from '@/types/kling';

const ACCESS_KEY = import.meta.env.VITE_KLING_ACCESS_KEY;
const SECRET_KEY = import.meta.env.VITE_KLING_SECRET_KEY;
const API_BASE_URL = import.meta.env.VITE_KLING_API_BASE_URL || '/api/kling';

// Request interface now uses URLs instead of File objects
export interface KlingMotionTransferRequestURLs {
  imageUrl: string;
  videoUrl: string;
  motionStrength?: number;
  matchMode?: 'structure' | 'motion';
  duration?: number;
  negativePrompt?: string;
  quality?: '720p' | '1080p';
  aspectRatio?: '16:9' | '9:16' | '1:1';
}

class KlingApiService {
  private accessKey: string;
  private secretKey: string;
  private baseUrl: string;
  private cachedToken: string | null = null;
  private tokenExpiry: number = 0;

  constructor() {
    this.accessKey = ACCESS_KEY;
    this.secretKey = SECRET_KEY;
    this.baseUrl = API_BASE_URL;
  }

  /**
   * Generate JWT token for authentication
   */
  private async generateJWTToken(): Promise<string> {
    // Check if cached token is still valid (with 1 minute buffer)
    const now = Math.floor(Date.now() / 1000);
    if (this.cachedToken && this.tokenExpiry > now + 60) {
      return this.cachedToken;
    }

    const nbf = now - 5; // Not before: 5 seconds ago
    const exp = now + 1800; // Expires in 30 minutes

    // Convert secret key to Uint8Array
    const secret = new TextEncoder().encode(this.secretKey);

    // Create JWT token
    const token = await new SignJWT({})
      .setProtectedHeader({ alg: 'HS256', typ: 'JWT' })
      .setIssuer(this.accessKey)
      .setNotBefore(nbf)
      .setExpirationTime(exp)
      .sign(secret);

    this.cachedToken = token;
    this.tokenExpiry = exp;

    return token;
  }

  private async getHeaders(includeContentType = true): Promise<HeadersInit> {
    const token = await this.generateJWTToken();
    const headers: HeadersInit = {
      'Authorization': `Bearer ${token}`,
    };
    
    if (includeContentType) {
      headers['Content-Type'] = 'application/json';
    }
    
    return headers;
  }

  private async handleResponse<T>(response: Response): Promise<T> {
    const data = await response.json();
    
    // Check for API-level errors
    if (data.code !== 0 && data.code !== undefined) {
      throw new Error(data.message || `API Error: Code ${data.code}`);
    }
    
    if (!response.ok) {
      const error: KlingApiError = data || {
        code: 'UNKNOWN_ERROR',
        message: `HTTP ${response.status}: ${response.statusText}`,
      };
      throw new Error(error.message || 'API request failed');
    }
    
    return data;
  }

  /**
   * Convert new API response to legacy format for UI compatibility
   */
  private convertToLegacyResult(apiResult: KlingTaskResult): KlingTaskResultLegacy {
    const data = apiResult.data;
    const video = data.task_result?.videos?.[0];
    
    // Map task status
    const statusMap: Record<string, KlingTaskResultLegacy['status']> = {
      'pending': 'pending',
      'processing': 'processing',
      'succeed': 'completed',
      'failed': 'failed',
    };
    
    // Calculate progress based on status
    let progress = 0;
    if (data.task_status === 'processing') progress = 50;
    if (data.task_status === 'succeed') progress = 100;
    
    return {
      taskId: data.task_id,
      status: statusMap[data.task_status] || 'pending',
      progress,
      result: video ? {
        videoUrl: video.watermark_url || video.url, // Prefer watermark URL for hotlink protection
        duration: parseFloat(video.duration),
        watermarkUrl: video.watermark_url,
        creditsUsed: data.final_unit_deduction ? parseFloat(data.final_unit_deduction) : undefined,
      } : undefined,
      error: data.task_status === 'failed' ? data.task_status_msg : undefined,
      createdAt: new Date(data.created_at * 1000).toISOString(),
      completedAt: data.updated_at ? new Date(data.updated_at * 1000).toISOString() : undefined,
    };
  }

  /**
   * Create a motion transfer task using pre-uploaded file URLs
   */
  async createMotionTransfer(
    request: KlingMotionTransferRequestURLs
  ): Promise<string> {
    if (!this.accessKey || !this.secretKey) {
      throw new Error('Kling API credentials are not configured. Please add VITE_KLING_ACCESS_KEY and VITE_KLING_SECRET_KEY to your .env file');
    }

    const headers = await this.getHeaders();

    // Map matchMode to character_orientation
    // "structure" -> "image" (preserves image structure, max 10s)
    // "motion" -> "video" (follows video motion, max 30s)
    const characterOrientation = request.matchMode === 'structure' ? 'image' : 'video';

    // Map quality to mode (720p = std, 1080p = pro)
    const qualityMode = request.quality === '1080p' ? 'pro' : 'std';
    
    // Create motion transfer task using the correct endpoint
    // Pass the Kling API path as a query parameter
    const response = await fetch(`${this.baseUrl}?path=videos/motion-control`, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        model_name: 'kling-v1.6',
        image_url: request.imageUrl,  // Use pre-uploaded URL
        video_url: request.videoUrl,  // Use pre-uploaded URL
        mode: qualityMode,  // 'std' (720p) or 'pro' (1080p)
        character_orientation: characterOrientation,
        duration: request.duration || 5,
        cfg_scale: (request.motionStrength || 65) / 10, // Convert 0-100 to 0-10 scale
        negative_prompt: request.negativePrompt || '',
        aspect_ratio: request.aspectRatio || '16:9',  // '16:9', '9:16', or '1:1'
      }),
    });

    const result = await this.handleResponse<KlingTaskResponse>(response);
    return result.data.task_id;
  }

  /**
   * Get task status and result
   */
  async getTaskResult(taskId: string): Promise<KlingTaskResultLegacy> {
    if (!this.accessKey || !this.secretKey) {
      throw new Error('Kling API credentials are not configured');
    }

    const headers = await this.getHeaders();

    const response = await fetch(`${this.baseUrl}?path=videos/motion-control/${taskId}`, {
      method: 'GET',
      headers,
    });

    const apiResult = await this.handleResponse<KlingTaskResult>(response);
    return this.convertToLegacyResult(apiResult);
  }

  /**
   * Poll task until completion (no timeout - waits until task completes or fails)
   */
  async waitForCompletion(
    taskId: string,
    onProgress?: (progress: number, status: string, creditsUsed?: number) => void
  ): Promise<KlingTaskResultLegacy> {
    const pollInterval = 3000; // 3 seconds
    let pollCount = 0;

    // Infinite loop - only exits when task completes or fails
    while (true) {
      pollCount++;
      
      try {
        const result = await this.getTaskResult(taskId);

        if (onProgress) {
          onProgress(
            result.progress || 0, 
            result.status,
            result.result?.creditsUsed
          );
        }

        if (result.status === 'completed') {
          return result;
        }

        if (result.status === 'failed') {
          throw new Error(result.error || 'Task failed');
        }

        // Wait before polling again
        await new Promise((resolve) => setTimeout(resolve, pollInterval));
      } catch (error) {
        // If it's a task failed error, throw it
        if (error instanceof Error && error.message.includes('Task failed')) {
          throw error;
        }
        // For network errors, wait and retry
        await new Promise((resolve) => setTimeout(resolve, pollInterval));
      }
    }
  }

  /**
   * Complete motion transfer workflow using pre-uploaded file URLs
   */
  async generateMotionTransfer(
    request: KlingMotionTransferRequestURLs,
    onProgress?: (progress: number, status: string, creditsUsed?: number) => void
  ): Promise<KlingTaskResultLegacy> {
    // Create the task
    const taskId = await this.createMotionTransfer(request);

    // Wait for completion
    const result = await this.waitForCompletion(
      taskId,
      onProgress
    );

    return result;
  }

  /**
   * Check if API is configured
   */
  isConfigured(): boolean {
    return (
      !!this.accessKey && 
      !!this.secretKey && 
      this.accessKey !== 'your_access_key_here' &&
      this.secretKey !== 'your_secret_key_here'
    );
  }
}

export const klingApi = new KlingApiService();
