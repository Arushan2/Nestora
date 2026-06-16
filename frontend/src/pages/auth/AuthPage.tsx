import {
  FormEvent,
  useState,
  useRef,
  useEffect,
  useCallback,
  type ReactNode,
  type KeyboardEvent,
  type ClipboardEvent,
} from 'react';
import { Button } from '../../components/ui/button';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '../../components/ui/card';
import { Input } from '../../components/ui/input';
import { Label } from '../../components/ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../../components/ui/tabs';
import { PasswordInput } from '../../components/ui/password-input';
import { PasswordStrengthIndicator } from '../../components/ui/password-strength-indicator';
import { validatePassword, validatePasswordStrict } from '../../lib/passwordValidation';

type AuthView = 'auth' | 'verify-signup' | 'forgot-password' | 'verify-reset' | 'banned';

// ── OTP Input Row — top-level so it never remounts on parent re-render ──

interface OtpInputRowProps {
  otpCode: string[];
  hasError: boolean;
  inputRefs: React.MutableRefObject<(HTMLInputElement | null)[]>;
  onChange: (index: number, value: string) => void;
  onKeyDown: (index: number, event: KeyboardEvent<HTMLInputElement>) => void;
  onPaste: (event: ClipboardEvent<HTMLInputElement>) => void;
}

function OtpInputRow({ otpCode, hasError, inputRefs, onChange, onKeyDown, onPaste }: OtpInputRowProps) {
  return (
    <div className="flex items-center justify-center gap-2">
      {otpCode.map((digit, index) => (
        <input
          key={index}
          ref={(el) => { inputRefs.current[index] = el; }}
          id={`otp-${index}`}
          type="text"
          inputMode="numeric"
          maxLength={1}
          placeholder="-"
          value={digit}
          onChange={(e) => onChange(index, e.target.value)}
          onKeyDown={(e) => onKeyDown(index, e)}
          onPaste={onPaste}
          onFocus={(e) => {
            const input = e.currentTarget;
            requestAnimationFrame(() => input.select());
          }}
          className={`h-12 w-11 rounded-lg border-2 text-center text-xl font-bold outline-none transition-all focus:ring-2 ${
            hasError
              ? 'border-red-500 bg-red-50/50 text-red-900 focus:border-red-600 focus:ring-red-200'
              : 'border-ink-200 bg-white text-ink-900 focus:border-indigo-500 focus:ring-indigo-200'
          }`}
          autoComplete="one-time-code"
        />
      ))}
    </div>
  );
}

// ── Main AuthPage ──

