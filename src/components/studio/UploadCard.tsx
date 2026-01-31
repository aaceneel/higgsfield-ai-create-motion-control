import { useState, useCallback, useRef, useEffect } from "react";
import { Upload, Image, Video, X, RefreshCw } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { SparklesCore } from "@/components/ui/sparkles";
import { useTheme } from "next-themes";
import type { PersistedFileData } from "@/hooks/use-workspace-persistence";

interface UploadCardProps {
  type: "image" | "video";
  label: string;
  sublabel?: string;
  step: number;
  className?: string;
  onFileSelect?: (file: File | null) => void;
  aspectRatio?: "16:9" | "9:16" | "1:1";
  initialFileData?: PersistedFileData | null;
}

export const UploadCard = ({ 
  type, 
  label, 
  sublabel, 
  step, 
  className, 
  onFileSelect, 
  aspectRatio = "9:16",
  initialFileData 
}: UploadCardProps) => {
  const [isDragging, setIsDragging] = useState(false);
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [fileMetadata, setFileMetadata] = useState<PersistedFileData | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const { theme } = useTheme();

  // Restore file from persisted data on mount
  useEffect(() => {
    if (initialFileData && !file) {
      setFileMetadata(initialFileData);
      // For videos, prefer Supabase URL for playback; for images, use preview or Supabase URL
      if (type === 'video' && initialFileData.supabaseUrl) {
        setPreview(initialFileData.supabaseUrl);
      } else if (initialFileData.preview) {
        setPreview(initialFileData.preview);
      } else if (initialFileData.supabaseUrl) {
        setPreview(initialFileData.supabaseUrl);
      }
    }
  }, [initialFileData, type, file]);

  const acceptedTypes = type === "image" 
    ? "image/png,image/jpeg,image/jpg" 
    : "video/mp4,video/quicktime,video/webm";

  const maxSize = type === "image" ? 10 * 1024 * 1024 : 50 * 1024 * 1024; // 10MB for images, 50MB for videos

  const handleVideoHover = useCallback((isHovering: boolean) => {
    if (videoRef.current) {
      if (isHovering) {
        videoRef.current.play().catch(() => {
          // Ignore play errors (e.g., user hasn't interacted with page yet)
        });
      } else {
        videoRef.current.pause();
        videoRef.current.currentTime = 0; // Reset to start
      }
    }
  }, []);

  const processFile = useCallback((selectedFile: File) => {
    // Validate file type
    const fileType = selectedFile.type;
    const isValidType = type === "image" 
      ? fileType.startsWith("image/")
      : fileType.startsWith("video/");

    if (!isValidType) {
      alert(`Please select a valid ${type} file`);
      return;
    }

    // Validate file size
    if (selectedFile.size > maxSize) {
      const maxSizeMB = maxSize / (1024 * 1024);
      alert(`File size must be less than ${maxSizeMB}MB`);
      return;
    }

    setFile(selectedFile);
    setFileMetadata(null); // Clear persisted metadata when uploading new file
    
    // Create preview URL
    const previewUrl = URL.createObjectURL(selectedFile);
    setPreview(previewUrl);

    // Notify parent component
    if (onFileSelect) {
      onFileSelect(selectedFile);
    }
  }, [type, maxSize, onFileSelect]);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    
    const droppedFile = e.dataTransfer.files[0];
    if (droppedFile) {
      processFile(droppedFile);
    }
  }, [processFile]);

  const handleClick = () => {
    fileInputRef.current?.click();
  };

  const handleFileInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0];
    if (selectedFile) {
      processFile(selectedFile);
    }
  };

  const handleRemove = () => {
    if (preview && preview.startsWith('blob:')) {
      URL.revokeObjectURL(preview);
    }
    setFile(null);
    setPreview(null);
    setFileMetadata(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
    if (onFileSelect) {
      onFileSelect(null);
    }
  };

  const Icon = type === "image" ? Image : Video;
  
  // Get aspect ratio class
  const getAspectRatioClass = () => {
    switch(aspectRatio) {
      case "16:9":
        return "aspect-[16/9]";
      case "1:1":
        return "aspect-square";
      case "9:16":
      default:
        return "aspect-[9/16]";
    }
  };

  return (
    <div className={cn("flex flex-col", className)}>
      <input
        ref={fileInputRef}
        type="file"
        accept={acceptedTypes}
        onChange={handleFileInputChange}
        className="hidden"
      />
      
      <div className="mb-4 flex items-center gap-3">
        <div className="flex items-center justify-center w-8 h-8 rounded-full bg-primary text-primary-foreground text-sm font-bold shadow-md shadow-primary/20">
          {step}
        </div>
        <div>
          <h3 className="text-lg font-semibold text-foreground/90 leading-none">{label}</h3>
          {sublabel && <p className="text-sm text-muted-foreground font-medium mt-1">{sublabel}</p>}
        </div>
      </div>

      {!preview ? (
        <div
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
          onClick={handleClick}
          className={cn(
            "rounded-3xl border-2 border-dashed transition-all duration-300 cursor-pointer relative overflow-hidden group",
            getAspectRatioClass(),
            isDragging 
              ? "border-primary bg-primary/5 scale-[1.02]" 
              : "border-black/20 hover:border-primary/50 hover:bg-secondary/30 bg-card/30",
            "dark:border-white/[0.28] dark:hover:border-white/40"
          )}
        >
          <div className="absolute inset-0 flex flex-col items-center justify-center p-6 text-center">
            <div className={cn(
              "w-20 h-20 rounded-3xl mb-6 flex items-center justify-center transition-all duration-300 shadow-sm",
              "bg-background/80 backdrop-blur-sm border border-border/50 group-hover:scale-110 group-hover:shadow-md",
              isDragging && "scale-110 shadow-lg"
            )}>
              <Icon className={cn(
                "w-10 h-10 transition-colors duration-300",
                "text-muted-foreground/70 group-hover:text-primary",
                isDragging && "text-primary"
              )} />
            </div>
            
            <p className="text-lg font-medium text-foreground mb-2">
              Drop {type} here
            </p>
            <p className="text-sm text-muted-foreground mb-6">
              or click to browse
            </p>
            
            <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-secondary/50 text-xs font-medium text-muted-foreground border border-border/50">
              <Upload className="w-3.5 h-3.5" />
              {type === "image" ? "PNG, JPG up to 10MB" : "MP4, MOV up to 50MB"}
            </div>
          </div>
        </div>
      ) : (
        <div 
          className={cn(
            "relative rounded-3xl overflow-hidden bg-black/5 border border-border/20 group shadow-2xl shadow-black/5",
            getAspectRatioClass()
          )}
          onMouseEnter={() => type === "video" && (file || fileMetadata?.supabaseUrl) && handleVideoHover(true)}
          onMouseLeave={() => type === "video" && (file || fileMetadata?.supabaseUrl) && handleVideoHover(false)}
        >
          {type === "image" ? (
            <img
              src={preview}
              alt="Uploaded content"
              className="w-full h-full object-cover"
            />
          ) : (file || fileMetadata?.supabaseUrl) ? (
            // Video file or restored from Supabase - can play it
            <video
              ref={videoRef}
              src={preview}
              className="w-full h-full object-cover"
              loop
              muted
              playsInline
            />
          ) : (
            // Fallback - show thumbnail as image
            <img
              src={preview}
              alt="Video thumbnail"
              className="w-full h-full object-cover"
            />
          )}
          
          {/* Overlay */}
          <div className="absolute inset-0 bg-black/40 backdrop-blur-[2px] opacity-0 group-hover:opacity-100 transition-all duration-300 flex items-center justify-center gap-4">
            <Button
              variant="secondary"
              size="sm"
              onClick={handleClick}
              className="h-10 px-4 rounded-xl bg-white/90 hover:bg-white text-black border-0 shadow-lg font-medium"
            >
              <RefreshCw className="w-4 h-4 mr-2" />
              Replace
            </Button>
            <Button
              variant="destructive"
              size="sm"
              onClick={handleRemove}
              className="h-10 px-4 rounded-xl shadow-lg font-medium"
            >
              <X className="w-4 h-4 mr-2" />
              Remove
            </Button>
          </div>

          {/* Type badge and file info */}
          <div className="absolute top-4 left-4 flex flex-col gap-2">
            <div className="px-3 py-1.5 rounded-lg bg-black/60 backdrop-blur-md text-white text-xs font-medium border border-white/10 shadow-lg">
              {type === "image" ? "Reference Image" : "Motion Video"}
            </div>
          </div>
          
          <div className="absolute bottom-4 right-4">
             {(file || fileMetadata) && (
              <div className="px-3 py-1.5 rounded-lg bg-black/60 backdrop-blur-md text-white/90 text-xs font-mono border border-white/10 shadow-lg">
                {((file?.size || fileMetadata?.size || 0) / (1024 * 1024)).toFixed(2)} MB
              </div>
            )}
          </div>

          {/* Play button for video - show if we have video file or Supabase URL */}
          {type === "video" && (file || fileMetadata?.supabaseUrl) && (
            <div className="absolute inset-0 flex items-center justify-center pointer-events-none group-hover:opacity-0 transition-opacity duration-300">
              <div className="w-16 h-16 rounded-full bg-white/20 backdrop-blur-md border border-white/30 flex items-center justify-center shadow-2xl">
                <div className="w-0 h-0 border-t-[10px] border-t-transparent border-l-[18px] border-l-white border-b-[10px] border-b-transparent ml-1.5 drop-shadow-sm" />
              </div>
            </div>
          )}
        </div>
      )}
      
      {/* Sparkles Effect Below Card */}
      <div className="relative w-full h-20 mt-2 overflow-hidden">
        {/* Gradients */}
        <div className="absolute left-1/2 -translate-x-1/2 top-0 bg-gradient-to-r from-transparent via-primary/50 to-transparent h-[2px] w-3/4 blur-sm" />
        <div className="absolute left-1/2 -translate-x-1/2 top-0 bg-gradient-to-r from-transparent via-primary/50 to-transparent h-px w-3/4" />
        <div className="absolute left-1/2 -translate-x-1/2 top-0 bg-gradient-to-r from-transparent via-primary/30 to-transparent h-[5px] w-1/4 blur-sm" />
        <div className="absolute left-1/2 -translate-x-1/2 top-0 bg-gradient-to-r from-transparent via-primary/30 to-transparent h-px w-1/4" />

        {/* Core component with circular mask */}
        <div className="absolute inset-0 [mask-image:radial-gradient(ellipse_80%_100%_at_center_top,black_0%,transparent_70%)]">
          <SparklesCore
            background="transparent"
            minSize={0.4}
            maxSize={1}
            particleDensity={800}
            className="w-full h-full"
            particleColor={theme === 'dark' ? "#FFFFFF" : "#000000"}
            speed={0.5}
          />
        </div>
      </div>
    </div>
  );
};
