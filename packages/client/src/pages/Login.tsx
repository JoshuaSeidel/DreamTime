import { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Moon, Loader2, Fingerprint } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import { useAuthStore } from '@/store/authStore';
import {
  isWebAuthnSupported,
  isPlatformAuthenticatorAvailable,
  checkPasskeysAvailable,
  authenticateWithPasskey,
} from '@/lib/webauthn';

export default function Login() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isBiometricLoading, setIsBiometricLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [biometricAvailable, setBiometricAvailable] = useState(false);
  const [passkeysAvailable, setPasskeysAvailable] = useState(false);
  const [, setSavedEmail] = useState<string | null>(null);
  const navigate = useNavigate();
  const { login, setAuth } = useAuthStore();

  // Check for saved email and biometric availability on mount
  useEffect(() => {
    const checkBiometric = async () => {
      const supported = isWebAuthnSupported();
      const platformAvailable = await isPlatformAuthenticatorAvailable();
      setBiometricAvailable(supported && platformAvailable);

      // Check for saved email from last login
      const lastEmail = localStorage.getItem('dreamtime-last-email');
      if (lastEmail && supported && platformAvailable) {
        setSavedEmail(lastEmail);
        setEmail(lastEmail);
        // Check if this email has passkeys
        const { available } = await checkPasskeysAvailable(lastEmail);
        setPasskeysAvailable(available);
      }
    };
    checkBiometric();
  }, []);

  // Check for passkeys when email changes
  useEffect(() => {
    const checkEmail = async () => {
      if (email && email.includes('@') && biometricAvailable) {
        const { available } = await checkPasskeysAvailable(email);
        setPasskeysAvailable(available);
      } else {
        setPasskeysAvailable(false);
      }
    };

    const debounce = setTimeout(checkEmail, 500);
    return () => clearTimeout(debounce);
  }, [email, biometricAvailable]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError(null);

    try {
      await login(email, password);
      // Save email for biometric login next time
      localStorage.setItem('dreamtime-last-email', email);
      navigate('/');
    } catch (err) {
      setError('Invalid email or password');
    } finally {
      setIsLoading(false);
    }
  };

  const handleBiometricLogin = async () => {
    if (!email) {
      setError('Please enter your email first');
      return;
    }

    setIsBiometricLoading(true);
    setError(null);

    try {
      const result = await authenticateWithPasskey(email);

      if (result.success && result.data) {
        setAuth(result.data.user, result.data.accessToken, result.data.refreshToken);
        localStorage.setItem('dreamtime-last-email', email);
        navigate('/');
      } else {
        setError(result.error || 'Biometric authentication failed');
      }
    } catch (err) {
      setError('Biometric authentication failed');
    } finally {
      setIsBiometricLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-background flex items-center justify-center px-4 py-8">
      <Card className="w-full max-w-md">
        <CardHeader className="space-y-1 text-center">
          <div className="flex justify-center mb-4">
            <div className="rounded-full bg-primary/10 p-3">
              <Moon className="w-8 h-8 text-primary" />
            </div>
          </div>
          <CardTitle className="text-2xl font-bold text-primary">DreamTime</CardTitle>
          <CardDescription>Sign in to track your baby's sleep</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {error && (
              <div className="p-3 rounded-md bg-destructive/10 text-destructive text-sm">
                {error}
              </div>
            )}

            {/* Biometric Login Button - Show if passkeys are available for this email */}
            {biometricAvailable && passkeysAvailable && (
              <>
                <Button
                  type="button"
                  variant="outline"
                  className="w-full h-14 text-base"
                  size="lg"
                  onClick={handleBiometricLogin}
                  disabled={isBiometricLoading || !email}
                >
                  {isBiometricLoading ? (
                    <>
                      <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                      Authenticating...
                    </>
                  ) : (
                    <>
                      <Fingerprint className="mr-2 h-5 w-5" />
                      Sign in with Face ID
                    </>
                  )}
                </Button>

                <div className="relative">
                  <div className="absolute inset-0 flex items-center">
                    <Separator className="w-full" />
                  </div>
                  <div className="relative flex justify-center text-xs uppercase">
                    <span className="bg-card px-2 text-muted-foreground">
                      Or continue with
                    </span>
                  </div>
                </div>
              </>
            )}

            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="email">Email</Label>
                <Input
                  id="email"
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="you@example.com"
                  autoComplete="email webauthn"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="password">Password</Label>
                <Input
                  id="password"
                  type="password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Enter your password"
                  autoComplete="current-password"
                />
              </div>

              <Button type="submit" disabled={isLoading} className="w-full" size="lg">
                {isLoading ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Signing in...
                  </>
                ) : (
                  'Sign in'
                )}
              </Button>
            </form>

            <p className="text-center text-sm text-muted-foreground">
              Don't have an account?{' '}
              <Link to="/register" className="text-primary hover:underline font-medium">
                Sign up
              </Link>
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