export function AuthPage({
  onSignIn,
  onSignUp,
  loading,
  notice,
}: {
  onSignIn: (email: string, password: string, preAuthUser?: import('../../types/session').User) => Promise<void>;
  onSignUp: (name: string, email: string, password: string) => Promise<void>;
  loading: boolean;
  notice: string;
}) {
  const [view, setView] = useState<AuthView>('auth');
  const [activeTab, setActiveTab] = useState<'signin' | 'signup'>('signin');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [name, setName] = useState('');
  const [error, setError] = useState('');
  const [info, setInfo] = useState('');
  const [otpCode, setOtpCode] = useState(['', '', '', '', '', '']);
  const [newPassword, setNewPassword] = useState('');
  const [newConfirmPassword, setNewConfirmPassword] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [pendingEmail, setPendingEmail] = useState('');
  const [banReason, setBanReason] = useState('');
  const [bannedUntil, setBannedUntil] = useState<string | null>(null);

  const otpRefs = useRef<(HTMLInputElement | null)[]>([]);

  // ── Focus helper: focus an input and select its content ──
  const focusAndSelect = useCallback((el: HTMLInputElement | null) => {
    if (!el) return;
    el.focus();
    requestAnimationFrame(() => el.select());
  }, []);

  // Focus first OTP input when view changes to an OTP view
  useEffect(() => {
    if (view === 'verify-signup' || view === 'verify-reset') {
      setTimeout(() => focusAndSelect(otpRefs.current[0]), 100);
    }
  }, [view, focusAndSelect]);

  function resetOtp() {
    setOtpCode(['', '', '', '', '', '']);
  }

  // ── OTP handlers (stable callbacks passed as props to OtpInputRow) ──

  const handleOtpChange = useCallback((index: number, value: string) => {
    if (value && !/^\d$/.test(value)) return;

    setOtpCode((prev) => {
      const next = [...prev];
      next[index] = value;
      return next;
    });

    if (value && index < 5) {
      focusAndSelect(otpRefs.current[index + 1]);
    }
  }, [focusAndSelect]);

  const handleOtpKeyDown = useCallback((index: number, event: KeyboardEvent<HTMLInputElement>) => {
    const { key } = event;

    if (key === 'Backspace') {
      event.preventDefault();
      setOtpCode((prev) => {
        const next = [...prev];
        if (prev[index]) {
          next[index] = '';
          // After clearing, go back to previous box
          if (index > 0) {
            requestAnimationFrame(() => focusAndSelect(otpRefs.current[index - 1]));
          }
        } else if (index > 0) {
          next[index - 1] = '';
          requestAnimationFrame(() => focusAndSelect(otpRefs.current[index - 1]));
        }
        return next;
      });
    } else if (key === 'ArrowLeft') {
      if (index > 0) {
        event.preventDefault();
        focusAndSelect(otpRefs.current[index - 1]);
      }
    } else if (key === 'ArrowRight') {
      if (index < 5) {
        event.preventDefault();
        focusAndSelect(otpRefs.current[index + 1]);
      }
    }
  }, [focusAndSelect]);

  const handleOtpPaste = useCallback((event: ClipboardEvent<HTMLInputElement>) => {
    event.preventDefault();
    const pastedText = event.clipboardData.getData('text');
    const digits = pastedText.replace(/\D/g, '').slice(0, 6).split('');
    if (digits.length === 0) return;

    setOtpCode((prev) => {
      const next = [...prev];
      digits.forEach((digit, i) => { next[i] = digit; });
      return next;
    });

    const nextFocusIndex = Math.min(digits.length, 5);
    focusAndSelect(otpRefs.current[nextFocusIndex]);
  }, [focusAndSelect]);

  // ── Auto-submit when all 6 digits are filled ──
  const verifySignupRef = useRef<(() => void) | null>(null);

  useEffect(() => {
    const code = otpCode.join('');
    if (code.length === 6 && !submitting) {
      if (view === 'verify-signup') {
        verifySignupRef.current?.();
      } else if (view === 'verify-reset') {
        requestAnimationFrame(() => {
          document.getElementById('reset-new-password')?.focus();
        });
      }
    }
  }, [otpCode, view, submitting]);

  // ── Sign Up: Step 1 — Request OTP ──

  async function handleSignUp(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError('');
    setInfo('');
    setSubmitting(true);

    if (!validatePasswordStrict(password)) {
      setError('Password does not meet the strength requirements. Please choose a Strong or Very Strong password.');
      setSubmitting(false);
      return;
    }

    if (password !== confirmPassword) {
      setError('Passwords do not match. Please try again.');
      setSubmitting(false);
      return;
    }

    try {
      const response = await fetch('/api/auth/register', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, email, password }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.message ?? 'Unable to create account.');
      }

      if (data.requires_otp) {
        setPendingEmail(data.email);
        resetOtp();
        setInfo(data.message ?? 'Check your email for the verification code.');
        setView('verify-signup');
      }
    } catch (caughtError) {
      setError(caughtError instanceof Error ? caughtError.message : 'Unable to create account.');
    } finally {
      setSubmitting(false);
    }
  }

  // ── Sign Up: Step 2 — Verify OTP ──

  async function submitVerifySignup(code: string) {
    setError('');
    setInfo('');
    setSubmitting(true);

    if (code.length !== 6) {
      setError('Please enter the full 6-digit code.');
      setSubmitting(false);
      return;
    }

    try {
      const response = await fetch('/api/auth/verify-otp', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: pendingEmail, code }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.message ?? 'Verification failed.');
      }

      await onSignUp(name, pendingEmail, password);
    } catch (caughtError) {
      try {
        await onSignIn(pendingEmail, password);
      } catch {
        setError(caughtError instanceof Error ? caughtError.message : 'Verification failed.');
      }
    } finally {
      setSubmitting(false);
    }
  }

  // Keep a stable ref so auto-submit useEffect can call it
  verifySignupRef.current = () => {
    const code = otpCode.join('');
    void submitVerifySignup(code);
  };

  async function handleVerifySignup(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    await submitVerifySignup(otpCode.join(''));
  }

  // ── Sign In ──

  async function handleSignIn(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError('');
    setInfo('');

    try {
      const response = await fetch('/api/auth/login', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      });

      const data = await response.json() as {
        banned?: boolean;
        ban_reason?: string;
        banned_until?: string;
        message?: string;
        user?: unknown;
      };

      // Banned user — switch to the ban screen instead of navigating
      if (response.status === 403 && data.banned) {
        setBanReason(data.ban_reason ?? 'No reason provided.');
        setBannedUntil(data.banned_until ?? null);
        setView('banned');
        return;
      }

      if (!response.ok) {
        throw new Error(data.message ?? 'Unable to sign in.');
      }

      // Success — hand off to App-level handler with the pre-fetched user
      const loginUser = (data.user as import('../../types/session').User | undefined) ?? undefined;
      await onSignIn(email, password, loginUser);
    } catch (caughtError) {
      setError(caughtError instanceof Error ? caughtError.message : 'Unable to sign in.');
    }
  }

  // ── Forgot Password: Step 1 — Request OTP ──

  async function handleForgotPassword(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError('');
    setInfo('');
    setSubmitting(true);

    try {
      const response = await fetch('/api/auth/forgot-password', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.message ?? 'Unable to send reset email.');
      }

      if (data.requires_otp) {
        setPendingEmail(data.email);
        resetOtp();
        setNewPassword('');
        setConfirmPassword('');
        setInfo(data.message ?? 'Check your email for the reset code.');
        setView('verify-reset');
      }
    } catch (caughtError) {
      setError(caughtError instanceof Error ? caughtError.message : 'Unable to send reset email.');
    } finally {
      setSubmitting(false);
    }
  }

  // ── Forgot Password: Step 2 — Verify OTP & Reset ──

  async function handleResetPassword(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError('');
    setInfo('');
    setSubmitting(true);

    const code = otpCode.join('');

    if (code.length !== 6) {
      setError('Please enter the full 6-digit code.');
      setSubmitting(false);
      return;
    }

    if (!validatePasswordStrict(newPassword)) {
      setError('Password does not meet the strength requirements. Please choose a Strong or Very Strong password.');
      setSubmitting(false);
      return;
    }

    if (newPassword !== newConfirmPassword) {
      setError('Passwords do not match.');
      setSubmitting(false);
      return;
    }

    try {
      const response = await fetch('/api/auth/reset-password', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: pendingEmail, code, new_password: newPassword }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.message ?? 'Password reset failed.');
      }

      await onSignIn(pendingEmail, newPassword);
    } catch (caughtError) {
      setError(caughtError instanceof Error ? caughtError.message : 'Password reset failed.');
    } finally {
      setSubmitting(false);
    }
  }

  // ── Render: Account Suspended (Banned) ──

  if (view === 'banned') {
    const expiryDate = bannedUntil ? new Date(bannedUntil) : null;
    const expiryFormatted = expiryDate
      ? expiryDate.toLocaleString('en-US', {
          weekday: 'long',
          year: 'numeric',
          month: 'long',
          day: 'numeric',
          hour: '2-digit',
          minute: '2-digit',
        })
      : 'an unspecified time';

    const now = new Date();
    const daysRemaining = expiryDate
      ? Math.ceil((expiryDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24))
      : null;

    return (
      <main className="min-h-screen bg-ink-50 px-4 py-8 md:px-8">
        <div className="mx-auto flex min-h-[calc(100vh-4rem)] max-w-lg items-center">
          <Card className="w-full border-0 shadow-glow overflow-hidden">
            {/* Red accent header bar */}
            <div className="h-2 w-full" style={{ background: 'linear-gradient(90deg, #dc2626, #b91c1c, #7f1d1d)' }} />

            <CardHeader className="pb-2 pt-8">
              <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-2xl mx-auto"
                style={{ background: 'linear-gradient(135deg, #fee2e2, #fecaca)', boxShadow: '0 4px 20px rgba(220,38,38,0.2)' }}>
                {/* Shield/Lock icon */}
                <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="#dc2626" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>
                  <line x1="12" y1="8" x2="12" y2="12"/>
                  <line x1="12" y1="16" x2="12.01" y2="16"/>
                </svg>
              </div>
              <CardTitle className="text-center text-2xl font-bold" style={{ color: '#dc2626' }}>
                Account Suspended
              </CardTitle>
              <CardDescription className="text-center text-sm mt-1">
                Your account has been temporarily restricted by an administrator.
              </CardDescription>
            </CardHeader>

            <CardContent className="space-y-5 pb-6">
              {/* Ban Reason */}
              <div className="rounded-xl border border-red-100 bg-red-50/60 p-4">
                <p className="mb-1 text-xs font-semibold uppercase tracking-wider" style={{ color: '#b91c1c' }}>
                  Reason for suspension
                </p>
                <p className="text-sm font-medium text-ink-800 leading-relaxed">
                  {banReason}
                </p>
              </div>

              {/* Expiry info */}
              <div className="rounded-xl border border-amber-100 bg-amber-50/60 p-4">
                <p className="mb-1 text-xs font-semibold uppercase tracking-wider" style={{ color: '#b45309' }}>
                  Access will be restored
                </p>
                <p className="text-sm font-bold text-ink-900">
                  {expiryFormatted}
                </p>
                {daysRemaining !== null && daysRemaining > 0 && (
                  <p className="mt-1 text-xs" style={{ color: '#92400e' }}>
                    {daysRemaining === 1
                      ? 'Your suspension lifts tomorrow.'
                      : `${daysRemaining} days remaining.`}
                  </p>
                )}
              </div>

              {/* Blocked activities note */}
              <div className="rounded-xl border border-ink-100 bg-ink-50/60 p-4">
                <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-ink-500">
                  Restricted during suspension
                </p>
                <ul className="space-y-1 text-sm text-ink-600">
                  <li className="flex items-center gap-2">
                    <span className="text-red-500">✗</span> Placing orders or checkout
                  </li>
                  <li className="flex items-center gap-2">
                    <span className="text-red-500">✗</span> Sending service inquiries
                  </li>
                  <li className="flex items-center gap-2">
                    <span className="text-red-500">✗</span> Listing services or products
                  </li>
                  <li className="flex items-center gap-2">
                    <span className="text-red-500">✗</span> Accessing the dashboard
                  </li>
                </ul>
              </div>

              <p className="text-center text-xs text-ink-400">
                If you believe this is a mistake, please contact Nestora support.
              </p>

              <button
                id="banned-back-button"
                type="button"
                className="w-full rounded-lg border border-ink-200 bg-white px-4 py-2.5 text-sm font-medium text-ink-700 transition-colors hover:bg-ink-50"
                onClick={() => {
                  setView('auth');
                  setBanReason('');
                  setBannedUntil(null);
                  setError('');
                }}
              >
                ← Back to Sign In
              </button>
            </CardContent>
          </Card>
        </div>
      </main>
    );
  }

  // ── Render: Verify Signup OTP ──

  if (view === 'verify-signup') {
    return (
      <main className="min-h-screen bg-ink-50 px-4 py-8 md:px-8">
        <div className="mx-auto flex min-h-[calc(100vh-4rem)] max-w-lg items-center">
          <Card className="w-full border-0 bg-white/90 shadow-glow">
            <CardHeader>
              <CardTitle>Verify your email</CardTitle>
              <CardDescription>
                We sent a 6-digit code to <strong>{pendingEmail}</strong>
              </CardDescription>
            </CardHeader>
            <CardContent>
              <form className="space-y-6" onSubmit={handleVerifySignup}>
                <OtpInputRow
                  otpCode={otpCode}
                  hasError={!!error}
                  inputRefs={otpRefs}
                  onChange={handleOtpChange}
                  onKeyDown={handleOtpKeyDown}
                  onPaste={handleOtpPaste}
                />
                <Button type="submit" className="w-full" disabled={submitting}>
                  {submitting ? 'Verifying...' : 'Verify & Create Account'}
                </Button>
              </form>
              <button
                type="button"
                className="mt-4 w-full text-center text-sm text-indigo-600 hover:underline"
                onClick={() => { setView('auth'); setError(''); setInfo(''); }}
              >
                ← Back to sign up
              </button>
            </CardContent>
            <CardFooter>
              <div className="space-y-2">
                {info ? <p className="text-sm font-medium text-indigo-600">{info}</p> : null}
                {error ? <p className="text-sm font-medium text-red-600">{error}</p> : null}
              </div>
            </CardFooter>
          </Card>
        </div>
      </main>
    );
  }

  // ── Render: Forgot Password — Enter Email ──

  if (view === 'forgot-password') {
    return (
      <main className="min-h-screen bg-ink-50 px-4 py-8 md:px-8">
        <div className="mx-auto flex min-h-[calc(100vh-4rem)] max-w-lg items-center">
          <Card className="w-full border-0 bg-white/90 shadow-glow">
            <CardHeader>
              <CardTitle>Forgot password</CardTitle>
              <CardDescription>Enter your email to receive a reset code.</CardDescription>
            </CardHeader>
            <CardContent>
              <form className="space-y-4" onSubmit={handleForgotPassword}>
                <Field label="Email" htmlFor="forgot-email">
                  <Input
                    id="forgot-email"
                    type="email"
                    placeholder="you@example.com"
                    value={email}
                    onChange={(event) => setEmail(event.target.value)}
                  />
                </Field>
                <Button type="submit" className="w-full" disabled={submitting}>
                  {submitting ? 'Sending...' : 'Send Reset Code'}
                </Button>
              </form>
              <button
                type="button"
                className="mt-4 w-full text-center text-sm text-indigo-600 hover:underline"
                onClick={() => { setView('auth'); setError(''); setInfo(''); }}
              >
                ← Back to sign in
              </button>
            </CardContent>
            <CardFooter>
              <div className="space-y-2">
                {info ? <p className="text-sm font-medium text-indigo-600">{info}</p> : null}
                {error ? <p className="text-sm font-medium text-red-600">{error}</p> : null}
              </div>
            </CardFooter>
          </Card>
        </div>
      </main>
    );
  }

  // ── Render: Reset Password — Enter OTP + New Password ──

  if (view === 'verify-reset') {
    return (
      <main className="min-h-screen bg-ink-50 px-4 py-8 md:px-8">
        <div className="mx-auto flex min-h-[calc(100vh-4rem)] max-w-lg items-center">
          <Card className="w-full border-0 bg-white/90 shadow-glow">
            <CardHeader>
              <CardTitle>Reset your password</CardTitle>
              <CardDescription>
                Enter the 6-digit code sent to <strong>{pendingEmail}</strong> and choose a new password.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <form className="space-y-6" onSubmit={handleResetPassword}>
                <OtpInputRow
                  otpCode={otpCode}
                  hasError={!!error}
                  inputRefs={otpRefs}
                  onChange={handleOtpChange}
                  onKeyDown={handleOtpKeyDown}
                  onPaste={handleOtpPaste}
                />
                <Field label="New Password" htmlFor="reset-new-password">
                  <PasswordInput
                    id="reset-new-password"
                    placeholder="Create a new password"
                    value={newPassword}
                    onChange={(event) => setNewPassword(event.target.value)}
                  />
                </Field>
                {newPassword && <PasswordStrengthIndicator validation={validatePassword(newPassword)} />}
                <Field label="Confirm New Password" htmlFor="reset-confirm-password">
                  <PasswordInput
                    id="reset-confirm-password"
                    placeholder="Confirm your new password"
                    value={newConfirmPassword}
                    onChange={(event) => setNewConfirmPassword(event.target.value)}
                  />
                </Field>
                {newConfirmPassword && newPassword !== newConfirmPassword && (
                  <p className="text-sm text-red-600 font-medium">Passwords do not match</p>
                )}
                {newConfirmPassword && newPassword === newConfirmPassword && newPassword && (
                  <p className="text-sm text-green-600 font-medium">Passwords match ✓</p>
                )}
                <Button type="submit" className="w-full" disabled={submitting || !validatePasswordStrict(newPassword) || newPassword !== newConfirmPassword}>
                  {submitting ? 'Resetting...' : 'Reset Password'}
                </Button>
              </form>
              <button
                type="button"
                className="mt-4 w-full text-center text-sm text-indigo-600 hover:underline"
                onClick={() => { setView('forgot-password'); setError(''); setInfo(''); resetOtp(); }}
              >
                ← Back
              </button>
            </CardContent>
            <CardFooter>
              <div className="space-y-2">
                {info ? <p className="text-sm font-medium text-indigo-600">{info}</p> : null}
                {error ? <p className="text-sm font-medium text-red-600">{error}</p> : null}
              </div>
            </CardFooter>
          </Card>
        </div>
      </main>
    );
  }

  // ── Render: Default Auth (Sign In / Sign Up) ──

  return (
    <main className="min-h-screen bg-ink-50 px-4 py-8 md:px-8">
      <div className="mx-auto flex min-h-[calc(100vh-4rem)] max-w-lg items-center">
        <Card className="w-full border-0 bg-white/90 shadow-glow">
          <CardHeader>
            <CardTitle>Account access</CardTitle>
            <CardDescription>Sign in or create a new account.</CardDescription>
          </CardHeader>
          <CardContent>
            <Tabs value={activeTab} onValueChange={(value) => setActiveTab(value as 'signin' | 'signup')} defaultValue="signin">
              <TabsList>
                <TabsTrigger value="signin">Sign in</TabsTrigger>
                <TabsTrigger value="signup">Sign up</TabsTrigger>
              </TabsList>

              <TabsContent value="signin">
                <form className="mt-4 space-y-4" onSubmit={handleSignIn}>
                  <Field label="Email" htmlFor="signin-email">
                    <Input id="signin-email" type="email" placeholder="you@example.com" value={email} onChange={(event) => setEmail(event.target.value)} />
                  </Field>
                  <Field label="Password" htmlFor="signin-password">
                    <PasswordInput
                      id="signin-password"
                      placeholder="Your password"
                      value={password}
                      onChange={(event) => setPassword(event.target.value)}
                    />
                  </Field>
                  <Button type="submit" className="w-full" disabled={loading}>
                    {loading ? 'Signing in...' : 'Sign in'}
                  </Button>
                  <button
                    type="button"
                    className="w-full text-center text-sm text-indigo-600 hover:underline"
                    onClick={() => { setView('forgot-password'); setError(''); setInfo(''); }}
                  >
                    Forgot password?
                  </button>
                </form>
              </TabsContent>

              <TabsContent value="signup">
                <form className="mt-4 space-y-4" onSubmit={handleSignUp}>
                  <Field label="Name" htmlFor="signup-name">
                    <Input id="signup-name" type="text" placeholder="Your name" value={name} onChange={(event) => setName(event.target.value)} />
                  </Field>
                  <Field label="Email" htmlFor="signup-email">
                    <Input id="signup-email" type="email" placeholder="you@example.com" value={email} onChange={(event) => setEmail(event.target.value)} />
                  </Field>
                  <Field label="Password" htmlFor="signup-password">
                    <PasswordInput
                      id="signup-password"
                      placeholder="Create a password"
                      value={password}
                      onChange={(event) => setPassword(event.target.value)}
                    />
                  </Field>
                  {password && <PasswordStrengthIndicator validation={validatePassword(password)} />}
                  <Field label="Confirm Password" htmlFor="signup-confirm-password">
                    <PasswordInput
                      id="signup-confirm-password"
                      placeholder="Confirm your password"
                      value={confirmPassword}
                      onChange={(event) => setConfirmPassword(event.target.value)}
                    />
                  </Field>
                  {confirmPassword && password !== confirmPassword && (
                    <p className="text-sm text-red-600 font-medium">Passwords do not match</p>
                  )}
                  {confirmPassword && password === confirmPassword && password && (
                    <p className="text-sm text-green-600 font-medium">Passwords match ✓</p>
                  )}
                  <Button type="submit" className="w-full" disabled={submitting || !validatePasswordStrict(password) || password !== confirmPassword}>
                    {submitting ? 'Sending verification...' : 'Sign up'}
                  </Button>
                </form>
              </TabsContent>
            </Tabs>
          </CardContent>
          <CardFooter>
            <div className="space-y-2">
              {notice ? <p className="text-sm font-medium text-ink-900">{notice}</p> : null}
              {info ? <p className="text-sm font-medium text-indigo-600">{info}</p> : null}
              {error ? <p className="text-sm font-medium text-red-600">{error}</p> : null}
            </div>
          </CardFooter>
        </Card>
      </div>
    </main>
  );
}

function Field({ label, htmlFor, children }: { label: string; htmlFor: string; children: ReactNode }) {
  return (
    <div className="space-y-2">
      <Label htmlFor={htmlFor}>{label}</Label>
      {children}
    </div>
  );
}
