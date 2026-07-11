import { FormEvent, useState, type ReactNode } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '../../components/ui/button';
import { HeaderBar } from '../../components/HeaderBar';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../../components/ui/card';
import { FileUpload } from '../../components/ui/file-upload';
import { Input } from '../../components/ui/input';
import { Label } from '../../components/ui/label';
import { Textarea } from '../../components/ui/textarea';
import type { ProApplicationPayload, User } from '../../types/session';
import { COUNTRY_CODES } from '../../utils/countryCodes';

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
  selectedPlan: 'starter',
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
  const [countryCode, setCountryCode] = useState('+94');
  const [localPhone, setLocalPhone] = useState('');

  const totalSteps = payload.applicationType === 'service_provider' ? 4 : 3;

  const EMAIL_REGEX = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;

  function validateEmail(email: string): boolean {
    return EMAIL_REGEX.test(email);
  }

  function validatePhone(code: string, number: string): string | null {
    const digits = number.replace(/\D/g, '');
    if (!digits) {
      return 'Business phone is required.';
    }
    if (code === '+94') {
      let cleaned = digits;
      if (cleaned.startsWith('0')) {
        cleaned = cleaned.substring(1);
      }
      if (cleaned.length !== 9) {
        return 'Sri Lankan phone number must be exactly 9 digits (e.g., 771234567).';
      }
    } else {
      if (digits.length < 7 || digits.length > 15) {
        return 'Phone number must be between 7 and 15 digits.';
      }
    }
    return null;
  }

  function update(field: keyof ProApplicationPayload, value: string) {
    setError('');
    setPayload((current) => ({ ...current, [field]: value }));
  }

  function handlePhoneChange(value: string) {
    setError('');
    setLocalPhone(value);
  }

  function handleCountryCodeChange(value: string) {
    setError('');
    setCountryCode(value);
  }

  async function handleFinish(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoading(true);
    setError('');

    // Step 3 validation: verify document has been uploaded
    if (!registrationFile) {
      setError('Business registration document is required to complete the process.');
      setLoading(false);
      return;
    }

    if (payload.applicationType === 'service_provider' && !payload.selectedPlan) {
      setError('Please select a subscription plan.');
      setLoading(false);
      return;
    }

    // Double check constraints before submit
    const emailErr = validateEmail(payload.businessEmail) ? null : 'Please enter a valid email address.';
    const phoneErr = validatePhone(countryCode, localPhone);
    if (emailErr || phoneErr) {
      setError(emailErr || phoneErr || '');
      setLoading(false);
      return;
    }

    let cleaned = localPhone.replace(/\D/g, '');
    if (countryCode === '+94' && cleaned.startsWith('0')) {
      cleaned = cleaned.substring(1);
    }
    const finalPhone = countryCode + cleaned;

    try {
      // If a file is selected, submit as FormData so backend can accept file upload
      if (registrationFile) {
        const form = new FormData();
        form.append('applicationType', payload.applicationType);
        form.append('businessName', payload.businessName);
        form.append('businessEmail', payload.businessEmail);
        form.append('businessPhone', finalPhone);
        form.append('businessAddress', payload.businessAddress);
        form.append('businessCity', payload.businessCity);
        form.append('businessDescription', payload.businessDescription);
        // keep optional fields for compatibility
        form.append('documentType', payload.documentType);
        form.append('documentNumber', payload.documentNumber);
        form.append('business_registration_document', registrationFile, registrationFile.name);
        if (payload.applicationType === 'service_provider') {
          form.append('selectedPlan', payload.selectedPlan || 'starter');
        }

        await onSubmit(form);
      } else {
        await onSubmit({
          ...payload,
          businessPhone: finalPhone,
        });
      }
      navigate('/', { replace: true });
    } catch (caughtError) {
      setError(caughtError instanceof Error ? caughtError.message : 'Unable to submit application.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="mx-auto min-h-screen max-w-6xl px-4 py-6 md:px-8">
      <HeaderBar user={user} onLogout={onLogout} />

      <section className="mt-10 grid gap-8 lg:grid-cols-[0.7fr_1.3fr]">
        <div className="space-y-4">
          <p className="text-sm uppercase tracking-[0.2em] text-ink-500">Join as pro</p>
          <h1 className="font-display text-4xl font-semibold text-ink-900">Tell us what kind of pro you are.</h1>
          <p className="text-base leading-7 text-ink-600">
            Complete the three-step application. First choose your role, then share business details, then upload your document.
          </p>
        </div>

        <Card className="border-0 bg-white/90 shadow-glow">
          <CardHeader>
            <CardTitle>Application step {step} of {totalSteps}</CardTitle>
            <CardDescription>Submit one clean application for approval.</CardDescription>
          </CardHeader>
          <CardContent>
            <form className="space-y-4" onSubmit={handleFinish}>
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
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <Field label="Business Name" htmlFor="business-name">
                    <Input id="business-name" value={payload.businessName} onChange={(event) => update('businessName', event.target.value)} />
                  </Field>
                  <Field label="Business Email" htmlFor="business-email">
                    <Input id="business-email" type="email" value={payload.businessEmail} onChange={(event) => update('businessEmail', event.target.value)} />
                  </Field>
                  <Field label="Business Phone" htmlFor="business-phone">
                    <div className="flex gap-2">
                      <select
                        id="country-code"
                        value={countryCode}
                        onChange={(e) => handleCountryCodeChange(e.target.value)}
                        className="flex h-11 w-24 flex-shrink-0 rounded-2xl border border-ink-200 bg-white px-2.5 text-sm text-ink-900 shadow-sm outline-none transition focus:border-aura-500 focus:ring-2 focus:ring-aura-500/20"
                      >
                        {COUNTRY_CODES.map((c) => (
                          <option key={`${c.code}-${c.name}`} value={c.code}>
                            {c.flag} {c.code}
                          </option>
                        ))}
                      </select>
                      <Input
                        id="business-phone"
                        type="tel"
                        placeholder="77 123 4567"
                        value={localPhone}
                        onChange={(event) => handlePhoneChange(event.target.value)}
                        className="flex-1"
                      />
                    </div>
                  </Field>
                  <Field label="City" htmlFor="business-city">
                    <Input id="business-city" value={payload.businessCity} onChange={(event) => update('businessCity', event.target.value)} />
                  </Field>
                  <Field label="Business Address" htmlFor="business-address" className="md:col-span-2">
                    <Input id="business-address" value={payload.businessAddress} onChange={(event) => update('businessAddress', event.target.value)} />
                  </Field>
                  <Field label="Business Description" htmlFor="business-description" className="md:col-span-2">
                    <Textarea id="business-description" className="min-h-[70px] py-2" value={payload.businessDescription} onChange={(event) => update('businessDescription', event.target.value)} placeholder="Tell us more about your business..." />
                  </Field>
                </div>
              ) : null}

              {step === 3 ? (
                <div className="grid gap-4">
                  <FileUpload
                    id="registration-document"
                    label="Business Registration Document"
                    accept="image/*"
                    maxSize={10}
                    onChange={(file) => setRegistrationFile(file)}
                    onError={(error) => setError(error)}
                  />
                </div>
              ) : null}

              {step === 4 && payload.applicationType === 'service_provider' ? (
                <div className="space-y-6">
                  <div className="rounded-3xl border border-aura-500/30 bg-aura-500/5 p-6 backdrop-blur-md">
                    <h3 className="font-display text-lg font-semibold text-ink-900">Select Subscription Plan</h3>
                    <p className="mt-1 text-sm text-ink-600">
                      Nestora requires an active subscription for Service Providers to list services and receive inquiries.
                    </p>
                    
                    <div className="mt-6 border border-ink-200 rounded-2xl bg-white p-5 shadow-sm transition hover:shadow-md">
                      <div className="flex justify-between items-start">
                        <div>
                          <span className="inline-flex items-center rounded-md bg-aura-100 px-2 py-1 text-xs font-medium text-aura-800 ring-1 ring-inset ring-aura-600/20">
                            Recommended
                          </span>
                          <h4 className="mt-2.5 font-display text-xl font-bold text-ink-900">Starter Plan</h4>
                          <p className="mt-1 text-sm text-ink-500">All-in-one subscription for home maintenance professionals.</p>
                        </div>
                        <div className="text-right">
                          <p className="font-display text-3xl font-extrabold text-ink-900">$15</p>
                          <p className="text-xs text-ink-500">USD / Month</p>
                        </div>
                      </div>
                      
                      <div className="mt-6 border-t border-ink-100 pt-4">
                        <ul className="space-y-2.5 text-sm text-ink-700">
                          <li className="flex items-center gap-2">
                            <span className="text-emerald-500">✓</span> Create unlimited service listings
                          </li>
                          <li className="flex items-center gap-2">
                            <span className="text-emerald-500">✓</span> Receive and reply to client inquiries
                          </li>
                          <li className="flex items-center gap-2">
                            <span className="text-emerald-500">✓</span> Secure payments with escrow support
                          </li>
                          <li className="flex items-center gap-2">
                            <span className="text-emerald-500">✓</span> Access to professional portfolio builder
                          </li>
                        </ul>
                      </div>
                      
                      <div className="mt-6">
                        <div className="flex items-center gap-3 rounded-xl bg-ink-50 p-3.5 text-xs text-ink-600 border border-ink-100">
                          <span className="text-lg">ℹ</span>
                          <span>No payment is taken now. Your card will only be charged after the Admin reviews and approves your application.</span>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              ) : null}

              <div className="flex items-center justify-between gap-3">
                <Button type="button" variant="outline" onClick={() => setStep((current) => Math.max(1, current - 1))} disabled={step === 1 || loading}>
                  Back
                </Button>

                {step < totalSteps ? (
                  <Button
                    key="btn-next"
                    type="button"
                    onClick={() => {
                      if (step === 1) {
                        setStep(2);
                        return;
                      }

                      if (step === 2) {
                        if (!payload.businessName.trim()) {
                          setError('Business name is required.');
                          return;
                        }
                        if (!payload.businessEmail.trim()) {
                          setError('Business email is required.');
                          return;
                        }
                        if (!validateEmail(payload.businessEmail)) {
                          setError('Please enter a valid email address.');
                          return;
                        }
                        const phoneErr = validatePhone(countryCode, localPhone);
                        if (phoneErr) {
                          setError(phoneErr);
                          return;
                        }
                        if (!payload.businessAddress.trim()) {
                          setError('Business address is required.');
                          return;
                        }
                        if (!payload.businessCity.trim()) {
                          setError('City is required.');
                          return;
                        }
                        if (!payload.businessDescription.trim()) {
                          setError('Business description is required.');
                          return;
                        }
                      }

                      if (step === 3) {
                        if (!registrationFile) {
                          setError('Business registration document is required.');
                          return;
                        }
                      }

                      setError('');
                      setStep((current) => Math.min(totalSteps, current + 1));
                    }}
                  >
                    Next
                  </Button>
                ) : (
                  <Button key="btn-submit" type="submit" disabled={loading}>
                    {loading
                      ? 'Submitting...'
                      : payload.applicationType === 'service_provider'
                      ? 'Confirm and proceed'
                      : 'Finish and submit'}
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

function Field({ label, htmlFor, children, className }: { label: string; htmlFor: string; children: ReactNode; className?: string }) {
  return (
    <div className={`space-y-1.5 ${className || ''}`}>
      <Label htmlFor={htmlFor}>{label}</Label>
      {children}
    </div>
  );
}
