import { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useNavigate } from 'react-router-dom';
import { getGenerations, deleteGeneration } from '@/services/generations';
import type { Generation } from '@/types/database';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Trash2, Download, Clock, CheckCircle2, XCircle, Loader2, ArrowLeft } from 'lucide-react';
import { toast } from 'sonner';
import { Sidebar } from '@/components/studio/Sidebar';
import { BackgroundEffects } from '@/components/ui/background-effects';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';

const HistoryPage = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [generations, setGenerations] = useState<Generation[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (user) {
      loadGenerations();
    } else {
      setLoading(false);
    }
  }, [user?.id]);

  const loadGenerations = async () => {
    if (!user) return;
    
    setLoading(true);
    try {
      const data = await getGenerations(user.id);
      setGenerations(data);
    } catch (error) {
      console.error('Error loading generations:', error);
      toast.error('Failed to load generation history');
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (id: string) => {
    try {
      await deleteGeneration(id);
      setGenerations(generations.filter((g) => g.id !== id));
      toast.success('Generation deleted');
    } catch (error) {
      console.error('Error deleting generation:', error);
      toast.error('Failed to delete generation');
    }
  };

  const handleDownload = (url: string) => {
    window.open(url, '_blank');
  };

  const getStatusBadge = (status: Generation['status']) => {
    const variants: Record<Generation['status'], { variant: 'default' | 'secondary' | 'destructive' | 'outline'; icon: any }> = {
      pending: { variant: 'secondary', icon: Clock },
      processing: { variant: 'default', icon: Loader2 },
      completed: { variant: 'outline', icon: CheckCircle2 },
      failed: { variant: 'destructive', icon: XCircle },
    };

    const { variant, icon: Icon } = variants[status];

    return (
      <Badge variant={variant} className="gap-1">
        <Icon className={`h-3 w-3 ${status === 'processing' ? 'animate-spin' : ''}`} />
        {status.charAt(0).toUpperCase() + status.slice(1)}
      </Badge>
    );
  };

  if (loading) {
    return (
      <div className="flex h-screen w-full bg-background overflow-hidden relative">
        <div className="relative z-10 h-full">
          <Sidebar />
        </div>
        <div className="flex items-center justify-center flex-1">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-screen w-full bg-background overflow-hidden relative">
      <BackgroundEffects />

      {/* Sidebar */}
      <div className="relative z-10 h-full">
        <Sidebar />
      </div>

      {/* Main Content */}
      <div className="flex-1 flex flex-col relative z-10 overflow-hidden">
        <div className="flex-1 overflow-y-auto p-8">
          <div className="max-w-6xl mx-auto">
            {/* Header */}
            <div className="mb-8">
              <div className="flex items-center gap-4 mb-4">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => navigate('/')}
                  className="gap-2"
                >
                  <ArrowLeft className="h-4 w-4" />
                  Back to Studio
                </Button>
              </div>
              <div className="flex items-center justify-between">
                <div>
                  <h1 className="text-4xl font-bold bg-gradient-to-r from-primary to-primary/60 bg-clip-text text-transparent mb-2">
                    Generation History
                  </h1>
                  <p className="text-muted-foreground">
                    View and manage all your motion transfer generations
                  </p>
                </div>
                <Button size="sm" variant="outline" onClick={loadGenerations}>
                  <Loader2 className="mr-2 h-4 w-4" />
                  Refresh
                </Button>
              </div>
            </div>

            {/* Content */}
            {generations.length === 0 ? (
              <Card>
                <CardContent className="flex flex-col items-center justify-center h-64">
                  <p className="text-muted-foreground text-center">
                    No generations yet. Create your first motion transfer to see it here!
                  </p>
                  <Button
                    className="mt-4"
                    onClick={() => navigate('/')}
                  >
                    Start Creating
                  </Button>
                </CardContent>
              </Card>
            ) : (
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {generations.map((generation) => (
                  <Card key={generation.id} className="overflow-hidden">
                    <CardHeader className="pb-3">
                      <div className="flex items-start justify-between">
                        <div className="space-y-1">
                          <CardTitle className="text-base">
                            Generation {generation.id.slice(0, 8)}
                          </CardTitle>
                          <CardDescription>
                            {new Date(generation.created_at).toLocaleDateString()} at{' '}
                            {new Date(generation.created_at).toLocaleTimeString()}
                          </CardDescription>
                        </div>
                        {getStatusBadge(generation.status)}
                      </div>
                    </CardHeader>
                    <CardContent className="space-y-3">
                      {generation.result_video_url && generation.status === 'completed' && (
                        <video
                          src={generation.result_video_url}
                          controls
                          className="w-full rounded-lg"
                          style={{ maxHeight: '300px' }}
                        />
                      )}
                      
                      <div className="grid grid-cols-2 gap-2 text-sm">
                        <div>
                          <span className="text-muted-foreground">Duration:</span>{' '}
                          <span>{generation.duration || 5}s</span>
                        </div>
                        {generation.credits_used && (
                          <div>
                            <span className="text-muted-foreground">Credits:</span>{' '}
                            <span>{generation.credits_used}</span>
                          </div>
                        )}
                        <div>
                          <span className="text-muted-foreground">Quality:</span>{' '}
                          <span>{generation.settings.quality}</span>
                        </div>
                        <div>
                          <span className="text-muted-foreground">Match Mode:</span>{' '}
                          <span className="capitalize">{generation.settings.matchMode}</span>
                        </div>
                      </div>

                      {generation.error_message && (
                        <div className="bg-destructive/10 text-destructive p-3 rounded-md text-sm">
                          {generation.error_message}
                        </div>
                      )}

                      <div className="flex gap-2 pt-2">
                        {generation.result_video_url && generation.status === 'completed' && (
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => handleDownload(generation.result_video_url!)}
                            className="flex-1"
                          >
                            <Download className="mr-2 h-4 w-4" />
                            Download
                          </Button>
                        )}
                        
                        <AlertDialog>
                          <AlertDialogTrigger asChild>
                            <Button size="sm" variant="destructive" className={generation.result_video_url ? '' : 'flex-1'}>
                              <Trash2 className="mr-2 h-4 w-4" />
                              Delete
                            </Button>
                          </AlertDialogTrigger>
                          <AlertDialogContent>
                            <AlertDialogHeader>
                              <AlertDialogTitle>Delete generation?</AlertDialogTitle>
                              <AlertDialogDescription>
                                This action cannot be undone. This will permanently delete this generation.
                              </AlertDialogDescription>
                            </AlertDialogHeader>
                            <AlertDialogFooter>
                              <AlertDialogCancel>Cancel</AlertDialogCancel>
                              <AlertDialogAction onClick={() => handleDelete(generation.id)}>
                                Delete
                              </AlertDialogAction>
                            </AlertDialogFooter>
                          </AlertDialogContent>
                        </AlertDialog>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default HistoryPage;
