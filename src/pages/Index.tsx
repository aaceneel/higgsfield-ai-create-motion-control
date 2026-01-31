import { useState, useCallback, useEffect } from "react";
import { Sidebar } from "@/components/studio/Sidebar";
import { Workspace } from "@/components/studio/Workspace";
import { SettingsPanel } from "@/components/studio/SettingsPanel";
import { BackgroundEffects } from "@/components/ui/background-effects";
import { useAuth } from "@/contexts/AuthContext";
import { klingApi } from "@/services/kling";
import { uploadFile } from "@/services/storage";
import { createGeneration, updateGeneration, getIncompleteGenerations } from "@/services/generations";
import { isSupabaseConfigured } from "@/services/supabase";
import { toast } from "sonner";
import { useWorkspacePersistence } from "@/hooks/use-workspace-persistence";
import type { GenerationSettings, KlingTaskResultLegacy } from "@/types/kling";
import type { Generation } from "@/types/database";

const Index = () => {
  const [isGenerating, setIsGenerating] = useState(false);
  const [generationProgress, setGenerationProgress] = useState(0);
  const [generationStatus, setGenerationStatus] = useState("");
  const [referenceImage, setReferenceImage] = useState<File | null>(null);
  const [motionVideo, setMotionVideo] = useState<File | null>(null);
  // Supabase URLs - these persist across refreshes
  const [referenceImageUrl, setReferenceImageUrl] = useState<string | null>(null);
  const [motionVideoUrl, setMotionVideoUrl] = useState<string | null>(null);
  const [isUploadingImage, setIsUploadingImage] = useState(false);
  const [isUploadingVideo, setIsUploadingVideo] = useState(false);
  const [settings, setSettings] = useState<GenerationSettings>({
    motionStrength: 65,
    matchMode: "structure",
    negativePrompt: "",
    quality: "720p",
    aspectRatio: "9:16",
  });
  const [videoDuration, setVideoDuration] = useState<number>(5);
  const [result, setResult] = useState<KlingTaskResultLegacy | undefined>();
  const [creditsUsed, setCreditsUsed] = useState<number | undefined>();
  const [currentGenerationId, setCurrentGenerationId] = useState<string | null>(null);
  const { user } = useAuth();
  const {
    loadWorkspaceState,
    persistFile,
    persistSettings,
    persistSupabaseUrl,
    clearWorkspaceState,
  } = useWorkspacePersistence();

  // Restore workspace state on mount
  useEffect(() => {
    const restoreState = async () => {
      // Always restore workspace state (Supabase URLs) if available
      const savedState = loadWorkspaceState();
      if (savedState) {
        // Restore Supabase URLs
        if (savedState.referenceImage?.supabaseUrl) {
          setReferenceImageUrl(savedState.referenceImage.supabaseUrl);
        }
        if (savedState.motionVideo?.supabaseUrl) {
          setMotionVideoUrl(savedState.motionVideo.supabaseUrl);
        }
        if (savedState.settings) {
          setSettings(savedState.settings);
        }
        if (savedState.videoDuration) {
          setVideoDuration(savedState.videoDuration);
        }
      }

      // Check for incomplete generations from database
      if (user && isSupabaseConfigured()) {
        try {
          const incompleteGenerations = await getIncompleteGenerations(user.id);
          if (incompleteGenerations.length > 0) {
            // Resume the most recent incomplete generation
            const mostRecent = incompleteGenerations[0];
            
            setCurrentGenerationId(mostRecent.id);
            setIsGenerating(true);
            setGenerationProgress(mostRecent.progress || 0);
            setGenerationStatus(mostRecent.status === 'processing' ? 'Processing your video...' : 'Waiting in queue...');
            
            // Restore settings from the generation
            if (mostRecent.settings) {
              setSettings(mostRecent.settings);
            }
            if (mostRecent.duration) {
              setVideoDuration(mostRecent.duration);
            }

            // Continue polling for the task
            klingApi.waitForCompletion(
              mostRecent.kling_task_id,
              async (progress, status, credits) => {
                setGenerationProgress(progress);
                setGenerationStatus(
                  status === "processing"
                    ? "Processing your video..."
                    : status === "pending"
                    ? "Waiting in queue..."
                    : status
                );
                if (credits !== undefined) {
                  setCreditsUsed(credits);
                }

                // Update generation in database with progress
                try {
                  await updateGeneration(mostRecent.id, {
                    progress,
                    status: status as any,
                    credits_used: credits,
                  });
                } catch (error) {
                  console.error('[Index] Error updating generation progress:', error);
                }
              }
            ).then(async (taskResult) => {
              // Final update to database with result
              if (taskResult.result?.videoUrl) {
                try {
                  await updateGeneration(mostRecent.id, {
                    status: 'completed',
                    progress: 100,
                    result_video_url: taskResult.result.videoUrl,
                    credits_used: taskResult.result.creditsUsed,
                  });
                } catch (error) {
                  console.error('[Index] Error saving final result:', error);
                }
              } else if (taskResult.error) {
                // Update with error status
                try {
                  await updateGeneration(mostRecent.id, {
                    status: 'failed',
                    error_message: taskResult.error,
                  });
                } catch (error) {
                  console.error('[Index] Error saving error status:', error);
                }
              }

              setResult(taskResult);
              setGenerationProgress(100);
              setGenerationStatus("Complete!");
              setCreditsUsed(taskResult.result?.creditsUsed);
              
              const creditsMessage = taskResult.result?.creditsUsed 
                ? ` • Used ${taskResult.result.creditsUsed} credits`
                : '';
              
              toast.success("Generation complete!", {
                description: `Your motion transfer video is ready${creditsMessage}`,
              });
            }).catch(async (error) => {
              console.error('[Index] Error resuming generation:', error);
              const errorMessage = error instanceof Error ? error.message : "Unknown error occurred";
              
              // Update generation in database with error
              try {
                await updateGeneration(mostRecent.id, {
                  status: 'failed',
                  error_message: errorMessage,
                });
              } catch (dbError) {
                console.error('[Index] Error saving failure status:', dbError);
              }
              
              toast.error("Generation failed", {
                description: errorMessage,
              });
              
              setGenerationStatus("Failed");
            }).finally(() => {
              setIsGenerating(false);
            });
          }
        } catch (error) {
          console.error('[Index] Error restoring incomplete generations:', error);
        }
      }
    };

    restoreState();
  }, [user?.id, loadWorkspaceState]); // Only run when user changes

  // Check if API is configured on mount
  useEffect(() => {
    if (!klingApi.isConfigured()) {
      toast.error("Kling API key not configured", {
        description: "Please add your VITE_KLING_API_KEY to the .env file",
        duration: 10000,
      });
    }
    
    if (!isSupabaseConfigured()) {
      toast.warning("Supabase not configured", {
        description: "Some features may be limited. Configure Supabase for full functionality.",
        duration: 10000,
      });
    }
  }, []);

  // Files are ready if we have Supabase URLs and not currently uploading
  const hasRequiredFiles = 
    referenceImageUrl !== null && 
    motionVideoUrl !== null &&
    !isUploadingImage &&
    !isUploadingVideo;
  
  // Load persisted state for showing previews
  const persistedState = loadWorkspaceState();

  const handleGenerate = useCallback(async () => {
    // Check if we have URLs (either from fresh upload or restored)
    const imageUrl = referenceImageUrl;
    const videoUrl = motionVideoUrl;
    
    if (!imageUrl || !videoUrl) {
      toast.error("Missing files", {
        description: "Please upload both a reference image and motion video",
      });
      return;
    }

    if (!klingApi.isConfigured()) {
      toast.error("API key not configured", {
        description: "Please add your Kling API key to the .env file",
      });
      return;
    }

    if (!user) {
      toast.error("Not authenticated", {
        description: "Please log in to generate videos",
      });
      return;
    }

    setIsGenerating(true);
    setGenerationProgress(0);
    setGenerationStatus("Creating generation task...");
    setResult(undefined);
    setCurrentGenerationId(null);

    try {
      // Files are already uploaded to Supabase - use the stored URLs
      // Start the Kling API generation task
      const taskId = await klingApi.createMotionTransfer({
        imageUrl: imageUrl,
        videoUrl: videoUrl,
        motionStrength: settings.motionStrength,
        matchMode: settings.matchMode,
        duration: videoDuration,
        negativePrompt: settings.negativePrompt,
        quality: settings.quality,
        aspectRatio: settings.aspectRatio,
      });

      // Save generation to database
      const generation = await createGeneration({
        user_id: user.id,
        reference_image_url: imageUrl,
        motion_video_url: videoUrl,
        kling_task_id: taskId,
        settings: settings,
        duration: videoDuration,
      });

      setCurrentGenerationId(generation.id);
      setGenerationStatus("Processing your video...");

      // Wait for completion and update database
      const taskResult = await klingApi.waitForCompletion(
        taskId,
        async (progress, status, credits) => {
          setGenerationProgress(progress);
          setGenerationStatus(
            status === "processing"
              ? "Processing your video..."
              : status === "pending"
              ? "Waiting in queue..."
              : status
          );
          if (credits !== undefined) {
            setCreditsUsed(credits);
          }

          // Update generation in database with progress
          if (generation.id) {
            try {
              await updateGeneration(generation.id, {
                progress,
                status: status as any,
                credits_used: credits,
              });
            } catch (error) {
              console.error('Error updating generation progress:', error);
            }
          }
        }
      );

      // Final update to database with result
      if (generation.id && taskResult.result?.videoUrl) {
        try {
          await updateGeneration(generation.id, {
            status: 'completed',
            progress: 100,
            result_video_url: taskResult.result.videoUrl,
            credits_used: taskResult.result.creditsUsed,
          });
        } catch (error) {
          console.error('Error saving final result:', error);
        }
      } else if (generation.id && taskResult.error) {
        // Update with error status
        try {
          await updateGeneration(generation.id, {
            status: 'failed',
            error_message: taskResult.error,
          });
        } catch (error) {
          console.error('Error saving error status:', error);
        }
      }

      setResult(taskResult);
      setGenerationProgress(100);
      setGenerationStatus("Complete!");
      setCreditsUsed(taskResult.result?.creditsUsed);
      
      const creditsMessage = taskResult.result?.creditsUsed 
        ? ` • Used ${taskResult.result.creditsUsed} credits`
        : '';
      
      toast.success("Generation complete!", {
        description: `Your motion transfer video is ready${creditsMessage}`,
      });

      // Clear workspace state after successful generation
      clearWorkspaceState();
    } catch (error) {
      console.error("Generation error:", error);
      const errorMessage = error instanceof Error ? error.message : "Unknown error occurred";
      
      // Update generation in database with error
      if (currentGenerationId) {
        try {
          await updateGeneration(currentGenerationId, {
            status: 'failed',
            error_message: errorMessage,
          });
        } catch (dbError) {
          console.error('Error saving failure status:', dbError);
        }
      }
      
      toast.error("Generation failed", {
        description: errorMessage,
      });
      
      setGenerationStatus("Failed");
    } finally {
      setIsGenerating(false);
    }
  }, [referenceImageUrl, motionVideoUrl, settings, videoDuration, user, currentGenerationId, clearWorkspaceState]);

  const handleReferenceImageSelect = useCallback(async (file: File | null) => {
    setReferenceImage(file);
    
    if (file && user) {
      setIsUploadingImage(true);
      try {
        toast.info("Uploading image to cloud...");
        const upload = await uploadFile('uploads', file, user.id);
        setReferenceImageUrl(upload.url);
        
        // Persist URL to localStorage
        persistSupabaseUrl('referenceImage', upload.url, {
          name: file.name,
          size: file.size,
          type: file.type,
        });
        
        // Also persist preview for visual display
        await persistFile('referenceImage', file);
        
        toast.success("Reference image ready", {
          description: file.name,
        });
      } catch (error) {
        console.error('[Index] Error uploading image:', error);
        toast.error("Failed to upload image", {
          description: error instanceof Error ? error.message : "Unknown error",
        });
        setReferenceImage(null);
      } finally {
        setIsUploadingImage(false);
      }
    } else if (!file) {
      setReferenceImageUrl(null);
      clearWorkspaceState(); // Clear when removing
    }
  }, [user, persistSupabaseUrl, persistFile, clearWorkspaceState]);

  const handleMotionVideoSelect = useCallback(async (file: File | null) => {
    setMotionVideo(file);
    
    if (file && user) {
      // Extract duration from video
      const video = document.createElement('video');
      video.preload = 'metadata';
      video.onloadedmetadata = () => {
        window.URL.revokeObjectURL(video.src);
        const duration = Math.round(video.duration);
        setVideoDuration(duration);
      };
      video.src = URL.createObjectURL(file);
      
      setIsUploadingVideo(true);
      try {
        toast.info("Uploading video to cloud...");
        const upload = await uploadFile('uploads', file, user.id);
        setMotionVideoUrl(upload.url);
        
        // Persist URL to localStorage
        persistSupabaseUrl('motionVideo', upload.url, {
          name: file.name,
          size: file.size,
          type: file.type,
        });
        
        // Also persist preview for visual display
        await persistFile('motionVideo', file);
        
        toast.success("Motion video ready", {
          description: file.name,
        });
      } catch (error) {
        console.error('[Index] Error uploading video:', error);
        toast.error("Failed to upload video", {
          description: error instanceof Error ? error.message : "Unknown error",
        });
        setMotionVideo(null);
      } finally {
        setIsUploadingVideo(false);
      }
    } else if (!file) {
      setMotionVideoUrl(null);
      clearWorkspaceState(); // Clear when removing
    }
  }, [user, persistSupabaseUrl, persistFile, clearWorkspaceState]);

  const handleSettingsChange = useCallback((newSettings: GenerationSettings) => {
    setSettings(newSettings);
    // Persist settings to localStorage
    persistSettings(newSettings, videoDuration);
  }, [persistSettings, videoDuration]);

  return (
    <div className="flex h-screen w-full bg-background overflow-hidden relative">
      <BackgroundEffects />

      {/* Sidebar */}
      <div className="relative z-10 h-full">
        <Sidebar />
      </div>

      {/* Main Content */}
      <div className="flex-1 flex min-w-0 relative z-10">
        {/* Workspace */}
        <Workspace 
          onGenerate={handleGenerate}
          isGenerating={isGenerating}
          onReferenceImageSelect={handleReferenceImageSelect}
          onMotionVideoSelect={handleMotionVideoSelect}
          hasRequiredFiles={hasRequiredFiles}
          aspectRatio={settings.aspectRatio}
          initialReferenceImage={persistedState?.referenceImage}
          initialMotionVideo={persistedState?.motionVideo}
        />

        {/* Fade effects around Settings Panel - 13px */}
        <div className="absolute right-[360px] top-0 bottom-0 bg-gradient-to-r from-transparent via-card/60 to-card/80 pointer-events-none z-20" style={{ width: '13px' }} />
        <div className="absolute right-0 top-0 bottom-0 bg-gradient-to-l from-transparent via-card/60 to-card/80 pointer-events-none z-20" style={{ width: '13px' }} />

        {/* Settings Panel */}
        <SettingsPanel 
          isGenerating={isGenerating}
          generationProgress={generationProgress}
          generationStatus={generationStatus}
          result={result}
          creditsUsed={creditsUsed}
          videoDuration={videoDuration}
          onSettingsChange={handleSettingsChange}
        />
      </div>
    </div>
  );
};

export default Index;
