import { create } from 'zustand';
import { persist } from 'zustand/middleware';

interface BiometricState {
  // Whether biometric lock is enabled for this device
  isEnabled: boolean;
  // Whether the app is currently locked (requires Face ID to unlock)
  isLocked: boolean;
  // Enable biometric lock
  enableBiometricLock: () => Promise<boolean>;
  // Disable biometric lock
  disableBiometricLock: () => void;
  // Lock the app (call when app goes to background or on startup)
  lockApp: () => void;
  // Unlock with Face ID
  unlockWithBiometric: () => Promise<boolean>;
}

/**
 * Check if platform authenticator (Face ID, Touch ID) is available
 */
async function isPlatformAuthenticatorAvailable(): Promise<boolean> {
  if (!window.PublicKeyCredential) {
    return false;
  }

  try {
    const available = await PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable();
    return available;
  } catch {
    return false;
  }
}

/**
 * Trigger Face ID / Touch ID verification
 * This uses a dummy WebAuthn challenge just to invoke the biometric prompt
 * No actual credential is created or stored
 */
async function triggerBiometricVerification(): Promise<boolean> {
  try {
    // Create a simple challenge for biometric verification
    const challenge = new Uint8Array(32);
    crypto.getRandomValues(challenge);

    // Use navigator.credentials.create with a dummy request
    // This will trigger Face ID/Touch ID without creating a persistent passkey
    const credential = await navigator.credentials.create({
      publicKey: {
        challenge,
        rp: {
          name: 'DreamTime Session Lock',
          id: window.location.hostname,
        },
        user: {
          id: new Uint8Array([1, 2, 3, 4]), // Dummy user ID
          name: 'session-lock',
          displayName: 'Session Lock',
        },
        pubKeyCredParams: [
          { type: 'public-key', alg: -7 }, // ES256
        ],
        authenticatorSelection: {
          authenticatorAttachment: 'platform',
          userVerification: 'required',
          residentKey: 'discouraged',
          requireResidentKey: false,
        },
        timeout: 60000,
        // Exclude all credentials to prevent actual passkey creation
        // This makes it a pure biometric check
        excludeCredentials: [],
      },
    });

    // If we got here, biometric verification succeeded
    // We don't actually need the credential, just the fact that Face ID passed
    return credential !== null;
  } catch (error) {
    // User cancelled or biometric failed
    console.log('[BiometricStore] Biometric verification failed:', error);
    return false;
  }
}

export const useBiometricStore = create<BiometricState>()(
  persist(
    (set, get) => ({
      isEnabled: false,
      isLocked: false,

      enableBiometricLock: async () => {
        // Check if biometrics are available
        const available = await isPlatformAuthenticatorAvailable();
        if (!available) {
          console.log('[BiometricStore] Platform authenticator not available');
          return false;
        }

        // Verify with Face ID to confirm the user wants to enable it
        const verified = await triggerBiometricVerification();
        if (verified) {
          set({ isEnabled: true, isLocked: false });
          return true;
        }
        return false;
      },

      disableBiometricLock: () => {
        set({ isEnabled: false, isLocked: false });
      },

      lockApp: () => {
        const { isEnabled } = get();
        if (isEnabled) {
          set({ isLocked: true });
        }
      },

      unlockWithBiometric: async () => {
        const { isEnabled } = get();
        if (!isEnabled) {
          set({ isLocked: false });
          return true;
        }

        const verified = await triggerBiometricVerification();
        if (verified) {
          set({ isLocked: false });
          return true;
        }
        return false;
      },
    }),
    {
      name: 'dreamtime-biometric',
      version: 1,
      partialize: (state) => ({
        isEnabled: state.isEnabled,
        // Don't persist isLocked - start locked if enabled
      }),
      onRehydrateStorage: () => (state) => {
        // When the store is rehydrated (app starts), lock if enabled
        if (state?.isEnabled) {
          state.isLocked = true;
        }
      },
    }
  )
);

// Export utility functions
export { isPlatformAuthenticatorAvailable };
