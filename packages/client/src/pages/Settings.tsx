import { useState, useEffect, useCallback } from 'react';
import { User, Baby, Bell, Moon, Sun, Monitor, LogOut, ChevronRight, Globe, KeyRound, Trash2, Loader2 } from 'lucide-react';
import { useAuthStore } from '../store/authStore';
import { useTheme } from '../components/ThemeProvider';
import AddChildDialog from '../components/AddChildDialog';
import EditChildDialog from '../components/EditChildDialog';
import CaregiverManager from '../components/CaregiverManager';
import { useToast } from '@/components/ui/toaster';
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
import { useBiometricStore, isPlatformAuthenticatorAvailable } from '@/store/biometricStore';
import {
  isPushSupported,
  getNotificationPermission,
  requestNotificationPermission,
  subscribeToPush,
  unsubscribeFromPush,
  isSubscribedToPush,
  isRunningAsPWA,
  sendServerTestNotification,
} from '@/lib/notifications';
import { getChildren, deleteChild, type Child } from '@/lib/api';

export default function Settings() {
  const { user, logout, accessToken } = useAuthStore();
  const { theme, setTheme, resolvedTheme } = useTheme();
  const toast = useToast();
  const { isEnabled: biometricEnabled, enableBiometricLock, disableBiometricLock } = useBiometricStore();

  // Biometric state
  const [biometricSupported, setBiometricSupported] = useState(false);
  const [biometricCheckDone, setBiometricCheckDone] = useState(false);
  const [isTogglingBiometric, setIsTogglingBiometric] = useState(false);

  // Push notification state
  const [pushSupported, setPushSupported] = useState(false);
  const [pushPermission, setPushPermission] = useState<NotificationPermission | 'unsupported'>('default');
  const [isPushSubscribed, setIsPushSubscribed] = useState(false);
  const [isTogglingPush, setIsTogglingPush] = useState(false);
  const [isSendingTestNotification, setIsSendingTestNotification] = useState(false);
  const [isPWA, setIsPWA] = useState(false);

  // Children state
  const [children, setChildren] = useState<Child[]>([]);
  const [isLoadingChildren, setIsLoadingChildren] = useState(false);
  const [deletingChildId, setDeletingChildId] = useState<string | null>(null);

  // Load children
  const loadChildren = useCallback(async () => {
    if (!accessToken) return;

    setIsLoadingChildren(true);
    try {
      const result = await getChildren(accessToken);
      if (result.success && result.data) {
        setChildren(result.data);
      }
    } catch (err) {
      console.error('[Settings] Failed to load children:', err);
    } finally {
      setIsLoadingChildren(false);
    }
  }, [accessToken]);

  useEffect(() => {
    if (accessToken) {
      loadChildren();
    }
  }, [accessToken, loadChildren]);

  const handleDeleteChild = async (childId: string, childName: string) => {
    if (!accessToken) return;

    // Confirm deletion
    if (!confirm(`Are you sure you want to delete ${childName}? This will remove all their sleep data.`)) {
      return;
    }

    setDeletingChildId(childId);
    try {
      const result = await deleteChild(accessToken, childId);
      if (result.success) {
        setChildren((prev) => prev.filter((c) => c.id !== childId));
        toast.success('Child removed', `${childName} has been removed`);
      } else {
        toast.error('Delete failed', result.error?.message || 'Failed to remove child');
      }
    } catch (err) {
      console.error('[Settings] Delete child error:', err);
      toast.error('Delete failed', 'An unexpected error occurred');
    } finally {
      setDeletingChildId(null);
    }
  };

  const formatBirthDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString(undefined, {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
  };

  const calculateAge = (birthDate: string) => {
    const birth = new Date(birthDate);
    const now = new Date();
    const months = (now.getFullYear() - birth.getFullYear()) * 12 + (now.getMonth() - birth.getMonth());
    if (months < 12) {
      return `${months} month${months !== 1 ? 's' : ''} old`;
    }
    const years = Math.floor(months / 12);
    const remainingMonths = months % 12;
    if (remainingMonths === 0) {
      return `${years} year${years !== 1 ? 's' : ''} old`;
    }
    return `${years}y ${remainingMonths}m old`;
  };

  // Check biometric and push support
  useEffect(() => {
    const checkSupport = async () => {
      // Biometric check
      console.log('[Settings] Checking biometric support...');
      const platformAvailable = await isPlatformAuthenticatorAvailable();
      console.log('[Settings] Platform authenticator available:', platformAvailable);
      setBiometricSupported(platformAvailable);
      setBiometricCheckDone(true);

      // Push notification check
      console.log('[Settings] Checking push notification support...');
      const pushIsSupported = isPushSupported();
      console.log('[Settings] Push supported:', pushIsSupported);
      setPushSupported(pushIsSupported);

      const permission = getNotificationPermission();
      console.log('[Settings] Push permission:', permission);
      setPushPermission(permission);

      const isPwaMode = isRunningAsPWA();
      console.log('[Settings] Running as PWA:', isPwaMode);
      setIsPWA(isPwaMode);

      if (pushIsSupported) {
        const subscribed = await isSubscribedToPush();
        console.log('[Settings] Currently subscribed:', subscribed);
        setIsPushSubscribed(subscribed);
      }
    };
    checkSupport();
  }, []);

  const handleToggleBiometric = async () => {
    setIsTogglingBiometric(true);

    try {
      if (biometricEnabled) {
        disableBiometricLock();
        toast.success('Passkey lock disabled', 'App lock has been turned off');
      } else {
        const success = await enableBiometricLock();
        if (success) {
          toast.success('Passkey lock enabled', 'App will require passkey to unlock');
        } else {
          toast.error('Setup failed', 'Could not create passkey. Please try again.');
        }
      }
    } catch (err) {
      console.error('[Settings] Biometric toggle error:', err);
      toast.error('Error', 'An unexpected error occurred');
    } finally {
      setIsTogglingBiometric(false);
    }
  };

  const handleTogglePush = async () => {
    console.log('[Settings] Toggle push called, current state:', isPushSubscribed);

    if (!accessToken) {
      toast.error('Not authenticated', 'Please log in again');
      return;
    }

    setIsTogglingPush(true);

    try {
      if (isPushSubscribed) {
        // Unsubscribe
        console.log('[Settings] Unsubscribing from push...');
        const result = await unsubscribeFromPush(accessToken);
        if (result.success) {
          setIsPushSubscribed(false);
          toast.success('Notifications disabled', 'You will no longer receive push notifications');
        } else {
          toast.error('Failed to disable', result.error || 'Could not disable notifications');
        }
      } else {
        // Request permission first
        console.log('[Settings] Requesting notification permission...');
        const permResult = await requestNotificationPermission();
        console.log('[Settings] Permission result:', permResult);
        setPushPermission(permResult.permission);

        if (!permResult.success) {
          if (permResult.permission === 'denied') {
            toast.error('Permission denied', 'Enable notifications in your device settings');
          } else if (permResult.permission === 'unsupported') {
            toast.error('Not supported', 'Push notifications are not available on this device');
          } else {
            toast.info('Permission required', 'Please allow notifications when prompted');
          }
          return;
        }

        // Subscribe to push
        console.log('[Settings] Subscribing to push...');
        const subResult = await subscribeToPush(accessToken);
        if (subResult.success) {
          setIsPushSubscribed(true);
          toast.success('Notifications enabled', 'You will receive reminders for sleep times');
        } else {
          toast.error('Subscription failed', subResult.error || 'Could not enable notifications');
        }
      }
    } catch (err) {
      console.error('[Settings] Push toggle error:', err);
      toast.error('Error', 'An unexpected error occurred');
    } finally {
      setIsTogglingPush(false);
    }
  };

  const handleSendTestNotification = async () => {
    if (!accessToken) {
      toast.error('Not authenticated', 'Please log in again');
      return;
    }

    setIsSendingTestNotification(true);

    try {
      const result = await sendServerTestNotification(accessToken);
      if (result.success) {
        toast.success('Test sent', `Notification sent to ${result.sent} device(s)`);
      } else {
        toast.error('Test failed', result.error || 'Could not send test notification');
      }
    } catch (err) {
      console.error('[Settings] Test notification error:', err);
      toast.error('Error', 'An unexpected error occurred');
    } finally {
      setIsSendingTestNotification(false);
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

  return (
    <div className="min-h-screen bg-background pb-20 md:pb-0">
      <header className="sticky top-0 z-10 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 border-b border-border px-4 py-4 md:border-b-0">
        <h1 className="text-xl font-bold">Settings</h1>
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
          <CardContent className="space-y-4">
            {/* Loading state */}
            {isLoadingChildren ? (
              <div className="flex items-center justify-center py-4">
                <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
              </div>
            ) : children.length > 0 ? (
              <div className="space-y-3">
                {children.map((child) => (
                  <div
                    key={child.id}
                    className="flex items-center justify-between p-3 rounded-lg bg-muted/50"
                  >
                    <div className="flex items-center gap-3">
                      <div className="rounded-full bg-primary/10 p-2">
                        <Baby className="w-4 h-4 text-primary" />
                      </div>
                      <div>
                        <p className="font-medium text-sm">{child.name}</p>
                        <p className="text-xs text-muted-foreground">
                          {calculateAge(child.birthDate)} · Born {formatBirthDate(child.birthDate)}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-1">
                      <EditChildDialog child={child} onChildUpdated={loadChildren} />
                      <Button
                        variant="ghost"
                        size="icon"
                        className="text-destructive hover:text-destructive hover:bg-destructive/10"
                        onClick={() => handleDeleteChild(child.id, child.name)}
                        disabled={deletingChildId === child.id}
                      >
                        {deletingChildId === child.id ? (
                          <Loader2 className="w-4 h-4 animate-spin" />
                        ) : (
                          <Trash2 className="w-4 h-4" />
                        )}
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-sm text-muted-foreground text-center py-2">
                No children added yet
              </p>
            )}

            {/* Add Child Button */}
            <AddChildDialog onChildAdded={loadChildren} />
          </CardContent>
        </Card>

        {/* Caregiver Management */}
        <CaregiverManager />

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
                  <p className="text-sm text-muted-foreground">
                    {!pushSupported
                      ? 'Not available on this device'
                      : !isPWA
                      ? 'Install as app for notifications'
                      : pushPermission === 'denied'
                      ? 'Blocked in device settings'
                      : 'Get reminders for sleep times'}
                  </p>
                </div>
              </div>
              {isTogglingPush ? (
                <Loader2 className="w-5 h-5 animate-spin text-primary" />
              ) : (
                <Switch
                  checked={isPushSubscribed}
                  onCheckedChange={handleTogglePush}
                  disabled={!pushSupported || pushPermission === 'denied'}
                />
              )}
            </div>

            {/* Test Notification Button - only show when subscribed */}
            {isPushSubscribed && (
              <div className="flex justify-end">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleSendTestNotification}
                  disabled={isSendingTestNotification}
                >
                  {isSendingTestNotification ? (
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  ) : (
                    <Bell className="w-4 h-4 mr-2" />
                  )}
                  Send Test
                </Button>
              </div>
            )}

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

        {/* Passkey Lock */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <KeyRound className="w-4 h-4" />
              Passkey Lock
            </CardTitle>
            <CardDescription>
              Lock the app with a passkey for extra security
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {!biometricCheckDone ? (
              <div className="flex items-center justify-center py-4">
                <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
                <span className="ml-2 text-sm text-muted-foreground">Checking device support...</span>
              </div>
            ) : !biometricSupported ? (
              <div className="text-center py-4">
                <p className="text-sm text-muted-foreground">
                  Passkey is not available on this device.
                </p>
                <p className="text-xs text-muted-foreground mt-1">
                  Requires iOS Safari or Chrome with biometric hardware.
                </p>
              </div>
            ) : (
              <div className="flex justify-between items-center">
                <div className="flex items-center gap-3">
                  <div className="rounded-full bg-primary/10 p-2">
                    <KeyRound className="w-4 h-4 text-primary" />
                  </div>
                  <div>
                    <p className="font-medium">App Lock</p>
                    <p className="text-sm text-muted-foreground">
                      {biometricEnabled
                        ? 'Passkey required to open app'
                        : 'Require passkey to open the app'}
                    </p>
                  </div>
                </div>
                {isTogglingBiometric ? (
                  <Loader2 className="w-5 h-5 animate-spin text-primary" />
                ) : (
                  <Switch
                    checked={biometricEnabled}
                    onCheckedChange={handleToggleBiometric}
                  />
                )}
              </div>
            )}
          </CardContent>
        </Card>

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
    </div>
  );
}
