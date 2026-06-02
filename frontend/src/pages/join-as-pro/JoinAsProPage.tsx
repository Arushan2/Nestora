import { FormEvent, useState, type ReactNode } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Button } from '../../components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../../components/ui/card';
import { FileUpload } from '../../components/ui/file-upload';
import { Input } from '../../components/ui/input';
import { Label } from '../../components/ui/label';
import type { ProApplicationPayload, User } from '../../types/session';

const initialPayload: ProApplicationPayload = {
  applicationType: 'service_provider',
  businessName: '',
  businessEmail: '',
  businessPhone: '',
  businessAddress: '',
  businessCity: '',
  businessDescription: '',
  documentType: '',
  documentNumber: '',
  documentFile: '',
};

export function JoinAsProPage({
  user,
  onSubmit,
  onLogout,
}: {
  user: User;
  onSubmit: (payload: FormData | ProApplicationPayload) => Promise<void>;
  onLogout: () => Promise<void>;
}) {
  const navigate = useNavigate();
  const [step, setStep] = useState(1);
  const [payload, setPayload] = useState(initialPayload);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [registrationFile, setRegistrationFile] = useState<File | null>(null);

  function update(field: keyof ProApplicationPayload, value: string) {
    setPayload((current) => ({ ...current, [field]: value }));
  }

  async function handleFinish(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoading(true);
    setError('');

    try {
      // If a file is selected, submit as FormData so backend can accept file upload
      if (registrationFile) {
        const form = new FormData();
        form.append('applicationType', payload.applicationType);
        form.append('businessName', payload.businessName);
        form.append('businessEmail', payload.businessEmail);
        form.append('businessPhone', payload.businessPhone);
        form.append('businessAddress', payload.businessAddress);
        form.append('businessCity', payload.businessCity);
        form.append('businessDescription', payload.businessDescription);
        // keep optional fields for compatibility
        form.append('documentType', payload.documentType);
        form.append('documentNumber', payload.documentNumber);
        form.append('business_registration_document', registrationFile, registrationFile.name);

        await onSubmit(form);
      } else {
        await onSubmit(payload);
      }
      navigate('/', { replace: true });
    } catch (caughtError) {
      setError(caughtError instanceof Error ? caughtError.message : 'Unable to submit application.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="mx-auto min-h-screen max-w-5xl px-4 py-6 md:px-8">
      <header className="flex items-center justify-between gap-4 rounded-full border border-white/70 bg-white/85 px-4 py-3 shadow-sm backdrop-blur">
        <Link to="/" className="font-display text-xl font-semibold text-ink-900">
          Nestora
        </Link>
        <div className="flex items-center gap-3">
          <Link to="/" className="rounded-full border border-ink-200 px-4 py-2 text-sm font-medium text-ink-700 hover:bg-ink-100">
            Home
          </Link>
          <Button variant="outline" onClick={onLogout}>
            Logout
          </Button>
        </div>
      </header>

      <section className="mt-10 grid gap-8 lg:grid-cols-[0.9fr_1.1fr]">
        <div className="space-y-4">
          <p className="text-sm uppercase tracking-[0.2em] text-ink-500">Join as pro</p>
          <h1 className="font-display text-4xl font-semibold text-ink-900">Tell us what kind of pro you are.</h1>
          <p className="text-base leading-7 text-ink-600">
            Complete the three-step application. First choose your role, then share business details, then upload your document.
          </p>
        </div>

        <Card className="border-0 bg-white/90 shadow-glow">
          <CardHeader>
            <CardTitle>Application step {step} of 3</CardTitle>
            <CardDescription>Submit one clean application for approval.</CardDescription>
          </CardHeader>
          <CardContent>
            <form className="space-y-6" onSubmit={handleFinish}>
              {step === 1 ? (
                <div className="space-y-4">
                  <ChoiceCard
                    selected={payload.applicationType === 'service_provider'}
                    title="Service provider"
                    description="For on-site services, bookings, and offers."
                    onClick={() => update('applicationType', 'service_provider')}
                  />
                  <ChoiceCard
                    selected={payload.applicationType === 'product_seller'}
                    title="Product seller"
                    description="For product listings, dispatch, and inventory."
                    onClick={() => update('applicationType', 'product_seller')}
                  />
                </div>
              ) : null}

              {step === 2 ? (
                <div className="grid gap-4">
                  <Field label="Business name" htmlFor="business-name">
                    <Input id="business-name" value={payload.businessName} onChange={(event) => update('businessName', event.target.value)} />
                  </Field>
                  <Field label="Business email" htmlFor="business-email">
                    <Input id="business-email" type="email" value={payload.businessEmail} onChange={(event) => update('businessEmail', event.target.value)} />
                  </Field>
                  <Field label="Business phone" htmlFor="business-phone">
                    <Input id="business-phone" value={payload.businessPhone} onChange={(event) => update('businessPhone', event.target.value)} />
                  </Field>
                  <Field label="Business address" htmlFor="business-address">
                    <Input id="business-address" value={payload.businessAddress} onChange={(event) => update('businessAddress', event.target.value)} />
                  </Field>
                  <Field label="City" htmlFor="business-city">
                    <Input id="business-city" value={payload.businessCity} onChange={(event) => update('businessCity', event.target.value)} />
                  </Field>
                  <Field label="Business description" htmlFor="business-description">
                    <Input id="business-description" value={payload.businessDescription} onChange={(event) => update('businessDescription', event.target.value)} />
                  </Field>
                </div>
              ) : null}

              {step === 3 ? (
                <div className="grid gap-4">
                  <FileUpload
                    id="registration-document"
                    label="Business registration document"
                    accept="image/*"
                    maxSize={10}
                    onChange={(file) => setRegistrationFile(file)}
                    onError={(error) => setError(error)}
                  />
                </div>
              ) : null}

              <div className="flex items-center justify-between gap-3">
                <Button type="button" variant="outline" onClick={() => setStep((current) => Math.max(1, current - 1))} disabled={step === 1 || loading}>
                  Back
                </Button>

                {step < 3 ? (
                  <Button
                    type="button"
                    onClick={() => {
                      if (step === 1) {
                        setStep(2);
                        return;
                      }

                      setStep((current) => Math.min(3, current + 1));
                    }}
                  >
                    Next
                  </Button>
                ) : (
                  <Button type="submit" disabled={loading}>
                    {loading ? 'Submitting...' : 'Finish and submit'}
                  </Button>
                )}
              </div>

              {error ? <p className="text-sm font-medium text-red-600">{error}</p> : null}
              <p className="text-sm text-ink-500">Signed in as {user.email}</p>
            </form>
          </CardContent>
        </Card>
      </section>
    </main>
  );
}

function ChoiceCard({
  title,
  description,
  selected,
  onClick,
}: {
  title: string;
  description: string;
  selected: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`w-full rounded-3xl border p-5 text-left transition-colors ${selected ? 'border-ink-900 bg-ink-900 text-white' : 'border-ink-200 bg-white text-ink-900 hover:bg-ink-50'}`}
    >
      <p className="font-display text-xl font-semibold">{title}</p>
      <p className={`mt-2 text-sm leading-6 ${selected ? 'text-white/80' : 'text-ink-600'}`}>{description}</p>
    </button>
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
