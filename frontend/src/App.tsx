import { FormEvent, useEffect, useState, type ReactNode } from 'react';
import { Button } from './components/ui/button';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from './components/ui/card';
import { Input } from './components/ui/input';
import { Label } from './components/ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from './components/ui/tabs';

type User = {
  id: number;
  name: string;
  email: string;
  role: 'user' | 'admin';
  created_at: string;
};

type ApiResponse<T> = {
  message?: string;
  user?: T;
  authenticated?: boolean;
};

const initialSignIn = { email: '', password: '' };
const initialSignUp = { name: '', email: '', password: '', wantsAdmin: false, adminCode: '' };

async function requestJson<T>(path: string, body?: unknown): Promise<ApiResponse<T>> {
  const response = await fetch(path, {
    method: body ? 'POST' : 'GET',
    credentials: 'include',
    headers: body ? { 'Content-Type': 'application/json' } : undefined,
    body: body ? JSON.stringify(body) : undefined,
  });

  const data = (await response.json()) as ApiResponse<T>;

  if (!response.ok) {
    throw new Error(data.message ?? 'Request failed.');
  }

  return data;
}

export default function App() {
  const [activeTab, setActiveTab] = useState<'signin' | 'signup'>('signin');
  const [signIn, setSignIn] = useState(initialSignIn);
  const [signUp, setSignUp] = useState(initialSignUp);
  const [user, setUser] = useState<User | null>(null);
  const [status, setStatus] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    let mounted = true;

    requestJson<User>('/api/auth/me')
      .then((response) => {
        if (!mounted) {
          return;
        }

        setUser(response.user ?? null);
      })
      .catch(() => {
        if (mounted) {
          setUser(null);
        }
      });

    return () => {
      mounted = false;
    };
  }, []);

  async function handleSignIn(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoading(true);
    setError('');
    setStatus('');

    try {
      const response = await requestJson<User>('/api/auth/login', signIn);
      setUser(response.user ?? null);
      setStatus(response.message ?? 'Signed in.');
      setSignIn(initialSignIn);
    } catch (caughtError) {
      setError(caughtError instanceof Error ? caughtError.message : 'Unable to sign in.');
    } finally {
      setLoading(false);
    }
  }

  async function handleSignUp(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoading(true);
    setError('');
    setStatus('');

    try {
      const response = await requestJson<User>('/api/auth/register', {
        name: signUp.name,
        email: signUp.email,
        password: signUp.password,
        role: signUp.wantsAdmin ? 'admin' : 'user',
        adminCode: signUp.adminCode,
      });

      setUser(response.user ?? null);
      setStatus(response.message ?? 'Account created.');
      setSignUp(initialSignUp);
      setActiveTab('signin');
    } catch (caughtError) {
      setError(caughtError instanceof Error ? caughtError.message : 'Unable to create account.');
    } finally {
      setLoading(false);
    }
  }

  async function handleLogout() {
    setLoading(true);
    setError('');
    setStatus('');

    try {
      const response = await requestJson('/api/auth/logout', {});
      setUser(null);
      setStatus(response.message ?? 'Signed out.');
    } catch (caughtError) {
      setError(caughtError instanceof Error ? caughtError.message : 'Unable to sign out.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="mx-auto flex min-h-screen max-w-7xl flex-col gap-10 px-4 py-8 md:px-8 lg:px-10">
      <section className="grid flex-1 items-center gap-8 lg:grid-cols-[1.15fr_0.85fr] lg:gap-10">
        <div className="space-y-8">
          <div className="inline-flex items-center gap-2 rounded-full border border-aura-100 bg-white/80 px-4 py-2 text-sm font-medium text-ink-700 shadow-sm backdrop-blur">
            <span className="h-2 w-2 rounded-full bg-aura-500" />
            Nestora starter for PHP, MySQL, React, and Vite
          </div>

          <div className="space-y-5">
            <h1 className="max-w-3xl font-display text-5xl font-bold tracking-tight text-ink-900 md:text-6xl">
              A focused auth shell for customers, admins, and future workflows.
            </h1>
            <p className="max-w-2xl text-lg leading-8 text-ink-600">
              Sign in, sign up, and control admin access from one polished entry point. The frontend is built
              with Vite and Tailwind, while the backend uses plain PHP with MySQL sessions.
            </p>
          </div>

          <div className="grid gap-4 md:grid-cols-3">
            <FeatureCard title="Role aware" text="Users and admins are stored with secure password hashing and session login." />
            <FeatureCard title="MySQL ready" text="The schema is ready for a simple users table and clean local development." />
            <FeatureCard title="Shadcn-style UI" text="Reusable primitives keep the interface clean without heavy visual noise." />
          </div>
        </div>

        <div className="glass-panel p-3 md:p-4">
          {user ? (
            <Card className="border-0 bg-transparent shadow-none">
              <CardHeader>
                <CardTitle>Welcome back</CardTitle>
                <CardDescription>Your current session is active. You can continue into the app shell or sign out.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-5">
                <div className="rounded-2xl bg-ink-50 p-4">
                  <p className="text-sm text-ink-500">Signed in as</p>
                  <p className="mt-1 text-xl font-semibold text-ink-900">{user.name}</p>
                  <p className="text-sm text-ink-600">{user.email}</p>
                </div>
                <div className="grid gap-3 sm:grid-cols-2">
                  <InfoPill label="Role" value={user.role} />
                  <InfoPill label="User ID" value={`#${user.id}`} />
                </div>
              </CardContent>
              <CardFooter>
                <Button onClick={handleLogout} disabled={loading} className="w-full">
                  {loading ? 'Signing out...' : 'Sign out'}
                </Button>
              </CardFooter>
            </Card>
          ) : (
            <Card className="border-0 bg-transparent shadow-none">
              <CardHeader>
                <CardTitle>Access Nestora</CardTitle>
                <CardDescription>Choose how you want to enter the app. Admin registration is available through the sign-up form.</CardDescription>
              </CardHeader>
              <CardContent>
                <Tabs value={activeTab} onValueChange={(value) => setActiveTab(value as 'signin' | 'signup')} defaultValue="signin">
                  <TabsList>
                    <TabsTrigger value="signin">Sign in</TabsTrigger>
                    <TabsTrigger value="signup">Sign up</TabsTrigger>
                  </TabsList>

                  <TabsContent value="signin">
                    <form className="mt-2 space-y-4" onSubmit={handleSignIn}>
                      <Field label="Email" htmlFor="signin-email">
                        <Input
                          id="signin-email"
                          type="email"
                          placeholder="you@example.com"
                          value={signIn.email}
                          onChange={(event) => setSignIn((current) => ({ ...current, email: event.target.value }))}
                        />
                      </Field>
                      <Field label="Password" htmlFor="signin-password">
                        <Input
                          id="signin-password"
                          type="password"
                          placeholder="Your password"
                          value={signIn.password}
                          onChange={(event) => setSignIn((current) => ({ ...current, password: event.target.value }))}
                        />
                      </Field>
                      <Button type="submit" className="w-full" disabled={loading}>
                        {loading ? 'Signing in...' : 'Sign in'}
                      </Button>
                    </form>
                  </TabsContent>

                  <TabsContent value="signup">
                    <form className="mt-2 space-y-4" onSubmit={handleSignUp}>
                      <Field label="Full name" htmlFor="signup-name">
                        <Input
                          id="signup-name"
                          placeholder="Jordan Smith"
                          value={signUp.name}
                          onChange={(event) => setSignUp((current) => ({ ...current, name: event.target.value }))}
                        />
                      </Field>
                      <Field label="Email" htmlFor="signup-email">
                        <Input
                          id="signup-email"
                          type="email"
                          placeholder="you@example.com"
                          value={signUp.email}
                          onChange={(event) => setSignUp((current) => ({ ...current, email: event.target.value }))}
                        />
                      </Field>
                      <Field label="Password" htmlFor="signup-password">
                        <Input
                          id="signup-password"
                          type="password"
                          placeholder="Create a password"
                          value={signUp.password}
                          onChange={(event) => setSignUp((current) => ({ ...current, password: event.target.value }))}
                        />
                      </Field>

                      <label className="flex items-start gap-3 rounded-2xl border border-ink-200 bg-ink-50 px-4 py-3">
                        <input
                          type="checkbox"
                          className="mt-1 h-4 w-4 rounded border-ink-300 text-aura-600 focus:ring-aura-500"
                          checked={signUp.wantsAdmin}
                          onChange={(event) =>
                            setSignUp((current) => ({
                              ...current,
                              wantsAdmin: event.target.checked,
                              adminCode: event.target.checked ? current.adminCode : '',
                            }))
                          }
                        />
                        <span className="space-y-1">
                          <span className="block text-sm font-medium text-ink-900">Register as admin</span>
                          <span className="block text-sm leading-6 text-ink-600">
                            Use this only when you have the admin registration key configured on the backend.
                          </span>
                        </span>
                      </label>

                      {signUp.wantsAdmin ? (
                        <Field label="Admin registration key" htmlFor="admin-code">
                          <Input
                            id="admin-code"
                            type="password"
                            placeholder="Enter the backend key"
                            value={signUp.adminCode}
                            onChange={(event) => setSignUp((current) => ({ ...current, adminCode: event.target.value }))}
                          />
                        </Field>
                      ) : null}

                      <Button type="submit" className="w-full" disabled={loading}>
                        {loading ? 'Creating account...' : 'Create account'}
                      </Button>
                    </form>
                  </TabsContent>
                </Tabs>
              </CardContent>
            </Card>
          )}
        </div>
      </section>

      <section className="grid gap-4 md:grid-cols-3">
        <StatusCard title="Backend" value="PHP + PDO" subtitle="Session-based auth and MySQL connection via env config." />
        <StatusCard title="Database" value="MySQL" subtitle="Users table with unique email and role column." />
        <StatusCard title="Frontend" value="React + Vite" subtitle="Tailwind-powered auth shell with reusable UI primitives." />
      </section>

      {(status || error) && (
        <div className="fixed bottom-6 left-1/2 z-10 w-[calc(100%-2rem)] max-w-2xl -translate-x-1/2 rounded-2xl border border-ink-200 bg-white px-5 py-4 shadow-glow">
          <p className={`text-sm font-medium ${error ? 'text-red-600' : 'text-ink-900'}`}>{error || status}</p>
        </div>
      )}
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

function FeatureCard({ title, text }: { title: string; text: string }) {
  return (
    <div className="rounded-2xl border border-white/70 bg-white/90 p-4 shadow-sm">
      <h3 className="font-display text-lg font-semibold text-ink-900">{title}</h3>
      <p className="mt-2 text-sm leading-6 text-ink-600">{text}</p>
    </div>
  );
}

function StatusCard({ title, value, subtitle }: { title: string; value: string; subtitle: string }) {
  return (
    <div className="rounded-3xl border border-white/70 bg-white/80 p-5 shadow-sm backdrop-blur">
      <p className="text-sm font-medium uppercase tracking-[0.2em] text-ink-500">{title}</p>
      <p className="mt-3 font-display text-2xl font-semibold text-ink-900">{value}</p>
      <p className="mt-2 text-sm leading-6 text-ink-600">{subtitle}</p>
    </div>
  );
}

function InfoPill({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-ink-200 bg-white p-4">
      <p className="text-xs font-semibold uppercase tracking-[0.18em] text-ink-500">{label}</p>
      <p className="mt-2 text-sm font-medium text-ink-900">{value}</p>
    </div>
  );
}
