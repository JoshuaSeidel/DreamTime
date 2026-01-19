import { useState } from 'react';
import { ScanFace, Fingerprint, Loader2, Moon } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useBiometricStore } from '@/store/biometricStore';

export default function BiometricLockScreen() {
  const { unlockWithBiometric } = useBiometricStore();
  const [isUnlocking, setIsUnlocking] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleUnlock = async () => {
    setIsUnlocking(true);
    setError(null);

    try {
      const success = await unlockWithBiometric();
      if (!success) {
        setError('Verification failed. Please try again.');
      }
    } catch {
      setError('An error occurred. Please try again.');
    } finally {
      setIsUnlocking(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-background z-50 flex flex-col items-center justify-center p-6">
      {/* Logo/Icon */}
      <div className="w-20 h-20 rounded-2xl bg-primary/10 flex items-center justify-center mb-6">
        <Moon className="w-10 h-10 text-primary" />
      </div>

      <h1 className="text-2xl font-bold mb-2">DreamTime</h1>
      <p className="text-muted-foreground text-center mb-8">
        Unlock with Face ID or Touch ID to continue
      </p>

      {/* Unlock Button */}
      <Button
        size="lg"
        onClick={handleUnlock}
        disabled={isUnlocking}
        className="w-full max-w-xs h-14 text-lg gap-3"
      >
        {isUnlocking ? (
          <Loader2 className="w-6 h-6 animate-spin" />
        ) : (
          <>
            <ScanFace className="w-6 h-6" />
            Unlock
          </>
        )}
      </Button>

      {/* Alternative: fingerprint hint for Touch ID devices */}
      <p className="text-xs text-muted-foreground mt-4 flex items-center gap-1">
        <Fingerprint className="w-4 h-4" />
        Use Face ID or Touch ID
      </p>

      {/* Error message */}
      {error && (
        <p className="text-sm text-destructive mt-4 text-center">{error}</p>
      )}
    </div>
  );
}
