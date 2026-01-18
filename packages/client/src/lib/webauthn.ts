import {
  startRegistration,
  startAuthentication,
  browserSupportsWebAuthn,
  platformAuthenticatorIsAvailable,
  type PublicKeyCredentialCreationOptionsJSON,
  type PublicKeyCredentialRequestOptionsJSON,
} from '@simplewebauthn/browser';

const API_URL = '/api/webauthn';

/**
 * Check if WebAuthn is supported on this device
 */
export function isWebAuthnSupported(): boolean {
  return browserSupportsWebAuthn();
}

/**
 * Check if platform authenticator (Face ID, Touch ID, Windows Hello) is available
 */
export async function isPlatformAuthenticatorAvailable(): Promise<boolean> {
  if (!browserSupportsWebAuthn()) {
    return false;
  }
  return platformAuthenticatorIsAvailable();
}

/**
 * Check if passkeys are available for a user email
 */
export async function checkPasskeysAvailable(
  email: string
): Promise<{ available: boolean; credentialCount: number }> {
  try {
    const response = await fetch(`${API_URL}/check-available`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ email }),
    });

    if (!response.ok) {
      return { available: false, credentialCount: 0 };
    }

    const data = await response.json();
    return data.data;
  } catch {
    return { available: false, credentialCount: 0 };
  }
}

/**
 * Register a new passkey for the current user
 * Must be called after user is logged in
 */
export async function registerPasskey(
  accessToken: string,
  friendlyName?: string
): Promise<{ success: boolean; error?: string }> {
  try {
    // Step 1: Get registration options from server
    const optionsResponse = await fetch(`${API_URL}/register/options`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${accessToken}`,
      },
    });

    if (!optionsResponse.ok) {
      const error = await optionsResponse.json();
      return { success: false, error: error.error?.message || 'Failed to get registration options' };
    }

    const optionsData = await optionsResponse.json();
    const options: PublicKeyCredentialCreationOptionsJSON = optionsData.data;

    // Step 2: Create credentials using the browser API (triggers Face ID/Touch ID)
    let registration;
    try {
      registration = await startRegistration({ optionsJSON: options });
    } catch (err) {
      if (err instanceof Error) {
        if (err.name === 'NotAllowedError') {
          return { success: false, error: 'Authentication was cancelled or not allowed' };
        }
        if (err.name === 'InvalidStateError') {
          return { success: false, error: 'This device is already registered' };
        }
        return { success: false, error: err.message };
      }
      return { success: false, error: 'Registration failed' };
    }

    // Step 3: Send credentials to server for verification
    const verifyResponse = await fetch(`${API_URL}/register/verify`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${accessToken}`,
      },
      body: JSON.stringify({
        response: registration,
        friendlyName,
      }),
    });

    if (!verifyResponse.ok) {
      const error = await verifyResponse.json();
      return { success: false, error: error.error?.message || 'Failed to verify registration' };
    }

    return { success: true };
  } catch (err) {
    return { success: false, error: err instanceof Error ? err.message : 'Unknown error' };
  }
}

/**
 * Authenticate with passkey (Face ID, Touch ID)
 */
export async function authenticateWithPasskey(
  email: string
): Promise<{
  success: boolean;
  data?: {
    user: { id: string; email: string; name: string; timezone: string };
    accessToken: string;
    refreshToken: string;
  };
  error?: string;
}> {
  try {
    // Step 1: Get authentication options from server
    const optionsResponse = await fetch(`${API_URL}/authenticate/options`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ email }),
    });

    if (!optionsResponse.ok) {
      const error = await optionsResponse.json();
      return { success: false, error: error.error?.message || 'Failed to get authentication options' };
    }

    const optionsData = await optionsResponse.json();
    const options: PublicKeyCredentialRequestOptionsJSON = optionsData.data;

    // Step 2: Authenticate using the browser API (triggers Face ID/Touch ID)
    let authentication;
    try {
      authentication = await startAuthentication({ optionsJSON: options });
    } catch (err) {
      if (err instanceof Error) {
        if (err.name === 'NotAllowedError') {
          return { success: false, error: 'Authentication was cancelled or not allowed' };
        }
        return { success: false, error: err.message };
      }
      return { success: false, error: 'Authentication failed' };
    }

    // Step 3: Verify authentication with server
    const verifyResponse = await fetch(`${API_URL}/authenticate/verify`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        email,
        response: authentication,
      }),
    });

    if (!verifyResponse.ok) {
      const error = await verifyResponse.json();
      return { success: false, error: error.error?.message || 'Failed to verify authentication' };
    }

    const data = await verifyResponse.json();
    return { success: true, data: data.data };
  } catch (err) {
    return { success: false, error: err instanceof Error ? err.message : 'Unknown error' };
  }
}

/**
 * List registered passkeys for the current user
 */
export async function listPasskeys(
  accessToken: string
): Promise<{
  success: boolean;
  data?: Array<{
    id: string;
    friendlyName: string | null;
    deviceType: string;
    createdAt: string;
    lastUsedAt: string | null;
  }>;
  error?: string;
}> {
  try {
    const response = await fetch(`${API_URL}/credentials`, {
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    });

    if (!response.ok) {
      const error = await response.json();
      return { success: false, error: error.error?.message || 'Failed to list passkeys' };
    }

    const data = await response.json();
    return { success: true, data: data.data };
  } catch (err) {
    return { success: false, error: err instanceof Error ? err.message : 'Unknown error' };
  }
}

/**
 * Delete a passkey
 */
export async function deletePasskey(
  accessToken: string,
  credentialId: string
): Promise<{ success: boolean; error?: string }> {
  try {
    const response = await fetch(`${API_URL}/credentials/${credentialId}`, {
      method: 'DELETE',
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    });

    if (!response.ok) {
      const error = await response.json();
      return { success: false, error: error.error?.message || 'Failed to delete passkey' };
    }

    return { success: true };
  } catch (err) {
    return { success: false, error: err instanceof Error ? err.message : 'Unknown error' };
  }
}

/**
 * Get device name for display
 */
export function getDeviceName(): string {
  const userAgent = navigator.userAgent;

  if (/iPhone/i.test(userAgent)) {
    return 'iPhone';
  }
  if (/iPad/i.test(userAgent)) {
    return 'iPad';
  }
  if (/Mac/i.test(userAgent)) {
    return 'Mac';
  }
  if (/Android/i.test(userAgent)) {
    return 'Android Device';
  }
  if (/Windows/i.test(userAgent)) {
    return 'Windows PC';
  }

  return 'This Device';
}
