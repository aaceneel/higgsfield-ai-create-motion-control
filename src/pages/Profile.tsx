import { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Separator } from '@/components/ui/separator';
import { Sidebar } from '@/components/studio/Sidebar';
import { Video, User, Key, LogOut } from 'lucide-react';
import { supabase } from '@/services/supabase';
import { toast } from 'sonner';
import { BackgroundEffects } from '@/components/ui/background-effects';

export default function Profile() {
  const { user, signOut, updatePassword } = useAuth();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [klingAccessKey, setKlingAccessKey] = useState('');
  const [klingSecretKey, setKlingSecretKey] = useState('');

  useEffect(() => {
    if (user) {
      loadUserSettings();
    }
  }, [user]);

  const loadUserSettings = async () => {
    if (!user) return;
    
    const { data, error } = await supabase
      .from('user_settings')
      .select('kling_access_key, kling_secret_key')
      .eq('user_id', user.id)
      .single();
    
    if (!error && data) {
      setKlingAccessKey(data.kling_access_key || '');
      setKlingSecretKey(data.kling_secret_key || '');
    }
  };

  const handlePasswordUpdate = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (newPassword !== confirmPassword) {
      toast.error('Passwords do not match');
      return;
    }
    
    setLoading(true);
    await updatePassword(newPassword);
    setLoading(false);
    setNewPassword('');
    setConfirmPassword('');
  };

  const handleApiKeysUpdate = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!user) return;
    
    setLoading(true);
    
    const { error } = await supabase
      .from('user_settings')
      .update({
        kling_access_key: klingAccessKey || null,
        kling_secret_key: klingSecretKey || null,
      })
      .eq('user_id', user.id);
    
    setLoading(false);
    
    if (error) {
      toast.error('Failed to update API keys', { description: error.message });
    } else {
      toast.success('API keys updated successfully');
    }
  };

  const handleSignOut = async () => {
    await signOut();
    navigate('/login');
  };

  return (
    <div className="flex h-screen w-full bg-background overflow-hidden relative">
      <BackgroundEffects />
      
      <Sidebar />
      
      <div className="flex-1 overflow-auto p-8 relative z-10">
        <div className="max-w-4xl mx-auto space-y-6">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold flex items-center gap-2">
                <User className="h-8 w-8" />
                Profile Settings
              </h1>
              <p className="text-muted-foreground mt-1">
                Manage your account settings and preferences
              </p>
            </div>
            <Button variant="outline" onClick={handleSignOut}>
              <LogOut className="mr-2 h-4 w-4" />
              Sign out
            </Button>
          </div>

          <Tabs defaultValue="account" className="w-full">
            <TabsList className="grid w-full grid-cols-3">
              <TabsTrigger value="account">Account</TabsTrigger>
              <TabsTrigger value="password">Password</TabsTrigger>
              <TabsTrigger value="api">API Keys</TabsTrigger>
            </TabsList>

            <TabsContent value="account" className="space-y-4">
              <Card>
                <CardHeader>
                  <CardTitle>Account Information</CardTitle>
                  <CardDescription>
                    Your account details and preferences
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="space-y-2">
                    <Label>Email</Label>
                    <Input value={user?.email || ''} disabled />
                  </div>
                  <div className="space-y-2">
                    <Label>User ID</Label>
                    <Input value={user?.id || ''} disabled className="font-mono text-sm" />
                  </div>
                  <Separator />
                  <div className="space-y-2">
                    <Label>Account created</Label>
                    <Input 
                      value={user?.created_at ? new Date(user.created_at).toLocaleDateString() : ''} 
                      disabled 
                    />
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="password" className="space-y-4">
              <Card>
                <CardHeader>
                  <CardTitle>Change Password</CardTitle>
                  <CardDescription>
                    Update your password to keep your account secure
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <form onSubmit={handlePasswordUpdate} className="space-y-4">
                    <div className="space-y-2">
                      <Label htmlFor="new-password">New Password</Label>
                      <Input
                        id="new-password"
                        type="password"
                        placeholder="Min. 6 characters"
                        value={newPassword}
                        onChange={(e) => setNewPassword(e.target.value)}
                        required
                        minLength={6}
                        disabled={loading}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="confirm-new-password">Confirm New Password</Label>
                      <Input
                        id="confirm-new-password"
                        type="password"
                        value={confirmPassword}
                        onChange={(e) => setConfirmPassword(e.target.value)}
                        required
                        disabled={loading}
                      />
                      {newPassword && confirmPassword && newPassword !== confirmPassword && (
                        <p className="text-sm text-destructive">Passwords do not match</p>
                      )}
                    </div>
                    <Button 
                      type="submit" 
                      disabled={loading || newPassword !== confirmPassword || !newPassword}
                    >
                      {loading ? 'Updating...' : 'Update Password'}
                    </Button>
                  </form>
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="api" className="space-y-4">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Key className="h-5 w-5" />
                    Kling AI API Keys
                  </CardTitle>
                  <CardDescription>
                    Store your own Kling AI API keys (optional). If not provided, the app will use shared keys.
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <form onSubmit={handleApiKeysUpdate} className="space-y-4">
                    <div className="space-y-2">
                      <Label htmlFor="access-key">Access Key</Label>
                      <Input
                        id="access-key"
                        type="password"
                        placeholder="Your Kling AI Access Key"
                        value={klingAccessKey}
                        onChange={(e) => setKlingAccessKey(e.target.value)}
                        disabled={loading}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="secret-key">Secret Key</Label>
                      <Input
                        id="secret-key"
                        type="password"
                        placeholder="Your Kling AI Secret Key"
                        value={klingSecretKey}
                        onChange={(e) => setKlingSecretKey(e.target.value)}
                        disabled={loading}
                      />
                    </div>
                    <div className="bg-muted p-4 rounded-lg">
                      <p className="text-sm text-muted-foreground">
                        Get your API keys from{' '}
                        <a 
                          href="https://klingai.com/" 
                          target="_blank" 
                          rel="noopener noreferrer"
                          className="text-primary hover:underline"
                        >
                          klingai.com
                        </a>
                      </p>
                    </div>
                    <Button type="submit" disabled={loading}>
                      {loading ? 'Saving...' : 'Save API Keys'}
                    </Button>
                  </form>
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>
        </div>
      </div>
    </div>
  );
}
