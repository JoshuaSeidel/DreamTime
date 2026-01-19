import { create } from 'zustand';
import { persist } from 'zustand/middleware';

interface BiometricState {
  // Whether biometric lock is enabled for this device
  isEnabled: boolean;
  // Whether the app is currently locked (requires Face ID to unlock)
  isLocked: boolean;
  // Stored credential ID for biometric verification (base64 encoded)
  credentialId: string | null;
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
 * Convert ArrayBuffer to base64 string for storage
 */
function arrayBufferToBase64(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);
  let binary = '';
  for (let i = 0; i < bytes.byteLength; i++) {
    binary += String.fromCharCode(bytes[i] as number);
  }
  return btoa(binary);
}

/**
 * Convert base64 string back to ArrayBuffer
 */
function base64ToArrayBuffer(base64: string): ArrayBuffer {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes.buffer;
}

/**
 * Create a credential for biometric lock (called once when enabling)
 * Returns the credential ID to store for later verification
 */
async function createBiometricCredential(): Promise<string | null> {
  try {
    const challenge = new Uint8Array(32);
    crypto.getRandomValues(challenge);

    const credential = await navigator.credentials.create({
      publicKey: {
        challenge,
        rp: {
          name: 'DreamTime',
          id: window.location.hostname,
        },
        user: {
          id: new Uint8Array([1, 2, 3, 4]),
          name: 'session-lock',
          displayName: 'DreamTime Session Lock',
        },
        pubKeyCredParams: [
          { type: 'public-key', alg: -7 }, // ES256
          { type: 'public-key', alg: -257 }, // RS256
        ],
        authenticatorSelection: {
          authenticatorAttachment: 'platform',
          userVerification: 'required',
          residentKey: 'discouraged',
          requireResidentKey: false,
        },
        timeout: 60000,
      },
    });

    if (credential && credential instanceof PublicKeyCredential) {
      // Store the credential ID so we can use it for verification later
      return arrayBufferToBase64(credential.rawId);
    }
    return null;
  } catch (error) {
    console.log('[BiometricStore] Failed to create biometric credential:', error);
    return null;
  }
}

/**
 * Verify with Face ID using stored credential
 */
async function verifyWithBiometric(credentialId: string): Promise<boolean> {
  try {
    const challenge = new Uint8Array(32);
    crypto.getRandomValues(challenge);

    const credential = await navigator.credentials.get({
      publicKey: {
        challenge,
        rpId: window.location.hostname,
        allowCredentials: [
          {
            type: 'public-key',
            id: base64ToArrayBuffer(credentialId),
            transports: ['internal'],
          },
        ],
        userVerification: 'required',
        timeout: 60000,
      },
    });

    return credential !== null;
  } catch (error) {
    console.log('[BiometricStore] Biometric verification failed:', error);
    return false;
  }
}

export const useBiometricStore = create<BiometricState>()(
  persist(
    (set, get) => ({
      isEnabled: false,
      isLocked: false,
      credentialId: null,

      enableBiometricLock: async () => {
        // Check if biometrics are available
        const available = await isPlatformAuthenticatorAvailable();
        if (!available) {
          console.log('[BiometricStore] Platform authenticator not available');
          return false;
        }

        // Create a credential for biometric verification
        const credentialId = await createBiometricCredential();
        if (credentialId) {
          set({ isEnabled: true, isLocked: false, credentialId });
          return true;
        }
        return false;
      },

      disableBiometricLock: () => {
        set({ isEnabled: false, isLocked: false, credentialId: null });
      },

      lockApp: () => {
        const { isEnabled } = get();
        if (isEnabled) {
          set({ isLocked: true });
        }
      },

      unlockWithBiometric: async () => {
        const { isEnabled, credentialId } = get();
        if (!isEnabled || !credentialId) {
          set({ isLocked: false });
          return true;
        }

        const verified = await verifyWithBiometric(credentialId);
        if (verified) {
          set({ isLocked: false });
          return true;
        }
        return false;
      },
    }),
    {
      name: 'dreamtime-biometric',
      version: 2, // Bumped version due to schema change (added credentialId)
      partialize: (state) => ({
        isEnabled: state.isEnabled,
        credentialId: state.credentialId,
        // Don't persist isLocked - start locked if enabled
      }),
      onRehydrateStorage: () => (state) => {
        // When the store is rehydrated (app starts), lock if enabled
        if (state?.isEnabled && state?.credentialId) {
          state.isLocked = true;
        }
      },
    }
  )
);

// Export utility functions
export { isPlatformAuthenticatorAvailable };
