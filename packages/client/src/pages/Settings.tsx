import { useState, useEffect } from 'react';
import { User, Baby, Bell, Moon, Sun, Monitor, LogOut, Plus, ChevronRight, Globe, Fingerprint, Trash2, Loader2, Smartphone } from 'lucide-react';
import { useAuthStore } from '../store/authStore';
import { useTheme } from '../components/ThemeProvider';
import BottomNav from '../components/BottomNav';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { Separator } from '@/components/ui/separator';
import { cn } from '@/lib/utils';
import {
  isWebAuthnSupported,
  isPlatformAuthenticatorAvailable,
  registerPasskey,
  listPasskeys,
  deletePasskey,
  getDeviceName,
} from '@/lib/webauthn';

interface PasskeyCredential {
  id: string;
  friendlyName: string | null;
  deviceType: string;
  createdAt: string;
  lastUsedAt: string | null;
}

export default function Settings() {
  const { user, logout, accessToken } = useAuthStore();
  const { theme, setTheme, resolvedTheme } = useTheme();

  // Biometric state
  const [biometricSupported, setBiometricSupported] = useState(false);
  const [passkeys, setPasskeys] = useState<PasskeyCredential[]>([]);
  const [isLoadingPasskeys, setIsLoadingPasskeys] = useState(false);
  const [isRegistering, setIsRegistering] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [biometricError, setBiometricError] = useState<string | null>(null);
  const [biometricSuccess, setBiometricSuccess] = useState<string | null>(null);

  // Check biometric support and load passkeys
  useEffect(() => {
    const checkSupport = async () => {
      const supported = isWebAuthnSupported();
      const platformAvailable = await isPlatformAuthenticatorAvailable();
      setBiometricSupported(supported && platformAvailable);
    };
    checkSupport();
  }, []);

  useEffect(() => {
    if (accessToken) {
      loadPasskeys();
    }
  }, [accessToken]);

  const loadPasskeys = async () => {
    if (!accessToken) return;

    setIsLoadingPasskeys(true);
    try {
      const result = await listPasskeys(accessToken);
      if (result.success && result.data) {
        setPasskeys(result.data);
      }
    } catch (err) {
      console.error('Failed to load passkeys:', err);
    } finally {
      setIsLoadingPasskeys(false);
    }
  };

  const handleRegisterPasskey = async () => {
    if (!accessToken) return;

    setIsRegistering(true);
    setBiometricError(null);
    setBiometricSuccess(null);

    try {
      const deviceName = `${getDeviceName()} Face ID`;
      const result = await registerPasskey(accessToken, deviceName);

      if (result.success) {
        setBiometricSuccess('Face ID has been set up successfully!');
        await loadPasskeys();
      } else {
        setBiometricError(result.error || 'Failed to set up Face ID');
      }
    } catch (err) {
      setBiometricError('Failed to set up Face ID');
    } finally {
      setIsRegistering(false);
    }
  };

  const handleDeletePasskey = async (credentialId: string) => {
    if (!accessToken) return;

    setDeletingId(credentialId);
    setBiometricError(null);

    try {
      const result = await deletePasskey(accessToken, credentialId);
      if (result.success) {
        setPasskeys((prev) => prev.filter((p) => p.id !== credentialId));
      } else {
        setBiometricError(result.error || 'Failed to remove passkey');
      }
    } catch (err) {
      setBiometricError('Failed to remove passkey');
    } finally {
      setDeletingId(null);
    }
  };

  const handleLogout = () => {
    logout();
  };

  const themeOptions = [
    { value: 'light' as const, label: 'Light', icon: Sun },
    { value: 'dark' as const, label: 'Dark', icon: Moon },
    { value: 'system' as const, label: 'System', icon: Monitor },
  ];

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString(undefined, {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
  };

  return (
    <div className="min-h-screen bg-background pb-20">
      <header className="sticky top-0 z-10 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 border-b border-border px-4 py-4">
        <h1 className="text-xl font-bold text-primary">Settings</h1>
        <p className="text-sm text-muted-foreground">Manage your account and preferences</p>
      </header>

      <main className="px-4 py-6 space-y-6">
        {/* Profile Card */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <User className="w-4 h-4" />
              Profile
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex justify-between items-center">
              <span className="text-muted-foreground">Name</span>
              <span className="font-medium">{user?.name ?? 'Demo User'}</span>
            </div>
            <Separator />
            <div className="flex justify-between items-center">
              <span className="text-muted-foreground">Email</span>
              <span className="font-medium">{user?.email ?? 'demo@example.com'}</span>
            </div>
            <Separator />
            <div className="flex justify-between items-center">
              <div className="flex items-center gap-2">
                <Globe className="w-4 h-4 text-muted-foreground" />
                <span className="text-muted-foreground">Timezone</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="font-medium">{user?.timezone ?? 'America/New_York'}</span>
                <ChevronRight className="w-4 h-4 text-muted-foreground" />
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Children Card */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <Baby className="w-4 h-4" />
              Children
            </CardTitle>
            <CardDescription>Manage your children's profiles</CardDescription>
          </CardHeader>
          <CardContent>
            <Button
              variant="outline"
              className="w-full border-dashed"
            >
              <Plus className="w-4 h-4 mr-2" />
              Add Child
            </Button>
          </CardContent>
        </Card>

        {/* App Settings */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">App Settings</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Push Notifications */}
            <div className="flex justify-between items-center">
              <div className="flex items-center gap-3">
                <div className="rounded-full bg-primary/10 p-2">
                  <Bell className="w-4 h-4 text-primary" />
                </div>
                <div>
                  <p className="font-medium">Push Notifications</p>
                  <p className="text-sm text-muted-foreground">Get reminders for sleep times</p>
                </div>
              </div>
              <Switch />
            </div>

            <Separator />

            {/* Theme Selection */}
            <div className="space-y-3">
              <div className="flex items-center gap-3">
                <div className="rounded-full bg-primary/10 p-2">
                  {resolvedTheme === 'dark' ? (
                    <Moon className="w-4 h-4 text-primary" />
                  ) : (
                    <Sun className="w-4 h-4 text-primary" />
                  )}
                </div>
                <div>
                  <p className="font-medium">Appearance</p>
                  <p className="text-sm text-muted-foreground">Choose your preferred theme</p>
                </div>
              </div>

              <div className="grid grid-cols-3 gap-2">
                {themeOptions.map((option) => {
                  const Icon = option.icon;
                  return (
                    <button
                      key={option.value}
                      onClick={() => setTheme(option.value)}
                      className={cn(
                        'flex flex-col items-center gap-2 p-3 rounded-lg border-2 transition-all',
                        theme === option.value
                          ? 'border-primary bg-primary/5'
                          : 'border-border hover:border-primary/50'
                      )}
                    >
                      <Icon className={cn(
                        'w-5 h-5',
                        theme === option.value ? 'text-primary' : 'text-muted-foreground'
                      )} />
                      <span className={cn(
                        'text-xs font-medium',
                        theme === option.value ? 'text-primary' : 'text-muted-foreground'
                      )}>
                        {option.label}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Face ID & Security */}
        {biometricSupported && (
          <Card>
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <Fingerprint className="w-4 h-4" />
                Face ID & Security
              </CardTitle>
              <CardDescription>
                Use Face ID for quick and secure sign-in
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Error/Success Messages */}
              {biometricError && (
                <div className="p-3 rounded-md bg-destructive/10 text-destructive text-sm">
                  {biometricError}
                </div>
              )}
              {biometricSuccess && (
                <div className="p-3 rounded-md bg-green-500/10 text-green-600 dark:text-green-400 text-sm">
                  {biometricSuccess}
                </div>
              )}

              {/* Registered Passkeys */}
              {isLoadingPasskeys ? (
                <div className="flex items-center justify-center py-4">
                  <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
                </div>
              ) : passkeys.length > 0 ? (
                <div className="space-y-3">
                  <p className="text-sm text-muted-foreground">
                    Registered devices:
                  </p>
                  {passkeys.map((passkey) => (
                    <div
                      key={passkey.id}
                      className="flex items-center justify-between p-3 rounded-lg bg-muted/50"
                    >
                      <div className="flex items-center gap-3">
                        <div className="rounded-full bg-primary/10 p-2">
                          <Smartphone className="w-4 h-4 text-primary" />
                        </div>
                        <div>
                          <p className="font-medium text-sm">
                            {passkey.friendlyName || passkey.deviceType}
                          </p>
                          <p className="text-xs text-muted-foreground">
                            Added {formatDate(passkey.createdAt)}
                            {passkey.lastUsedAt && (
                              <> · Last used {formatDate(passkey.lastUsedAt)}</>
                            )}
                          </p>
                        </div>
                      </div>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="text-destructive hover:text-destructive hover:bg-destructive/10"
                        onClick={() => handleDeletePasskey(passkey.id)}
                        disabled={deletingId === passkey.id}
                      >
                        {deletingId === passkey.id ? (
                          <Loader2 className="w-4 h-4 animate-spin" />
                        ) : (
                          <Trash2 className="w-4 h-4" />
                        )}
                      </Button>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-sm text-muted-foreground">
                  No Face ID set up yet. Add Face ID to sign in faster.
                </p>
              )}

              {/* Add Face ID Button */}
              <Button
                onClick={handleRegisterPasskey}
                variant="outline"
                className="w-full"
                disabled={isRegistering}
              >
                {isRegistering ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Setting up Face ID...
                  </>
                ) : (
                  <>
                    <Plus className="w-4 h-4 mr-2" />
                    {passkeys.length > 0 ? 'Add Another Device' : 'Set Up Face ID'}
                  </>
                )}
              </Button>
            </CardContent>
          </Card>
        )}

        {/* Logout */}
        <Button
          onClick={handleLogout}
          variant="destructive"
          className="w-full"
          size="lg"
        >
          <LogOut className="w-4 h-4 mr-2" />
          Sign Out
        </Button>

        {/* Version */}
        <p className="text-center text-sm text-muted-foreground">
          DreamTime v0.1.0
        </p>
      </main>

      <BottomNav />
    </div>
  );
}
